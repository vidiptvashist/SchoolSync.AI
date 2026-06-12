import asyncio
from sqlalchemy import update, delete
from database import SessionLocal
from models.campaign import Campaign
from models.call_log import CallLog

async def main():
    async with SessionLocal() as db:
        # Reset campaign status to 'pending'
        await db.execute(
            update(Campaign)
            .where(Campaign.name == "demo1")
            .values(status="pending", total_calls=1, answered_calls=0)
        )
        
        # Get the campaign id
        res = await db.execute(Campaign.__table__.select().where(Campaign.name == "demo1"))
        campaign = res.first()
        if campaign:
            campaign_id = campaign.id
            print(f"Reset campaign '{campaign.name}' (ID: {campaign_id}) to pending.")
            
            # Delete call logs for this campaign
            await db.execute(
                delete(CallLog)
                .where(CallLog.campaign_id == campaign_id)
            )
            print("Deleted old call logs for this campaign.")
        else:
            print("Campaign 'demo1' not found.")
            
        await db.commit()

if __name__ == "__main__":
    asyncio.run(main())
