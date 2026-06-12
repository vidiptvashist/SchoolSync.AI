import asyncio
from datetime import date
import random
from sqlalchemy.future import select
from database import SessionLocal
from models.school import School
from models.student import Student
from models.attendance_record import AttendanceRecord
from models.fee_record import FeeRecord

async def seed_erp_data():
    """
    Connects to the database and seeds mock attendance and fee records
    for all existing students in the system.
    """
    async with SessionLocal() as session:
        # 1. Fetch all students
        result = await session.execute(select(Student))
        students = result.scalars().all()
        
        if not students:
            print("Seeding: No students found in the database. Please upload students first.")
            return
            
        print(f"Seeding: Generating mock ERP data for {len(students)} students...")
        
        for i, student in enumerate(students):
            # --- Attendance Record Seeding ---
            # Check if attendance already exists for 2026-06
            att_result = await session.execute(
                select(AttendanceRecord).filter(
                    AttendanceRecord.student_id == student.id,
                    AttendanceRecord.month == "2026-06"
                )
            )
            att = att_result.scalars().first()
            
            if not att:
                total_days = 22
                # Random present days to simulate variation
                present_days = random.randint(18, 22)
                percentage = round((present_days / total_days) * 100, 2)
                
                new_att = AttendanceRecord(
                    school_id=student.school_id,
                    student_id=student.id,
                    month="2026-06",
                    total_days=total_days,
                    present_days=present_days,
                    attendance_percentage=percentage
                )
                session.add(new_att)
                print(f"  [Attendance] {student.name}: {present_days}/{total_days} ({percentage}%)")
            else:
                print(f"  [Attendance] Record for {student.name} in 2026-06 already exists.")

            # --- Fee Record Seeding ---
            # Check if fee records already exist for this student
            fee_result = await session.execute(
                select(FeeRecord).filter(FeeRecord.student_id == student.id)
            )
            fees = fee_result.scalars().all()
            
            if not fees:
                # Alternating statuses to create a balanced dataset
                statuses = ["paid", "pending", "partial", "overdue"]
                status = statuses[i % len(statuses)]
                
                # Record 1: Tuition fee
                tuition_due = 15000.0
                tuition_paid = 0.0
                if status == "paid":
                    tuition_paid = 15000.0
                elif status == "partial":
                    tuition_paid = 7500.0
                    
                tuition_fee = FeeRecord(
                    school_id=student.school_id,
                    student_id=student.id,
                    amount_due=tuition_due,
                    amount_paid=tuition_paid,
                    due_date=date(2026, 6, 30),
                    status=status,
                    description="Term 2 Tuition Fee"
                )
                session.add(tuition_fee)
                
                # Record 2: Activity Fee
                activity_status = "paid" if status == "paid" else "pending"
                activity_due = 2000.0
                activity_paid = 2000.0 if activity_status == "paid" else 0.0
                
                activity_fee = FeeRecord(
                    school_id=student.school_id,
                    student_id=student.id,
                    amount_due=activity_due,
                    amount_paid=activity_paid,
                    due_date=date(2026, 6, 15),
                    status=activity_status,
                    description="Quarterly Activity & Bus Fee"
                )
                session.add(activity_fee)
                print(f"  [Fees] {student.name}: Tuition={status}, Activity={activity_status}")
            else:
                print(f"  [Fees] Records for {student.name} already exist.")
                
        # Commit the transaction
        await session.commit()
    print("Seeding complete! ERP mock data has been added.")

if __name__ == "__main__":
    asyncio.run(seed_erp_data())
