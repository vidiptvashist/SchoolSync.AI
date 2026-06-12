from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from settings import SECRET_KEY, ALGORITHM
from models.user import User
from sqlalchemy.future import select
from uuid import UUID
from typing import Union, List, Optional
import redis
from settings import REDIS_URL
import logging

logger = logging.getLogger("dependencies")

try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
except Exception as e:
    logger.error(f"Failed to connect to Redis in dependencies: {e}")
    redis_client = None

# Create HTTP Bearer authentication scheme
security_scheme = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
    school_id_query: Optional[UUID] = Query(None, alias="school_id", description="Bypass school ID for super admin")
) -> User:
    """
    Extracts Bearer token, validates it, and fetches the associated user.
    If the user has role 'super_admin' and a school_id is passed as a query
    parameter, dynamically set user.school_id to target that school's tenant.
    For non-super_admins, verifies the school account is currently active.
    """
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decode the token payload
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Query the user from the database
    result = await db.execute(select(User).filter(User.id == UUID(user_id)))
    user = result.scalars().first()
    
    if user is None:
        raise credentials_exception
        
    if user.role == "super_admin" and school_id_query:
        user.school_id = school_id_query
        
    # Check if user's school is active (ignored for super admins)
    if user.role != "super_admin" and user.school_id is not None:
        cache_key = f"school_active:{user.school_id}"
        is_active = None
        
        if redis_client:
            try:
                cached_status = redis_client.get(cache_key)
                if cached_status is not None:
                    is_active = (cached_status == "true")
            except Exception as e:
                logger.error(f"Redis get failed in dependencies: {e}")
                
        if is_active is None:
            from models.school import School
            school_result = await db.execute(select(School).filter(School.id == user.school_id))
            school = school_result.scalars().first()
            if not school:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your school account has been deactivated. Please contact support."
                )
            is_active = school.is_active
            
            if redis_client:
                try:
                    redis_client.setex(cache_key, 60, "true" if is_active else "false")
                except Exception as e:
                    logger.error(f"Redis setex failed in dependencies: {e}")
                    
        if not is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your school account has been deactivated. Please contact support."
            )
            
    return user

async def require_super_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to restrict endpoint access solely to super_admins.
    """
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only super admins can access this resource"
        )
    return current_user

class RoleChecker:
    """
    Validates that the logged-in user possesses the required authorization level.
    """
    def __init__(self, allowed_roles: Union[str, List[str]]):
        if isinstance(allowed_roles, str):
            self.allowed_roles = [allowed_roles]
        else:
            self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource"
              )
        return current_user

def require_role(role: Union[str, List[str]]):
    """
    Dependency wrapper. Usage: Depends(require_role("super_admin")) or Depends(require_role(["school_admin", "staff"]))
    """
    return RoleChecker(role)
