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
    Startup lifespan: pre-load all ML models into memory.
    Models loaded: COCO dog detector, custom nose detector (best.pt),
    and MegaDescriptor embedder.
    """
    from services.inference import init_models, models_ready

    logger.info("Starting DogNose backend...")
    init_models()

    if models_ready():
        logger.info("All ML models loaded successfully. Inference enabled.")
    else:
        logger.error("Some ML models failed to load. Inference endpoints will return 503.")

    yield

    logger.info("Shutting down.")


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="CANID API",
    description="Dog nose-print biometric identification backend",
    version="2.0.0",
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


# --- Structured exception handlers ---

from services.validator import ImageValidationError


@app.exception_handler(ImageValidationError)
async def validation_error_handler(request: Request, exc: ImageValidationError):
    """Return structured 422 for image validation failures."""
    return JSONResponse(
        status_code=422,
        content={
            "error": True,
            "code": exc.code,
            "message": exc.message
        }
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    """Return structured 400 for bad input (e.g. undecodable image)."""
    return JSONResponse(
        status_code=400,
        content={
            "error": True,
            "code": "BAD_INPUT",
            "message": str(exc)
        }
    )


# Import and include routers
from routers import dogs, stats, validate, report  # noqa: E402

app.include_router(dogs.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(validate.router, prefix="/api")
app.include_router(report.router, prefix="/api")


@app.middleware("http")
async def check_models_for_inference(request: Request, call_next):
    """
    Middleware that blocks inference endpoints if ML models are not loaded.
    Returns 503 with a helpful message for the frontend to display.
    """
    from services.inference import models_ready

    inference_routes = ["/dogs/identify", "/enroll", "/validate-nose"]
    path = request.url.path
    if any(route in path for route in inference_routes) and request.method == "POST":
        if not models_ready():
            return JSONResponse(
                status_code=503,
                content={
                    "error": True,
                    "code": "MODELS_LOADING",
                    "message": "ML models are currently unavailable. The server may still be starting up."
                },
            )
    response = await call_next(request)
    return response


@app.get("/health")
def health_check():
    """Health check endpoint for Render. Returns model readiness status."""
    from services.inference import models_ready

    return {"status": "ok", "models_loaded": models_ready()}
