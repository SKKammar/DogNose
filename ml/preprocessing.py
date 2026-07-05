import cv2
import numpy as np

def remove_glare(img: np.ndarray) -> np.ndarray:
    """
    HSV-based glare and specular highlight detection + inpainting.
    """
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    # Define range for bright highlights (low saturation, high value)
    lower_bound = np.array([0, 0, 200])
    upper_bound = np.array([179, 50, 255])
    
    # Create mask for glare
    mask = cv2.inRange(hsv, lower_bound, upper_bound)
    
    # Dilate mask slightly to cover edges of glare
    kernel = np.ones((3,3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=1)
    
    # Inpaint the original image using the mask
    inpainted = cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)
    return inpainted

def apply_clahe(img: np.ndarray) -> np.ndarray:
    """
    Apply Contrast Limited Adaptive Histogram Equalization (CLAHE) to the LAB color space.
    """
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_channel, a, b = cv2.split(lab)
    
    # Apply CLAHE to L-channel
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    cl = clahe.apply(l_channel)
    
    # Merge back and convert to BGR
    limg = cv2.merge((cl, a, b))
    result = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    return result

def preprocess_image(img: np.ndarray, target_size=(224, 224)) -> np.ndarray:
    """
    Core image preprocessing pipeline shared between training and backend inference.
    1. Glare removal (inpainting)
    2. CLAHE (Contrast enhancement)
    3. Bilateral Filter (Noise reduction while preserving edges)
    4. Resize
    5. Normalization for EfficientNet-B3 (NCHW format)
    """
    if img is None:
        raise ValueError("Invalid image")
        
    # 1. Remove glare
    img_no_glare = remove_glare(img)
    
    # 2. Apply CLAHE
    img_clahe = apply_clahe(img_no_glare)
    
    # 3. Apply Bilateral Filter (preserves edges like the nose ridges, reduces noise)
    img_filtered = cv2.bilateralFilter(img_clahe, d=9, sigmaColor=75, sigmaSpace=75)
    
    # 4. Resize to target dimension for EfficientNet-B3 (usually 224x224)
    img_resized = cv2.resize(img_filtered, target_size)
    
    # 5. Normalize (standard ImageNet means and stds for timm models)
    img_float = img_resized.astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    img_normalized = (img_float - mean) / std
    
    # Format to NCHW for PyTorch/ONNX
    blob = np.transpose(img_normalized, (2, 0, 1))
    blob = np.expand_dims(blob, axis=0)
    
    return blob
