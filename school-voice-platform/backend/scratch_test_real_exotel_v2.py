import asyncio
import sys
import os
from uuid import uuid4

# Add backend root to path to ensure imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models.user import User
from models.school import School
from models.notice import Notice
from models.campaign import Campaign
from models.student import Student
from models.call_log import CallLog
from services.tts_service import TTSService
from services.exotel_service import ExotelService
from settings import EXOTEL_TEST_FROM

async def test_backend_flow():
    # 1. Initialize services
    tts = TTSService()
    exotel = ExotelService()
    
    # 2. Get the active school
    async with SessionLocal() as db:
        res = await db.execute(School.__table__.select())
        school = res.first()
        if not school:
            print("Error: No school found in DB. Run seed first.")
            return
        school_id = school.id
        print(f"Using School: {school.name} (ID: {school_id})")
        
    notice_id = uuid4()
    campaign_id = uuid4()
    
    test_text = "नमस्ते, यह स्कूल वॉइस ए आई प्लेटफार्म का एक परीक्षण कॉल है। कृपया सुने।"
    print(f"\n1. Generating 8kHz audio via Sarvam AI for notice: {notice_id}")
    audio_path = await tts.generate_audio(test_text, str(school_id), str(notice_id))
    print(f"Audio generated and saved locally at: {audio_path}")
    
    # Inspect wav file using subprocess
    import subprocess
    try:
        inspect = subprocess.check_output(["file", audio_path.lstrip('/')]).decode()
        print(f"Audio Properties: {inspect.strip()}")
    except Exception as e:
        print(f"Could not inspect file: {e}")
        
    # 3. Create campaign in DB
    print(f"\n2. Creating Campaign: {campaign_id}")
    async with SessionLocal() as db:
        # Create notice entry
        notice_obj = Notice(
            id=notice_id,
            school_id=school_id,
            title="Backend Test Notice",
            message=test_text,
            type="General",
            audio_url=audio_path,
            audio_status="ready"
        )
        db.add(notice_obj)
        await db.flush() # Flush to database so Notice is inserted before Campaign refers to it
        
        # Create campaign entry
        campaign_obj = Campaign(
            id=campaign_id,
            school_id=school_id,
            notice_id=notice_id,
            name=f"Backend-Test-{str(notice_id)[:8]}",
            target_type="class",
            target_filter={"class_name": "8", "resolved_phones": [EXOTEL_TEST_FROM]},
            status="pending",
            total_calls=1,
            answered_calls=0
        )
        db.add(campaign_obj)
        await db.commit()
        print("Notice and Campaign persisted in DB.")
        
    # 4. Trigger call via ExotelService
    print(f"\n3. Dispatching outbound call to {EXOTEL_TEST_FROM} via Exotel App ID: {exotel.caller_id}")
    await exotel.launch_bulk_campaign([EXOTEL_TEST_FROM], audio_path, campaign_id, school_id)
    print("\nCall campaign launched! Please pick up the call and check if audio plays.")

if __name__ == "__main__":
    asyncio.run(test_backend_flow())
