# SchoolSync.AI

AI-powered school communication platform — voice calls, text chat, and campaign broadcasting for seamless parent-school interaction.

## Quick Start

```bash
# Start all services (backend + frontend + voice agent)
chmod +x run.sh && ./run.sh
```

## Structure

```
├── backend/       # FastAPI + LiveKit voice agent + campaign worker
├── frontend/      # Next.js dashboard (school admin + super admin)
└── run.sh         # One-command launcher
```