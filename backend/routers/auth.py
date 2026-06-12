from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID

from database import get_db
from models.school import School
from models.user import User
from core.security import verify_password, create_access_token, get_password_hash
from core.dependencies import require_role
from schemas.school import SchoolOut
from schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["Authentication"])

# --- Request & Response Schemas ---

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    school_id: Optional[UUID] = None
    role: str

class SchoolRegisterRequest(BaseModel):
    school_name: str
    school_phone: Optional[str] = None
    admin_email: str
    admin_password: str

class SchoolRegisterResponse(BaseModel):
    school: SchoolOut
    admin: UserOut


# --- Endpoints ---

@router.post("/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Autenticates credentials and issues a 24-hour JWT token.
    """
    # 1. Fetch user by email
    result = await db.execute(select(User).filter(User.email == request.email))
    user = result.scalars().first()
    
    # 2. Check existence and password
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
        
    # 3. Check if user account is disabled
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is deactivated"
        )
        
    # 3.2. Check if the user's school account is active (only for non-super_admins)
    if user.school_id is not None:
        from models.school import School
        school_result = await db.execute(select(School).filter(School.id == user.school_id))
        school = school_result.scalars().first()
        if school and not school.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your school account has been deactivated. Please contact support."
            )
        
    # 4. Generate JWT access token with user metadata claims
    token_payload = {
        "user_id": str(user.id),
        "school_id": str(user.school_id) if user.school_id else None,
        "role": user.role
    }
    access_token = create_access_token(data=token_payload)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "school_id": user.school_id,
        "role": user.role
    }


@router.post("/register-school", response_model=SchoolRegisterResponse, status_code=status.HTTP_201_CREATED)
async def register_school(
    request: SchoolRegisterRequest,
    current_user: User = Depends(require_role("super_admin")),
    db: AsyncSession = Depends(get_db)
):
    """
    Registers a new tenant school alongside an admin user. Resticted to super_admins.
    """
    # 1. Check if the administrator email is already registered
    result = await db.execute(select(User).filter(User.email == request.admin_email))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin email is already registered"
        )
        
    # 2. Create and persist the school record
    new_school = School(
        name=request.school_name,
        phone=request.school_phone
    )
    db.add(new_school)
    # Flush registers new_school.id so it is available for foreign key mapping
    await db.flush()
    
    # 3. Hash the admin password and create the user record
    hashed_password = get_password_hash(request.admin_password)
    new_admin = User(
        school_id=new_school.id,
        email=request.admin_email,
        password_hash=hashed_password,
        role="school_admin",
        is_active=True
    )
    db.add(new_admin)
    
    # 4. Save transaction changes
    await db.commit()
    
    # Refresh to load database defaults
    await db.refresh(new_school)
    await db.refresh(new_admin)
    
    return {
        "school": new_school,
        "admin": new_admin
    }
