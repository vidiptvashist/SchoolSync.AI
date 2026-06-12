from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
from jose import jwt
from settings import SECRET_KEY, ALGORITHM

# Default token expiration set to 24 hours
ACCESS_TOKEN_EXPIRE_HOURS = 24

def get_password_hash(password: str) -> str:
    """
    Hashes a plain text password using standard bcrypt.
    """
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies that a plain text password matches its hashed representation.
    """
    try:
        plain_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Encodes custom data claims along with an expiration claim ('exp') into a JWT.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    
    # Store expiration claim as a Unix timestamp (required by standard JWT validation)
    to_encode.update({"exp": int(expire.timestamp())})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
