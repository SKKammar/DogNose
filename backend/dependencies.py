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
# Build the JWKS URL from your Supabase URL
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
jwks_client = jwt.PyJWKClient(JWKS_URL)


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
    token = credentials.credentials
    try:
        # Fetch the matching public key based on the token's 'kid'
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256", "HS256", "HS512"],
            audience="authenticated",
            options={"verify_audience": False}  # skip audience check if needed
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token: missing user ID")
        return user_id
    except Exception as e:
        logger.error(f"JWT verification failed with exception: {str(e)}", exc_info=True)
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def get_current_user_id(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """
    Dependency that extracts and returns the authenticated user's ID from their JWT.
    Use this in route handlers that need the user_id.
    """
    return verify_jwt(credentials)
