from abc import ABC, abstractmethod
from datetime import datetime
from sqlalchemy.future import select

from database import SessionLocal
from models.student import Student
from models.attendance_record import AttendanceRecord
from models.fee_record import FeeRecord

class ERPAdapter(ABC):
    @abstractmethod
    async def get_attendance(self, student_id: str, school_id: str) -> dict:
        """Returns: {student_name, month, total_days, present_days, percentage}"""
        pass
    
    @abstractmethod
    async def get_fee_status(self, student_id: str, school_id: str) -> dict:
        """Returns: {student_name, amount_due, amount_paid, status, due_date}"""
        pass

class LocalDBAdapter(ERPAdapter):
    """For schools without an external ERP - data stored in our DB"""
    
    async def get_attendance(self, student_id: str, school_id: str) -> dict:
        async with SessionLocal() as session:
            # 1. Fetch student
            student_result = await session.execute(
                select(Student).filter(Student.id == student_id, Student.school_id == school_id)
            )
            student = student_result.scalars().first()
            if not student:
                return {}
                
            # 2. Fetch current month's attendance
            current_month = datetime.now().strftime("%Y-%m")
            att_result = await session.execute(
                select(AttendanceRecord).filter(
                    AttendanceRecord.student_id == student_id,
                    AttendanceRecord.school_id == school_id,
                    AttendanceRecord.month == current_month
                )
            )
            record = att_result.scalars().first()
            
            if not record:
                return {
                    "student_name": student.name,
                    "month": current_month,
                    "total_days": 0,
                    "present_days": 0,
                    "percentage": 0.0
                }
                
            return {
                "student_name": student.name,
                "month": record.month,
                "total_days": record.total_days,
                "present_days": record.present_days,
                "percentage": record.attendance_percentage
            }
    
    async def get_fee_status(self, student_id: str, school_id: str) -> dict:
        async with SessionLocal() as session:
            # 1. Fetch student
            student_result = await session.execute(
                select(Student).filter(Student.id == student_id, Student.school_id == school_id)
            )
            student = student_result.scalars().first()
            if not student:
                return {}
                
            # 2. Fetch fee records
            fee_result = await session.execute(
                select(FeeRecord).filter(
                    FeeRecord.student_id == student_id,
                    FeeRecord.school_id == school_id
                )
            )
            records = fee_result.scalars().all()
            
            if not records:
                return {
                    "student_name": student.name,
                    "amount_due": 0.0,
                    "amount_paid": 0.0,
                    "status": "paid",
                    "due_date": None
                }
                
            total_due = sum(r.amount_due for r in records)
            total_paid = sum(r.amount_paid for r in records)
            
            # Determine overall status (if any is overdue, overall status is overdue)
            statuses = [r.status.lower() for r in records]
            if "overdue" in statuses:
                overall_status = "overdue"
            elif "partial" in statuses:
                overall_status = "partial"
            elif "pending" in statuses:
                overall_status = "pending"
            else:
                overall_status = "paid"
                
            # Find earliest due date
            valid_dates = [r.due_date for r in records if r.due_date]
            earliest_due = min(valid_dates) if valid_dates else None
            due_date_str = earliest_due.strftime("%Y-%m-%d") if earliest_due else None
            
            return {
                "student_name": student.name,
                "amount_due": total_due,
                "amount_paid": total_paid,
                "status": overall_status,
                "due_date": due_date_str
            }

def get_erp_adapter(school_id: str) -> ERPAdapter:
    """
    Factory function. In future, this will return different adapters 
    based on which ERP the school uses. For now, always returns LocalDBAdapter.
    """
    return LocalDBAdapter()
