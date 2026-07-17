"""
Two-stage image validation for DogNose.
Stage 1: detect dog presence (COCO yolov8n).
Stage 2: detect nose (custom best.pt).
"""
import cv2
import numpy as np
from ultralytics import YOLO
from fastapi import UploadFile
import logging

logger = logging.getLogger(__name__)

DOG_CLASS_COCO = 16          # COCO class index for 'dog'
NOSE_CONF_THRESHOLD = 0.45   # Minimum confidence from best.pt
MIN_NOSE_AREA_RATIO = 0.005  # Nose must cover at least 0.5% of image area
BLUR_THRESHOLD = 45.0        # Laplacian variance below this = too blurry
MIN_BRIGHTNESS = 25          # Mean pixel value below this = too dark

_coco_model = None


def _get_coco_model() -> YOLO:
    """Lazily load and cache the COCO YOLOv8n model for dog detection."""
    global _coco_model
    if _coco_model is None:
        logger.info("Loading COCO dog-detection model (yolov8n.pt)...")
        _coco_model = YOLO("yolov8n.pt")  # auto-downloads on first run
        logger.info("COCO model loaded.")
    return _coco_model


class ImageValidationError(Exception):
    """Raised when an image fails pre-ML validation."""
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


def check_image_quality(image_bgr: np.ndarray) -> None:
    """
    Raises ImageValidationError if the image is too blurry or too dark.
    Call this FIRST before any model inference.
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    # Blur check
    blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if blur_score < BLUR_THRESHOLD:
        raise ImageValidationError(
            code="BLURRY",
            message=(
                "Image is too blurry. Please hold the camera steady and "
                "ensure the nose is in sharp focus before capturing."
            )
        )

    # Darkness check
    brightness = float(gray.mean())
    if brightness < MIN_BRIGHTNESS:
        raise ImageValidationError(
            code="DARK",
            message=(
                "Image is too dark. Please use better lighting — "
                "natural daylight or a bright indoor light works best."
            )
        )


def validate_dog_present(image_bgr: np.ndarray) -> None:
    """
    Stage 1: Uses COCO yolov8n to confirm a dog exists in the frame.
    Raises ImageValidationError if no dog found.
    """
    coco = _get_coco_model()
    results = coco(image_bgr, verbose=False, conf=0.30)

    found_dog = False
    for result in results:
        if result.boxes is not None and len(result.boxes) > 0:
            classes = result.boxes.cls.cpu().numpy().astype(int).tolist()
            if DOG_CLASS_COCO in classes:
                found_dog = True
                break

    if not found_dog:
        raise ImageValidationError(
            code="NOT_A_DOG",
            message=(
                "No dog detected in this image. Please upload a clear photo "
                "of your dog. Make sure the dog is the main subject."
            )
        )


def validate_nose_visible(nose_model: YOLO, image_bgr: np.ndarray) -> np.ndarray:
    """
    Stage 2: Uses custom best.pt to detect and crop the nose.
    Returns the cropped nose region (BGR numpy array) on success.
    Raises ImageValidationError if nose is absent, low-confidence, or too small.
    """
    h, w = image_bgr.shape[:2]
    image_area = h * w

    results = nose_model(image_bgr, verbose=False, conf=NOSE_CONF_THRESHOLD)

    all_boxes = []
    for result in results:
        if result.boxes is not None and len(result.boxes) > 0:
            confs = result.boxes.conf.cpu().numpy()
            boxes = result.boxes.xyxy.cpu().numpy()
            for box, conf in zip(boxes, confs):
                all_boxes.append((conf, box))

    if not all_boxes:
        raise ImageValidationError(
            code="NO_NOSE",
            message=(
                "Dog detected but nose not clearly visible. "
                "Point the camera directly at your dog's nose from about 15–25 cm away "
                "and ensure it fills most of the frame."
            )
        )

    # Pick highest-confidence detection
    best_conf, best_box = max(all_boxes, key=lambda x: x[0])
    x1, y1, x2, y2 = map(int, best_box)

    # Clamp to image bounds
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)

    nose_area = (x2 - x1) * (y2 - y1)
    if nose_area < image_area * MIN_NOSE_AREA_RATIO:
        raise ImageValidationError(
            code="NOSE_TOO_SMALL",
            message=(
                "Nose detected but too small in the frame. "
                "Please get closer — the nose should fill at least a quarter of the image."
            )
        )

    nose_crop = image_bgr[y1:y2, x1:x2]
    return nose_crop


def run_full_validation(nose_model: YOLO, image_bgr: np.ndarray) -> np.ndarray:
    """
    Runs all validation stages in order. Returns cropped nose on success.
    Raises ImageValidationError with a user-readable message on any failure.

    Usage in your API endpoint:
        try:
            nose_crop = run_full_validation(nose_model, image_array)
        except ImageValidationError as e:
            return JSONResponse(
                status_code=422,
                content={"error": True, "code": e.code, "message": e.message}
            )
    """
    check_image_quality(image_bgr)        # Quality first (fast, no ML)
    validate_dog_present(image_bgr)       # Stage 1: is there a dog?
    nose_crop = validate_nose_visible(nose_model, image_bgr)  # Stage 2: is nose visible?
    return nose_crop


async def read_upload_as_array(upload: UploadFile) -> np.ndarray:
    """
    Reads an uploaded file into a BGR numpy array.
    Does NOT write to disk — works entirely in memory.
    Raises ValueError if the bytes cannot be decoded as an image.
    """
    contents = await upload.read()
    if not contents:
        raise ValueError("Uploaded file is empty.")

    arr = np.frombuffer(contents, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)

    if image is None:
        raise ValueError(
            "Could not decode the uploaded file as an image. "
            "Please upload a JPEG or PNG photo."
        )

    # Reset the upload stream position for any retry logic
    await upload.seek(0)
    return image
