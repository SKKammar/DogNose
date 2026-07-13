import os
import logging
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
import jwt
from jwt.exceptions import PyJWTError

logger = logging.getLogger(__name__)

security = HTTPBearer()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")


def get_service_supabase() -> Client:
    """
    Returns a Supabase client using the service role key.
    This client bypasses Row Level Security — use only for server-side operations
    where the backend needs to insert/query on behalf of a verified user.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase service role configuration missing")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_supabase(credentials: HTTPAuthorizationCredentials = Security(security)) -> Client:
    """
    Returns a Supabase client authenticated with the user's JWT token.
    Uses the anon key for client creation, then sets the user's token for RLS.
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    supabase.postgrest.auth(credentials.credentials)
    return supabase


def get_anon_supabase() -> Client:
    """Returns an unauthenticated Supabase client (anon key only)."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    return create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def verify_jwt(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """
    Verify the Supabase JWT locally using the JWT secret.
    Returns the user_id (sub claim) if valid.
    This avoids a round-trip to Supabase for every authenticated request.
    """
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        logger.warning(f"JWT Header: {header}")
        
        # PyJWT syntax
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256", "RS256", "HS512"],
            audience="authenticated",
            options={"verify_signature": True, "verify_audience": False}
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user ID")
        return user_id
    except PyJWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def get_current_user_id(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """
    Dependency that extracts and returns the authenticated user's ID from their JWT.
    Use this in route handlers that need the user_id.
    """
    return verify_jwt(credentials)
