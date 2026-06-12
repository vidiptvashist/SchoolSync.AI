#!/bin/bash

# Start the LiveKit Voice Agent in the background
python voice_agent/agent.py start &

# Start a tiny dummy web server on the port Render requires so it stays alive
python -m http.server $PORT
