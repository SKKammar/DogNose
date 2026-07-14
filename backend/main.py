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
logging.getLogger("uvicorn").setLevel(logging.DEBUG)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup lifespan: load ONNX models once into memory.
    Models are loaded via the inference module's init_models().
    """
    from services.inference import init_models, models_ready

    logger.info("Starting model initialization...")
    init_models()

    if models_ready():
        logger.info("All ONNX models loaded successfully. Inference enabled.")
    else:
        logger.error("Some ONNX models failed to load. Inference endpoints will return 503.")

    yield

    logger.info("Shutting down — releasing model resources.")


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="CANID API",
    description="Dog nose-print biometric identification backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS MUST be first
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)



# Import and include routers
from routers import dogs  # noqa: E402

app.include_router(dogs.router)


@app.middleware("http")
async def check_models_for_inference(request: Request, call_next):
    """
    Middleware that blocks inference endpoints if ML models are not loaded.
    Returns 503 with a helpful message for the frontend to display.
    """
    from services.inference import models_ready

    inference_routes = ["/dogs/identify", "/enroll"]
    path = request.url.path
    if any(route in path for route in inference_routes) and request.method == "POST":
        if not models_ready():
            return JSONResponse(
                status_code=503,
                content={
                    "detail": "ML models are currently unavailable. The server may still be starting up."
                },
            )
    response = await call_next(request)
    return response


@app.get("/health")
def health_check():
    """Health check endpoint for Render. Returns model readiness status."""
    from services.inference import models_ready

    return {"status": "ok", "models_loaded": models_ready()}
