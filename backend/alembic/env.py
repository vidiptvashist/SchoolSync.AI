from logging.config import fileConfig
import os
import sys

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# Add current path to sys.path so we can import from database and models
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from settings import DATABASE_URL
from database import Base
# Import all models here so that Base.metadata registers them for autogenerate
from models.school import School
from models.user import User
from models.student import Student
from models.notice import Notice
from models.campaign import Campaign
from models.call_log import CallLog
from models.knowledge_document import KnowledgeDocument
from models.attendance_record import AttendanceRecord
from models.fee_record import FeeRecord
from models.chat_session import ChatSession
from models.chat_message import ChatMessage

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Dynamically override the URL from settings.py.
# Alembic runs migrations synchronously, so we ensure it uses the sync postgresql:// driver.
sync_db_url = DATABASE_URL
if sync_db_url.startswith("postgresql+asyncpg://"):
    sync_db_url = sync_db_url.replace("postgresql+asyncpg://", "postgresql://")
config.set_main_option("sqlalchemy.url", sync_db_url)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target metadata for autogenerate support
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
