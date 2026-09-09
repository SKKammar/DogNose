"""
DogNose inference module.

Embedder: MegaDescriptor-EfficientNetB3 (BVRA/MegaDescriptor-T-CNN-288).
Fine-tuned on 29 animal re-identification datasets with ArcFace loss.
Output: 1536-dimensional L2-normalized embedding.

Nose Detector: Custom YOLOv8n (best.pt) for nose localization.
"""
import os

os.environ["HF_HOME"] = os.path.join(os.path.dirname(__file__), ".hf_cache")
import logging

import cv2
import numpy as np
import timm
import torch
import torch.nn.functional as F
import torchvision.transforms as T
from PIL import Image
from ultralytics import YOLO

logger = logging.getLogger(__name__)

# --- Embedder configuration ---
EMBEDDING_DIM = 1536
MODEL_HF_ID = "hf-hub:BVRA/MegaDescriptor-T-CNN-288"
INPUT_SIZE = 288

# --- Nose detector configuration ---
NOSE_MODEL_PATH = os.getenv("NOSE_MODEL_PATH", "../best.pt")

# Module-level model holders (initialized by init_models)
_embedder_model = None
_embedder_transforms = None
_nose_detector: YOLO | None = None


def _load_embedder():
    """Load MegaDescriptor embedder model and transforms."""
    global _embedder_model, _embedder_transforms
    if _embedder_model is None:
        logger.info(f"Loading embedder model: {MODEL_HF_ID} ...")
        
        # PyTorch 2.6+ defaults weights_only=True, blocking legacy numpy objects in checkpoint
        orig_load = torch.load
        def _compat_load(*args, **kwargs):
            if "weights_only" in kwargs:
                kwargs["weights_only"] = False
            return orig_load(*args, **kwargs)

        try:
            torch.load = _compat_load
            _embedder_model = timm.create_model(MODEL_HF_ID, num_classes=0, pretrained=True)
        finally:
            torch.load = orig_load

        _embedder_model.eval()
        _embedder_transforms = T.Compose([
            T.Resize((INPUT_SIZE, INPUT_SIZE)),
            T.ToTensor(),
            T.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
        logger.info("Embedder model ready.")


def _load_nose_detector():
    """Load custom YOLO nose detector (best.pt)."""
    global _nose_detector
    if _nose_detector is None:
        model_path = NOSE_MODEL_PATH
        if not os.path.exists(model_path):
            raise RuntimeError(f"Nose detector not found at '{model_path}'. Set NOSE_MODEL_PATH env var to the correct absolute path on Render.")

        logger.info(f"Loading nose detector model from {model_path}...")
        _nose_detector = YOLO(model_path)
        logger.info("Nose detector model loaded successfully.")


def init_models():
    """
    Initialize all ML models. Called once during app startup (lifespan).
    Pre-loads: COCO dog detector, custom nose detector, and MegaDescriptor embedder.
    """
    import time

    from services.validator import _get_coco_model

    logger.info("Starting model initialization...")
    
    clahe_enabled = os.getenv("ENABLE_CLAHE", "false").lower() == "true"
    logger.info(f"Nose preprocessing (CLAHE): {'enabled' if clahe_enabled else 'disabled'}")

    # 1. COCO dog detection model (auto-downloads yolov8n.pt)
    try:
        _get_coco_model()
        logger.info("COCO dog-detection model loaded.")
    except Exception as e:
        logger.error(f"Failed to load COCO model: {e}")

    # 2. Custom nose detector (best.pt)
    try:
        _load_nose_detector()
    except Exception as e:
        logger.error(f"Failed to load nose detector: {e}")

    # 3. MegaDescriptor embedder
    try:
        _load_embedder()
        # Warmup with a dummy image
        dummy = np.zeros((100, 100, 3), dtype=np.uint8)
        start_t = time.time()
        embedding = get_embedding(dummy)
        elapsed_ms = int((time.time() - start_t) * 1000)
        logger.info(f"Embedder warmup complete in {elapsed_ms}ms — embedding shape: {embedding.shape}")
    except Exception as e:
        logger.error(f"Failed to load embedder: {e}")


def models_ready() -> bool:
    """Check if all required models are loaded and ready for inference."""
    return _embedder_model is not None and _nose_detector is not None


def get_nose_detector() -> YOLO:
    """Return the loaded nose detector YOLO model."""
    if _nose_detector is None:
        raise RuntimeError("Nose detector model not loaded. Call init_models() first.")
    return _nose_detector


# --- Image preprocessing ---

def _preprocess_nose(nose_bgr: np.ndarray) -> np.ndarray:
    """
    Applies CLAHE + bilateral filter to enhance nose ridge details.
    Run BEFORE the neural network transform.
    """
    # CLAHE on L channel (sharpens ridge texture)
    lab = cv2.cvtColor(nose_bgr, cv2.COLOR_BGR2LAB)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    lab[:, :, 0] = clahe.apply(lab[:, :, 0])
    enhanced = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

    # Bilateral filter (smooth noise, keep edges)
    filtered = cv2.bilateralFilter(enhanced, d=9, sigmaColor=75, sigmaSpace=75)
    return filtered


# --- Embedding extraction ---

def get_embedding(nose_crop_bgr: np.ndarray) -> np.ndarray:
    """
    Takes a BGR numpy array (cropped nose region).
    Returns a 1536-dim L2-normalized numpy array (float32).

    This function is stateless — safe to call from multiple requests.
    """
    if not isinstance(nose_crop_bgr, np.ndarray) or nose_crop_bgr.ndim != 3 or min(nose_crop_bgr.shape) == 0:
        raise ValueError(f"Invalid nose crop shape: {getattr(nose_crop_bgr,'shape','unknown')}. Expected (H, W, 3) BGR.")

    if _embedder_model is None or _embedder_transforms is None:
        raise RuntimeError("Embedder model not loaded. Call init_models() first.")

    # Enhance nose texture if enabled
    if os.getenv("ENABLE_CLAHE", "false").lower() == "true":
        processed = _preprocess_nose(nose_crop_bgr)
    else:
        processed = nose_crop_bgr

    # BGR → RGB → PIL
    rgb = cv2.cvtColor(processed, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)

    # Transform
    tensor = _embedder_transforms(pil_img).unsqueeze(0)  # (1, 3, 288, 288)

    # Inference (no gradient, stateless)
    with torch.no_grad():
        embedding = _embedder_model(tensor)                       # (1, 1536)
        embedding = F.normalize(embedding, p=2, dim=1)            # L2 normalize

    return embedding.squeeze(0).cpu().numpy().astype(np.float32)  # (1536,)
