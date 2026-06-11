#!/bin/bash

# Crucial line: Automatically kills all background processes started by this script when you press Ctrl+C
trap "kill 0" EXIT

echo "============================================="
echo "🚀 Starting School Voice AI Platform..."
echo "============================================="

# 1. Start backend server
echo "👉 Starting FastAPI Backend on http://127.0.0.1:8000 ..."
cd "$(dirname "$0")/backend"
.venv/bin/uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!

# 2. Start frontend server
echo "👉 Starting Next.js Frontend on http://localhost:3000 ..."
cd "../frontend"
npm run dev &
FRONTEND_PID=$!

# Go back to root directory
cd ..

echo "============================================="
echo "🔥 Both servers are running!"
echo "   - Press Ctrl+C in this terminal to stop both servers safely."
echo "============================================="

# Keep script running and wait for keyboard interrupt (Ctrl+C)
wait
