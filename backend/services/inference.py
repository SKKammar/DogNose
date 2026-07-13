import os
import numpy as np
import cv2
import onnxruntime as ort
import logging

logger = logging.getLogger(__name__)

# Model paths — these are relative to the working directory (backend/ on Render)
DETECTOR_MODEL_PATH = os.getenv("DETECTOR_MODEL_PATH", "../models/detector.onnx")
EMBEDDER_MODEL_PATHS = {
    "v1": os.getenv("EMBEDDER_MODEL_PATH_V1", "../models/embedder.onnx"),
    # Add new versions here as they become available
    # "v2": os.getenv("EMBEDDER_MODEL_PATH_V2", "../models/embedder_v2.onnx"),
}

from typing import Optional

# Module-level session holders (initialized by main.py lifespan)
detector_session: Optional[ort.InferenceSession] = None
embedder_sessions: dict[str, ort.InferenceSession] = {}


def init_models():
    """
    Initialize ONNX model sessions. Called once during app startup.
    Stores sessions in module-level variables for reuse.
    """
    global detector_session, embedder_sessions

    cwd = os.getcwd()
    logger.info(f"App starting in directory: {cwd}")
    if os.path.exists("../models"):
        logger.info(f"Contents of ../models/: {os.listdir('../models')}")
    else:
        logger.error("Directory ../models/ not found!")

    if os.path.exists(DETECTOR_MODEL_PATH) and detector_session is None:
        logger.info(f"Loading detector model from {DETECTOR_MODEL_PATH}")
        detector_session = ort.InferenceSession(DETECTOR_MODEL_PATH)
        logger.info("Detector model loaded successfully")
    elif not os.path.exists(DETECTOR_MODEL_PATH):
        logger.error(f"Detector model not found at {DETECTOR_MODEL_PATH}")

    for version, path in EMBEDDER_MODEL_PATHS.items():
        if os.path.exists(path) and version not in embedder_sessions:
            logger.info(f"Loading embedder model v{version} from {path}")
            embedder_sessions[version] = ort.InferenceSession(path)
            logger.info(f"Embedder model v{version} loaded successfully")
        elif not os.path.exists(path):
            logger.error(f"Embedder model v{version} not found at {path}")


def models_ready() -> bool:
    """Check if all required models are loaded and ready for inference."""
    return detector_session is not None and len(embedder_sessions) > 0


# --- Preprocessing (inlined to avoid cross-package import issues on Render) ---

def _remove_glare(img: np.ndarray) -> np.ndarray:
    """HSV-based glare and specular highlight detection + inpainting."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lower_bound = np.array([0, 0, 200])
    upper_bound = np.array([179, 50, 255])
    mask = cv2.inRange(hsv, lower_bound, upper_bound)
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=1)
    inpainted = cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)
    return inpainted


def _apply_clahe(img: np.ndarray) -> np.ndarray:
    """Apply CLAHE to the LAB color space L-channel."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_channel, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l_channel)
    limg = cv2.merge((cl, a, b))
    result = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    return result


def _preprocess_image(img: np.ndarray, target_size=(224, 224)) -> np.ndarray:
    """
    Core image preprocessing pipeline matching training:
    1. Glare removal (inpainting)
    2. CLAHE (contrast enhancement)
    3. Bilateral filter (noise reduction while preserving edges)
    4. Resize to target_size
    5. Normalize with ImageNet mean/std → NCHW float32
    """
    if img is None:
        raise ValueError("Invalid image")

    img_no_glare = _remove_glare(img)
    img_clahe = _apply_clahe(img_no_glare)
    img_filtered = cv2.bilateralFilter(img_clahe, d=9, sigmaColor=75, sigmaSpace=75)
    img_resized = cv2.resize(img_filtered, target_size)

    img_float = img_resized.astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_normalized = (img_float - mean) / std

    blob = np.transpose(img_normalized, (2, 0, 1))
    blob = np.expand_dims(blob, axis=0)
    return blob


# --- Main inference pipeline ---

def extract_embedding(image_bytes: bytes, version: str) -> np.ndarray:
    """
    Full ML pipeline: detect nose → crop → preprocess → embed → L2 normalize.
    
    Args:
        image_bytes: Raw image bytes (JPEG/PNG/WEBP)
        version: Embedding model version (e.g., "v1")
    
    Returns:
        L2-normalized 512-dim embedding vector
        
    Raises:
        RuntimeError: If models are not loaded
        ValueError: If no nose detected or image is invalid
    """
    if not detector_session or version not in embedder_sessions:
        raise RuntimeError(f"ONNX models not loaded for version {version}. Inference cannot proceed.")

    embedder_session = embedder_sessions[version]

    # 1. Decode image
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image provided")

    # 2. Run YOLOv8n detection
    img_resized = cv2.resize(img, (640, 640))
    blob = img_resized.astype(np.float32) / 255.0
    blob = np.transpose(blob, (2, 0, 1))
    blob = np.expand_dims(blob, axis=0)

    det_inputs = {detector_session.get_inputs()[0].name: blob}
    det_outputs = detector_session.run(None, det_inputs)

    # Parse YOLOv8 outputs: [1, num_classes + 4, 8400]
    outputs = np.squeeze(det_outputs[0])

    if len(outputs.shape) == 2 and outputs.shape[0] >= 5:
        boxes = outputs[:4, :].T
        scores = outputs[4, :].T

        conf_threshold = 0.5
        mask = scores > conf_threshold
        boxes = boxes[mask]
        scores = scores[mask]

        # Convert [x_center, y_center, width, height] to [x, y, w, h] for NMS
        nms_boxes = []
        for xc, yc, w, h in boxes:
            nms_boxes.append([xc - w / 2, yc - h / 2, w, h])

        indices = cv2.dnn.NMSBoxes(nms_boxes, scores.tolist(), conf_threshold, 0.4)
        num_noses = len(indices) if indices is not None else 0

        if num_noses == 0:
            raise ValueError("no_nose_detected")

        # Take highest confidence detection
        best_idx = indices[0]
        if isinstance(best_idx, (list, np.ndarray)):
            best_idx = best_idx[0]

        x, y, w, h = nms_boxes[best_idx]

        # Map back to original image coordinates
        orig_h, orig_w = img.shape[:2]
        x1 = int(max(0, x) * orig_w / 640)
        y1 = int(max(0, y) * orig_h / 640)
        x2 = int(min(640, x + w) * orig_w / 640)
        y2 = int(min(640, y + h) * orig_h / 640)

        cropped_nose = img[y1:y2, x1:x2]
        if cropped_nose.size == 0:
            raise ValueError("no_nose_detected")
    else:
        # Fallback: use entire image if detection output format is unexpected
        cropped_nose = img

    # 3. Preprocess exactly as in training
    processed_nose = _preprocess_image(cropped_nose)

    # 4. Embedder inference
    emb_inputs = {embedder_session.get_inputs()[0].name: processed_nose}
    emb_outputs = embedder_session.run(None, emb_inputs)

    # Output shape: [1, 512]
    embedding = emb_outputs[0].flatten()

    # 5. L2 normalize
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    return embedding
