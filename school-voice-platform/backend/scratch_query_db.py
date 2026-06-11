import asyncio
from sqlalchemy.future import select
from database import SessionLocal
from models.school import School
from models.user import User
from models.student import Student
from models.notice import Notice
from models.campaign import Campaign
from models.call_log import CallLog

async def main():
    async with SessionLocal() as db:
        print("=== Schools ===")
        res = await db.execute(select(School))
        for x in res.scalars().all():
            print(f"School ID: {x.id}, Name: {x.name}, Phone: {x.phone}, Exotel: {x.exotel_number}")
            
        print("\n=== Users ===")
        res = await db.execute(select(User))
        for x in res.scalars().all():
            print(f"User ID: {x.id}, Email: {x.email}, School: {x.school_id}")
            
        print("\n=== Students ===")
        res = await db.execute(select(Student))
        for x in res.scalars().all():
            print(f"Student ID: {x.id}, Name: {x.name}, Phone: {x.parent_phone}, Class: {x.class_name}, Section: {x.section}")
            
        print("\n=== Notices ===")
        res = await db.execute(select(Notice))
        for x in res.scalars().all():
            print(f"Notice ID: {x.id}, Title: {x.title}, Message: '{x.message}', Audio URL: {x.audio_url}, Audio Status: {x.audio_status}")
            
        print("\n=== Campaigns ===")
        res = await db.execute(select(Campaign))
        for x in res.scalars().all():
            print(f"Campaign ID: {x.id}, Name: {x.name}, Status: {x.status}, Total: {x.total_calls}, Answered: {x.answered_calls}, Filter: {x.target_filter}")
            
        print("\n=== Call Logs ===")
        res = await db.execute(select(CallLog))
        for x in res.scalars().all():
            print(f"Call Log ID: {x.id}, Campaign: {x.campaign_id}, Phone: {x.caller_phone}, Status: {x.status}, Sid: {x.exotel_call_sid}, Duration: {x.duration_seconds}")

if __name__ == "__main__":
    asyncio.run(main())
