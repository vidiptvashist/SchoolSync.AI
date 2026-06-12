import asyncio
import os
import sys
from unittest.mock import AsyncMock, patch

# Add backend root to path to ensure imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models.school import School
from models.user import User
from models.student import Student
from models.notice import Notice
from models.campaign import Campaign
from models.call_log import CallLog
from services.exotel_service import ExotelService
from routers.webhooks import handle_exotel_call_status

class MockRequest:
    def __init__(self, form_data):
        self.form_data = form_data
    async def form(self):
        return self.form_data

async def run_integration_test():
    print("---------------------------------------------")
    print("🧪 Running Notices & Campaigns Integration Test")
    print("---------------------------------------------")
    
    # 1. Setup mock data
    async with SessionLocal() as db:
        # Fetch school (academy seeded)
        school_result = await db.execute(School.__table__.select())
        school = school_result.first()
        if not school:
            print("Error: Run database seed first!")
            return
            
        school_id = school.id
        print(f"Using School ID: {school_id}")
        
        # Ensure a test student exists
        student_phone = "9876543210"
        student_result = await db.execute(Student.__table__.select().where(Student.parent_phone == student_phone))
        student = student_result.first()
        if not student:
            print(f"Creating test student with phone {student_phone}...")
            new_student = Student(
                school_id=school_id,
                name="Test Kid",
                class_name="10",
                section="B",
                roll_number="12",
                parent_name="Parent Kid",
                parent_phone=student_phone
            )
            db.add(new_student)
            await db.commit()
            
        # Create a mock notice
        print("Creating mock Notice...")
        notice = Notice(
            school_id=school_id,
            title="PTM Notice",
            message="Parents, please attend the PTM meeting.",
            type="ptm",
            audio_url="/uploads/audio/test/ptm.wav",
            audio_status="ready"
        )
        db.add(notice)
        await db.commit()
        await db.refresh(notice)
        notice_id = notice.id
        print(f"Notice created with ID: {notice_id}")
        
        # Create a mock campaign
        print("Creating mock Campaign...")
        campaign = Campaign(
            school_id=school_id,
            notice_id=notice_id,
            name="PTM Announcement Broadcast",
            target_type="class",
            target_filter={"class_name": "10", "resolved_phones": [student_phone]},
            status="pending",
            total_calls=1,
            answered_calls=0
        )
        db.add(campaign)
        await db.commit()
        await db.refresh(campaign)
        campaign_id = campaign.id
        print(f"Campaign created with ID: {campaign_id}")

    # 2. Mock Exotel API and trigger campaign
    print("Launching campaign with mocked Exotel API...")
    mock_call_sid = "mock_call_sid_12345"
    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json = lambda: {"Call": {"Sid": mock_call_sid}}
    
    exotel = ExotelService()
    
    with patch("httpx.AsyncClient.post", return_value=mock_response) as mock_post:
        # Run launch in foreground for test
        await exotel.launch_bulk_campaign(
            phone_numbers=[student_phone],
            audio_url="/uploads/audio/test/ptm.wav",
            campaign_id=str(campaign_id),
            school_id=str(school_id)
        )
        mock_post.assert_called_once()
        print("Exotel API connect.json called successfully via mock.")

    # 3. Verify CallLog entry was created
    async with SessionLocal() as db:
        log_result = await db.execute(
            CallLog.__table__.select().where(CallLog.exotel_call_sid == mock_call_sid)
        )
        call_log = log_result.first()
        if call_log:
            print(f"CallLog found! ID: {call_log.id}, Status: {call_log.status} (Expected: dialing)")
            assert call_log.status == "dialing"
        else:
            print("Error: CallLog was not created!")
            return

    # 4. Simulate Exotel callback Webhook
    print("Simulating Exotel callback webhook /webhooks/exotel/call-status...")
    mock_request = MockRequest({
        "CallSid": mock_call_sid,
        "Status": "completed",
        "ConversationDuration": "30"
    })
    
    # Directly call the webhook handler function
    webhook_response = await handle_exotel_call_status(
        request=mock_request,
        campaign_id=campaign_id,
        school_id=school_id,
        phone_number=student_phone
    )
    print(f"Webhook response: {webhook_response}")
    
    # 5. Verify database updates after webhook
    async with SessionLocal() as db:
        # Verify CallLog is now answered
        log_result = await db.execute(
            CallLog.__table__.select().where(CallLog.exotel_call_sid == mock_call_sid)
        )
        updated_log = log_result.first()
        print(f"Updated CallLog Status: {updated_log.status} (Expected: answered)")
        print(f"Updated CallLog Duration: {updated_log.duration_seconds} seconds (Expected: 30)")
        assert updated_log.status == "answered"
        assert updated_log.duration_seconds == 30
        
        # Verify Campaign answered_calls count incremented
        campaign_result = await db.execute(
            Campaign.__table__.select().where(Campaign.id == campaign_id)
        )
        updated_campaign = campaign_result.first()
        print(f"Campaign status: {updated_campaign.status} (Expected: completed)")
        print(f"Campaign answered calls: {updated_campaign.answered_calls} (Expected: 1)")
        assert updated_campaign.answered_calls == 1
        
        # 6. Cleanup mock test entries
        print("Cleaning up test database records...")
        await db.execute(CallLog.__table__.delete().where(CallLog.campaign_id == campaign_id))
        await db.execute(Campaign.__table__.delete().where(Campaign.id == campaign_id))
        await db.execute(Notice.__table__.delete().where(Notice.id == notice_id))
        await db.commit()
        
    print("---------------------------------------------")
    print("🎉 All Integration Tests Passed Successfully!")
    print("---------------------------------------------")

if __name__ == "__main__":
    asyncio.run(run_integration_test())
