#!/bin/bash

# Run database migrations
alembic upgrade head

# Start the LiveKit Voice Agent in the background
python voice_agent/agent.py start &

# Start the FastAPI Web Server in the foreground (required by Render to bind to $PORT)
uvicorn main:app --host 0.0.0.0 --port $PORT
