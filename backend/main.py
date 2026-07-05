import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DETECTOR_MODEL_PATH = os.getenv("DETECTOR_MODEL_PATH", "models/detector.onnx")
EMBEDDER_MODEL_PATH = os.getenv("EMBEDDER_MODEL_PATH", "models/embedder.onnx")

MODELS_LOADED = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    global MODELS_LOADED
    detector_exists = os.path.exists(DETECTOR_MODEL_PATH)
    embedder_exists = os.path.exists(EMBEDDER_MODEL_PATH)
    
    if not detector_exists or not embedder_exists:
        logger.error(f"Missing ONNX models. Detector: {detector_exists}, Embedder: {embedder_exists}")
        logger.error("Inference endpoints will return 503 Service Unavailable.")
        MODELS_LOADED = False
    else:
        logger.info("ONNX models found. Inference enabled.")
        MODELS_LOADED = True
        
    yield

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers after app creation to avoid circular deps if needed
from backend.routers import dogs
app.include_router(dogs.router)

@app.middleware("http")
async def check_models_for_inference(request: Request, call_next):
    inference_routes = ["/dogs/identify", "/enroll"]
    path = request.url.path
    if any(route in path for route in inference_routes) and request.method == "POST":
        if not MODELS_LOADED:
            return JSONResponse(
                status_code=503,
                content={"detail": "ML models are currently unavailable. Inference cannot be performed."}
            )
    response = await call_next(request)
    return response

@app.get("/health")
def health_check():
    return {"status": "ok", "inference_ready": MODELS_LOADED}
