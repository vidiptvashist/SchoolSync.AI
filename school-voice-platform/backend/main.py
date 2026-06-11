from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from routers import auth, students, notices, campaigns, webhooks, voice, knowledge_base, erp, analytics, super_admin, chat

# Initialize the FastAPI App
app = FastAPI(
    title="School Voice AI Platform API",
    description="Multi-tenant backend for voice AI workflows in schools",
    version="0.1.0"
)

# Allowed origins for CORS (covers localhost, 127.0.0.1, and local network IPs)
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "http://192.168.29.26:3000",
    "http://192.168.29.26:3001",
    "http://192.168.29.26:3002",
]

# Configure CORS Middleware (must wrap the application)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware to debug incoming headers (e.g. Origin)
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("api_logger")

@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"=== Incoming Request: {request.method} {request.url.path} ===")
    logger.info(f"Headers: {dict(request.headers)}")
    response = await call_next(request)
    logger.info(f"=== Response Status: {response.status_code} ===")
    return response

# Register routers
app.include_router(auth.router)
app.include_router(students.router)
app.include_router(notices.router)
app.include_router(campaigns.router)
app.include_router(webhooks.router)
app.include_router(voice.router)
app.include_router(knowledge_base.router)
app.include_router(erp.router)
app.include_router(analytics.router)
app.include_router(super_admin.router)
app.include_router(chat.router)

# Ensure uploads directory exists and mount static files directory
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Root endpoint
@app.get("/")
def read_root():
    return {
        "message": "Welcome to the School Voice AI Platform API",
        "documentation": "/docs"
    }

# Simple health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy"}
