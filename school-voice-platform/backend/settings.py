import os
from dotenv import load_dotenv

# Load variables from the local .env file (reloaded-5)
load_dotenv()

# --- Database & Cache ---
DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# --- Exotel Credentials ---
EXOTEL_ACCOUNT_SID = os.getenv("EXOTEL_ACCOUNT_SID")
EXOTEL_API_KEY = os.getenv("EXOTEL_API_KEY")
EXOTEL_API_TOKEN = os.getenv("EXOTEL_API_TOKEN")
EXOTEL_REGION = os.getenv("EXOTEL_REGION")
EXOTEL_SUBDOMAIN = os.getenv("EXOTEL_SUBDOMAIN")
EXOTEL_CALLER_ID = os.getenv("EXOTEL_CALLER_ID")
EXOTEL_TEST_FROM = os.getenv("EXOTEL_TEST_FROM")
EXOTEL_APP_ID = os.getenv("EXOTEL_APP_ID")

# --- AI API Keys ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")

# --- LiveKit WebRTC ---
LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

# --- Qdrant Vector DB ---
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

# --- S3 Storage / Local Uploads ---
S3_BUCKET = os.getenv("S3_BUCKET")
S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY")
S3_SECRET_KEY = os.getenv("S3_SECRET_KEY")
S3_ENDPOINT = os.getenv("S3_ENDPOINT")
LOCAL_UPLOAD_DIR = os.getenv("LOCAL_UPLOAD_DIR", "uploads")
PUBLIC_URL = os.getenv("PUBLIC_URL", "http://localhost:8000")

# --- JWT Security ---
SECRET_KEY = os.getenv("SECRET_KEY", "fallbacksecretkeyforlocaltestingonly")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
