import os
import re
from uuid import UUID
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models.user import User
from models.school import School
from core.dependencies import get_current_user
from schemas.school import SchoolProfileOut, SchoolUpdate

router = APIRouter(prefix="/schools", tags=["Schools"])

@router.get("/me", response_model=SchoolProfileOut)
async def get_my_school(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve school profile details for the authenticated user.
    """
    if not current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any school."
        )
    
    result = await db.execute(select(School).filter(School.id == current_user.school_id))
    school = result.scalars().first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found."
        )
    return school

@router.patch("/me", response_model=SchoolProfileOut)
async def update_my_school(
    body: SchoolUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update name and city for the authenticated user's school.
    """
    if not current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any school."
        )
    
    result = await db.execute(select(School).filter(School.id == current_user.school_id))
    school = result.scalars().first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found."
        )
    
    if body.name is not None:
        school.name = body.name
    if body.city is not None:
        school.city = body.city
        
    await db.commit()
    await db.refresh(school)
    return school

@router.patch("/me/branding", response_model=SchoolProfileOut)
async def update_school_branding(
    primary_color: Optional[str] = Form(None),
    logo: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update primary color and upload/save logo image for the authenticated user's school.
    """
    if not current_user.school_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not associated with any school."
        )
        
    result = await db.execute(select(School).filter(School.id == current_user.school_id))
    school = result.scalars().first()
    if not school:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="School not found."
        )
        
    if primary_color is not None:
        # Validate hex format (e.g. #123 or #123456 or #12345678 for alpha)
        if not re.match(r"^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$|^#[0-9a-fA-F]{8}$", primary_color):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid primary color. Must be a valid hex color starting with # (e.g. #1e40af)."
            )
        school.primary_color = primary_color
        
    if logo is not None:
        # Validate file size is under 500KB
        contents = await logo.read()
        if len(contents) > 500 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Logo file size must be under 500KB."
            )
            
        # Validate that the file is an image (extension or content type check)
        content_type = logo.content_type or ""
        filename = logo.filename or ""
        valid_types = ["image/png", "image/jpeg", "image/jpg"]
        valid_extensions = [".png", ".jpg", ".jpeg"]
        file_ext = os.path.splitext(filename)[1].lower()
        
        if content_type not in valid_types and file_ext not in valid_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file type. Only PNG, JPG, or JPEG images are allowed."
            )
            
        # Ensure uploads/logos directory exists
        os.makedirs("uploads/logos", exist_ok=True)
        # Save to uploads/logos/{school_id}.png
        logo_path = f"uploads/logos/{school.id}.png"
        
        with open(logo_path, "wb") as f:
            f.write(contents)
            
        school.logo_url = f"/uploads/logos/{school.id}.png"
        
    await db.commit()
    await db.refresh(school)
    return school
