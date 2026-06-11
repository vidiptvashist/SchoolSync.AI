from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from settings import DATABASE_URL

# SQLAlchemy's async engine requires the driver 'asyncpg' specified in the URL.
# If DATABASE_URL starts with postgresql:// we change it to postgresql+asyncpg://
db_url = DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://")

# Create the SQLAlchemy asynchronous engine
engine = create_async_engine(
    db_url,
    echo=True,  # Set to True to print all SQL queries to console (useful for development)
)

# Create a session factory to generate database sessions
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for defining our database Models (tables)
Base = declarative_base()

# FastAPI dependency function: yields a session to an endpoint,
# and automatically closes it when the request is done.
async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
