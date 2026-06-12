from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_
from typing import List, Optional
from uuid import UUID
import pandas as pd
import io

from database import get_db
from models.user import User
from models.student import Student
from core.dependencies import get_current_user
from schemas.student import StudentOut

router = APIRouter(prefix="/students", tags=["Students"])

def clean_value(val) -> Optional[str]:
    """
    Cleans cell data read from pandas.
    Converts numbers (which pandas reads as floats, e.g., 9876.0) to clean strings.
    """
    if val is None or pd.isna(val):
        return None
    val_str = str(val).strip()
    # If pandas read a whole number as a float, strip the trailing ".0"
    if val_str.endswith(".0"):
        val_str = val_str[:-2]
    return val_str if val_str != "" else None

@router.post("/upload")
async def upload_students(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads a CSV or Excel file of students.
    Upserts by checking if school_id + roll_number already exists.
    """
    contents = await file.read()
    
    # 1. Parse using pandas depending on file extension
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file format. Please upload a CSV or Excel (.xlsx/.xls) file."
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not parse spreadsheet file: {str(e)}"
        )
        
    # 2. Normalize and check columns
    df.columns = [c.strip().lower() for c in df.columns]
    required_cols = {"name", "parent_phone"}
    missing_cols = required_cols - set(df.columns)
    
    if missing_cols:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required columns: {', '.join(missing_cols)}. Expected columns: name, class_name, section, roll_number, parent_name, parent_phone"
        )
        
    uploaded_count = 0
    updated_count = 0
    errors = []
    
    # 3. Iterate over rows and apply upsert logic
    for index, row in df.iterrows():
        row_num = index + 2  # Convert 0-indexed pandas row to 1-indexed Excel row (with header)
        
        name = clean_value(row.get("name"))
        parent_phone = clean_value(row.get("parent_phone"))
        class_name = clean_value(row.get("class_name"))
        section = clean_value(row.get("section"))
        roll_number = clean_value(row.get("roll_number"))
        parent_name = clean_value(row.get("parent_name"))
        
        # Validation checks
        if not name or not parent_phone:
            errors.append(f"Row {row_num}: 'name' and 'parent_phone' are mandatory.")
            continue
            
        # Search for existing student with same roll_number in this school
        existing_student = None
        if roll_number:
            result = await db.execute(
                select(Student).filter(
                    and_(
                        Student.school_id == current_user.school_id,
                        Student.roll_number == roll_number
                    )
                )
            )
            existing_student = result.scalars().first()
            
        if existing_student:
            # Update existing record
            existing_student.name = name
            existing_student.class_name = class_name
            existing_student.section = section
            existing_student.parent_name = parent_name
            existing_student.parent_phone = parent_phone
            updated_count += 1
        else:
            # Insert new record
            new_student = Student(
                school_id=current_user.school_id,
                name=name,
                class_name=class_name,
                section=section,
                roll_number=roll_number,
                parent_name=parent_name,
                parent_phone=parent_phone
            )
            db.add(new_student)
            uploaded_count += 1
            
    # Commit transaction
    await db.commit()
    
    return {
        "uploaded": uploaded_count,
        "updated": updated_count,
        "errors": errors
    }

@router.get("/", response_model=List[StudentOut])
async def list_students(
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists students for the current school with optional search and filters.
    """
    query = select(Student).filter(Student.school_id == current_user.school_id)
    
    # Apply filters
    if class_name:
        query = query.filter(Student.class_name == class_name)
    if section:
        query = query.filter(Student.section == section)
    if search:
        query = query.filter(
            or_(
                Student.name.ilike(f"%{search}%"),
                Student.parent_phone.ilike(f"%{search}%")
            )
        )
        
    # Apply pagination and sorting
    query = query.order_by(Student.name).offset(offset).limit(limit)
    
    result = await db.execute(query)
    students = result.scalars().all()
    return students

@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes a student record. Ownership is verified via school_id.
    """
    result = await db.execute(
        select(Student).filter(Student.id == student_id)
    )
    student = result.scalars().first()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
        
    # Verify school ownership
    if student.school_id != current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this student record"
        )
        
    await db.delete(student)
    await db.commit()
