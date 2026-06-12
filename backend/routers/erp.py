from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from uuid import UUID
from datetime import datetime

from database import get_db
from models.user import User
from models.student import Student
from models.attendance_record import AttendanceRecord
from models.fee_record import FeeRecord
from core.dependencies import get_current_user
from schemas.erp import AttendanceRecordOut, FeeRecordOut

router = APIRouter(prefix="/erp", tags=["ERP"])

async def verify_student_school(student_id: UUID, current_user: User, db: AsyncSession) -> Student:
    """Helper to fetch student and verify they belong to the same school as current_user."""
    result = await db.execute(
        select(Student).filter(Student.id == student_id)
    )
    student = result.scalars().first()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
        
    if student.school_id != current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access records for this student"
        )
        
    return student

@router.get("/attendance/{student_id}", response_model=AttendanceRecordOut)
async def get_attendance(
    student_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get attendance record for the student for the current month.
    """
    # Verify student exists and belongs to the user's school
    await verify_student_school(student_id, current_user, db)
    
    current_month = datetime.now().strftime("%Y-%m")
    
    result = await db.execute(
        select(AttendanceRecord).filter(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.month == current_month
        )
    )
    record = result.scalars().first()
    
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attendance record not found for this student for the month of {current_month}"
        )
        
    return record

@router.get("/fee/{student_id}", response_model=List[FeeRecordOut])
async def get_fees(
    student_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all fee records/status for the student.
    """
    # Verify student exists and belongs to the user's school
    await verify_student_school(student_id, current_user, db)
    
    result = await db.execute(
        select(FeeRecord).filter(FeeRecord.student_id == student_id)
    )
    records = result.scalars().all()
    
    return records
