import os
import numpy as np
import cv2
import onnxruntime as ort
from ml.preprocessing import preprocess_image

DETECTOR_MODEL_PATH = os.getenv("DETECTOR_MODEL_PATH", "models/detector.onnx")
EMBEDDER_MODEL_PATH = os.getenv("EMBEDDER_MODEL_PATH", "models/embedder.onnx")

detector_session = None
embedder_session = None

def init_models():
    global detector_session, embedder_session
    if os.path.exists(DETECTOR_MODEL_PATH) and os.path.exists(EMBEDDER_MODEL_PATH):
        if detector_session is None:
            detector_session = ort.InferenceSession(DETECTOR_MODEL_PATH)
        if embedder_session is None:
            embedder_session = ort.InferenceSession(EMBEDDER_MODEL_PATH)

def extract_embedding(image_bytes: bytes) -> np.ndarray:
    init_models()
    if not detector_session or not embedder_session:
        raise RuntimeError("ONNX Models are not loaded. Inference cannot proceed.")

    # 1. Decode image
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image provided")
        
    # 2. Run detection (YOLOv8n)
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
        
        # Convert [x_center, y_center, width, height] to [x, y, w, h] for OpenCV NMS
        nms_boxes = []
        for xc, yc, w, h in boxes:
            nms_boxes.append([xc - w/2, yc - h/2, w, h])
            
        indices = cv2.dnn.NMSBoxes(nms_boxes, scores.tolist(), conf_threshold, 0.4)
        num_noses = len(indices) if indices is not None else 0
        
        if num_noses == 0:
            raise ValueError("NO_NOSE: No nose detected, please try again with a clearer photo.")
        elif num_noses > 1:
            raise ValueError("MULTIPLE_NOSES: Multiple dogs detected. Please ensure only one dog is in the photo.")
            
        idx = indices[0]
        if isinstance(idx, (list, np.ndarray)):
            idx = idx[0]
            
        x, y, w, h = nms_boxes[idx]
        
        # Map back to original image size
        orig_h, orig_w = img.shape[:2]
        x1 = int(max(0, x) * orig_w / 640)
        y1 = int(max(0, y) * orig_h / 640)
        x2 = int(min(640, x + w) * orig_w / 640)
        y2 = int(min(640, y + h) * orig_h / 640)
        
        cropped_nose = img[y1:y2, x1:x2]
        if cropped_nose.size == 0:
            raise ValueError("NO_NOSE: Invalid crop area.")
    else:
        cropped_nose = img 
    
    # 3. Preprocess exactly as in training
    processed_nose = preprocess_image(cropped_nose)
    
    # 4. Embedder inference
    emb_inputs = {embedder_session.get_inputs()[0].name: processed_nose}
    emb_outputs = embedder_session.run(None, emb_inputs)
    
    # Assuming output is [1, 512]
    embedding = emb_outputs[0].flatten()
    return embedding

def match_embedding(supabase_client, embedding: np.ndarray):
    """
    Perform cosine similarity search against pgvector.
    Fallback to python computation since RLS filters to users own dogs, ensuring small N.
    """
    # Fetch user's registered nose prints (RLS ensures only theirs are fetched)
    response = supabase_client.table("nose_prints").select("dog_id, embedding").execute()
    records = response.data
    
    if not records:
        return None
        
    candidates = []
    for row in records:
        db_embedding = np.array(row["embedding"])
        sim = np.dot(embedding, db_embedding) / (np.linalg.norm(embedding) * np.linalg.norm(db_embedding))
        candidates.append({
            "dog_id": row["dog_id"],
            "confidence": float(sim)
        })
        
    candidates.sort(key=lambda x: x["confidence"], reverse=True)
    top_candidates = candidates[:3]
    
    if not top_candidates:
        return None
        
    return {
        "confidence": top_candidates[0]["confidence"],
        "candidates": top_candidates
    }
