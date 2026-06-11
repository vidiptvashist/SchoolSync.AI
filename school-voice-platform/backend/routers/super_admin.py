from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, case, update, literal_column
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timedelta
import secrets
import string

from database import get_db
from models.school import School
from models.user import User
from models.call_log import CallLog
from models.student import Student
from core.dependencies import require_super_admin
from core.security import verify_password, get_password_hash, create_access_token
import redis
from settings import REDIS_URL
import logging

logger = logging.getLogger("super_admin_router")

try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
except Exception as e:
    logger.error(f"Failed to connect to Redis in super_admin: {e}")
    redis_client = None

router = APIRouter(prefix="/super-admin", tags=["Super Admin"])

# --- Request & Response Schemas ---

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    school_id: Optional[UUID] = None
    role: str

class SchoolCreateRequest(BaseModel):
    school_name: str
    city: Optional[str] = None
    exotel_number: Optional[str] = None
    admin_email: EmailStr
    admin_name: Optional[str] = None

class SchoolAdminOut(BaseModel):
    id: UUID
    email: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class SchoolOut(BaseModel):
    id: UUID
    name: str
    city: Optional[str] = None
    exotel_number: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class SchoolStats(BaseModel):
    total_students: int
    total_calls_alltime: int
    calls_this_month: int
    last_call_at: Optional[datetime] = None

class SchoolWithStatsOut(SchoolOut):
    stats: SchoolStats

class SchoolCreateResponse(BaseModel):
    school: SchoolOut
    admin_user: SchoolAdminOut
    generated_password: str

class CallLogOut(BaseModel):
    id: UUID
    caller_phone: str
    direction: str
    status: str
    duration_seconds: int
    created_at: datetime

    class Config:
        from_attributes = True

class MonthlyVolume(BaseModel):
    month: str
    count: int

class SchoolDetailResponse(SchoolOut):
    admins: List[SchoolAdminOut]
    last_10_calls: List[CallLogOut]
    monthly_volume: List[MonthlyVolume]

class SchoolUpdateRequest(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    exotel_number: Optional[str] = None

class SchoolStatusUpdateRequest(BaseModel):
    is_active: bool


# --- Helper Functions ---

def generate_secure_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


# --- Endpoints ---

@router.post("/auth/login", response_model=LoginResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Authenticates Super Admin credentials and issues a JWT token.
    Only succeeds if the authenticated user has the 'super_admin' role.
    """
    result = await db.execute(select(User).filter(User.email == request.email))
    user = result.scalars().first()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only super admins can access this login"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is deactivated"
        )

    token_payload = {
        "user_id": str(user.id),
        "school_id": None,
        "role": user.role
    }
    access_token = create_access_token(data=token_payload)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "school_id": None,
        "role": user.role
    }


@router.get("/schools", response_model=List[SchoolWithStatsOut], dependencies=[Depends(require_super_admin)])
async def get_schools(
    db: AsyncSession = Depends(get_db)
):
    """
    Returns a list of all schools on the platform with aggregated call metrics and student counts.
    """
    # Subquery for total students count
    students_sub = select(
        Student.school_id,
        func.count(Student.id).label("total_students")
    ).group_by(Student.school_id).subquery()

    # Subquery for call metrics (all time count and last call timestamp)
    calls_sub = select(
        CallLog.school_id,
        func.count(CallLog.id).label("total_calls"),
        func.max(CallLog.created_at).label("last_call_at")
    ).group_by(CallLog.school_id).subquery()

    # Subquery for calls made during the current month
    now = datetime.now()
    start_of_month = datetime(now.year, now.month, 1)
    calls_month_sub = select(
        CallLog.school_id,
        func.count(CallLog.id).label("calls_this_month")
    ).filter(
        CallLog.created_at >= start_of_month
    ).group_by(CallLog.school_id).subquery()

    # Query all schools joining subqueries
    query = select(
        School,
        func.coalesce(students_sub.c.total_students, 0).label("total_students"),
        func.coalesce(calls_sub.c.total_calls, 0).label("total_calls_alltime"),
        func.coalesce(calls_month_sub.c.calls_this_month, 0).label("calls_this_month"),
        calls_sub.c.last_call_at.label("last_call_at")
    ).outerjoin(
        students_sub, School.id == students_sub.c.school_id
    ).outerjoin(
        calls_sub, School.id == calls_sub.c.school_id
    ).outerjoin(
        calls_month_sub, School.id == calls_month_sub.c.school_id
    ).order_by(School.created_at.desc())

    result = await db.execute(query)
    
    schools_with_stats = []
    for row in result.all():
        school = row.School
        stats = {
            "total_students": row.total_students,
            "total_calls_alltime": row.total_calls_alltime,
            "calls_this_month": row.calls_this_month,
            "last_call_at": row.last_call_at
        }
        # Build dictionary from school attributes + stats
        school_dict = {
            "id": school.id,
            "name": school.name,
            "city": school.city,
            "exotel_number": school.exotel_number,
            "is_active": school.is_active,
            "created_at": school.created_at,
            "stats": stats
        }
        schools_with_stats.append(school_dict)

    return schools_with_stats


@router.post("/schools", response_model=SchoolCreateResponse, dependencies=[Depends(require_super_admin)])
async def create_school(
    payload: SchoolCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new school and its first admin user in a single transaction.
    Generates a secure temporary password.
    """
    # Check if admin email is already taken
    email_check = await db.execute(select(User).filter(User.email == payload.admin_email))
    if email_check.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin email is already registered"
        )

    # Begin single transaction block
    try:
        new_school = School(
            name=payload.school_name,
            city=payload.city,
            exotel_number=payload.exotel_number,
            is_active=True
        )
        db.add(new_school)
        await db.flush() # populates new_school.id

        generated_pass = generate_secure_password()
        hashed_pass = get_password_hash(generated_pass)

        new_admin = User(
            school_id=new_school.id,
            email=payload.admin_email,
            password_hash=hashed_pass,
            role="school_admin",
            is_active=True
        )
        db.add(new_admin)
        await db.commit()

        await db.refresh(new_school)
        await db.refresh(new_admin)

        return {
            "school": new_school,
            "admin_user": new_admin,
            "generated_password": generated_pass
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create school and admin user: {str(e)}"
        )


@router.get("/schools/{school_id}", response_model=SchoolDetailResponse, dependencies=[Depends(require_super_admin)])
async def get_school_detail(
    school_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Fetches detailed metadata, administrators, recent calls, and call history metrics for one school.
    """
    # 1. Fetch School
    school_result = await db.execute(select(School).filter(School.id == school_id))
    school = school_result.scalars().first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found"
        )

    # 2. Fetch Administrators
    admins_result = await db.execute(select(User).filter(User.school_id == school_id, User.role == "school_admin"))
    admins = admins_result.scalars().all()

    # 3. Fetch Last 10 Calls
    calls_result = await db.execute(
        select(CallLog)
        .filter(CallLog.school_id == school_id)
        .order_by(CallLog.created_at.desc())
        .limit(10)
    )
    last_10_calls = calls_result.scalars().all()

    # 4. Fetch Monthly Volume (Past 6 Months)
    monthly_query = select(
        func.to_char(CallLog.created_at, literal_column("'YYYY-MM'")).label("month"),
        func.count(CallLog.id).label("count")
    ).filter(
        CallLog.school_id == school_id
    ).group_by(
        func.to_char(CallLog.created_at, literal_column("'YYYY-MM'"))
    ).order_by(
        func.to_char(CallLog.created_at, literal_column("'YYYY-MM'")).desc()
    )
    db_result = await db.execute(monthly_query)
    results_dict = {row.month: row.count for row in db_result.all()}

    # Backfill past 6 months to guarantee exact payload shape
    monthly_volume = []
    current = datetime.now()
    for i in range(6):
        year = current.year
        month = current.month - i
        while month <= 0:
            month += 12
            year -= 1
        m_str = f"{year:04d}-{month:02d}"
        monthly_volume.append({
            "month": m_str,
            "count": results_dict.get(m_str, 0)
        })
    monthly_volume.reverse() # chronologically ascending

    return {
        "id": school.id,
        "name": school.name,
        "city": school.city,
        "exotel_number": school.exotel_number,
        "is_active": school.is_active,
        "created_at": school.created_at,
        "admins": admins,
        "last_10_calls": last_10_calls,
        "monthly_volume": monthly_volume
    }


@router.patch("/schools/{school_id}", response_model=SchoolOut, dependencies=[Depends(require_super_admin)])
async def update_school(
    school_id: UUID,
    payload: SchoolUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Updates general metadata for a specific school.
    """
    school_result = await db.execute(select(School).filter(School.id == school_id))
    school = school_result.scalars().first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found"
        )

    # Apply updates dynamically
    update_data = payload.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(school, key, value)

    await db.commit()
    await db.refresh(school)
    return school


@router.patch("/schools/{school_id}/status", response_model=SchoolOut, dependencies=[Depends(require_super_admin)])
async def update_school_status(
    school_id: UUID,
    payload: SchoolStatusUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Enables/Disables account status for a tenant school.
    Deactivation blocks administrative dashboard logins.
    """
    school_result = await db.execute(select(School).filter(School.id == school_id))
    school = school_result.scalars().first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found"
        )

    school.is_active = payload.is_active
    await db.commit()
    await db.refresh(school)

    # Evict active cache status from Redis
    if redis_client:
        try:
            redis_client.delete(f"school_active:{school_id}")
        except Exception as e:
            logger.error(f"Failed to delete Redis cache key in update_school_status: {e}")

    return school


@router.delete("/schools/{school_id}", dependencies=[Depends(require_super_admin)])
async def delete_school(
    school_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Soft deletes a school to preserve historical data records.
    Sets is_active=False and appends '_deleted_{timestamp}' suffix to its name.
    """
    school_result = await db.execute(select(School).filter(School.id == school_id))
    school = school_result.scalars().first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found"
        )

    # Prevent multiple soft deletions appending suffixes redundantly
    if "_deleted_" not in school.name:
        timestamp = int(datetime.now().timestamp())
        school.name = f"{school.name}_deleted_{timestamp}"

    school.is_active = False
    await db.commit()

    # Evict active cache status from Redis
    if redis_client:
        try:
            redis_client.delete(f"school_active:{school_id}")
        except Exception as e:
            logger.error(f"Failed to delete Redis cache key in delete_school: {e}")

    return {"message": "School soft-deleted successfully", "school_id": school_id}
