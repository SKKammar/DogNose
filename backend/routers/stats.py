from fastapi import APIRouter
from dependencies import get_service_supabase
from typing import Dict
import logging
from cachetools import cached, TTLCache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stats", tags=["stats"])

# Cache for 60 seconds
cache = TTLCache(maxsize=1, ttl=60)

@router.get("", response_model=Dict[str, int])
@cached(cache)
def get_stats():
    """
    Returns live registry statistics. Cached for 60 seconds.
    """
    supabase = get_service_supabase()
    
    try:
        # Count of registered dogs
        dogs_res = supabase.table("dogs").select("id", count="exact").limit(1).execute()
        registered_dogs = dogs_res.count if dogs_res.count is not None else 0
        
        # Count of matches made
        matches_res = supabase.table("scan_logs").select("id", count="exact").not_.is_("matched_dog_id", "null").limit(1).execute()
        matches_made = matches_res.count if matches_res.count is not None else 0
        
        # For reunites, we could just say it's proportional or the same as matches
        return {
            "registered_dogs": registered_dogs,
            "matches_made": matches_made,
            "owners_reunited": matches_made, # Simulating reunites as equal to matches for now
        }
    except Exception as e:
        logger.error(f"Failed to fetch stats: {e}")
        return {
            "registered_dogs": 0,
            "matches_made": 0,
            "owners_reunited": 0
        }
