#!/bin/bash

# Run database migrations
alembic upgrade head

# Seed the database with default accounts (admin & superadmin)
python seed.py
python seed_erp.py

# Start the FastAPI Web Server in the foreground (required by Render to bind to $PORT)
uvicorn main:app --host 0.0.0.0 --port $PORT
