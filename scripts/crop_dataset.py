# Local-only script: update these paths if you move the project.
import os
import cv2
from ultralytics import YOLO
from pathlib import Path

# Paths
source_dir = Path(r"Z:\Santu\IntelliJ\DoGNose\dataset")
dest_dir = Path(r"Z:\Santu\IntelliJ\DoGNose\dataset_cropped")
model_path = r"Z:\Santu\IntelliJ\DoGNose\best.pt"

def crop_dataset():
    print(f"Loading model from {model_path}...")
    model = YOLO(model_path)
    
    if not dest_dir.exists():
        dest_dir.mkdir(parents=True)
        
    processed = 0
    skipped = 0
    
    print(f"Scanning dataset in {source_dir}...")
    for dog_dir in source_dir.iterdir():
        if not dog_dir.is_dir():
            continue
            
        print(f"Processing {dog_dir.name}...")
        dest_dog_dir = dest_dir / dog_dir.name
        if not dest_dog_dir.exists():
            dest_dog_dir.mkdir(parents=True)
            
        for img_path in dog_dir.iterdir():
            if img_path.suffix.lower() not in ['.jpg', '.jpeg', '.png']:
                continue
                
            img = cv2.imread(str(img_path))
            if img is None:
                print(f"Warning: could not read {img_path}")
                continue
                
            # Run inference
            results = model(img, verbose=False, conf=0.45)
            
            all_boxes = []
            for result in results:
                if result.boxes is not None and len(result.boxes) > 0:
                    confs = result.boxes.conf.cpu().numpy()
                    boxes = result.boxes.xyxy.cpu().numpy()
                    for box, conf in zip(boxes, confs):
                        all_boxes.append((conf, box))
            
            if not all_boxes:
                print(f"  -> No nose detected in {img_path.name}. Skipping.")
                skipped += 1
                continue
                
            # Get best box
            _, best_box = max(all_boxes, key=lambda x: x[0])
            x1, y1, x2, y2 = map(int, best_box)
            
            # Crop
            h, w = img.shape[:2]
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            
            # Additional check just in case crop is invalid
            if x2 <= x1 or y2 <= y1:
                print(f"  -> Invalid crop dimensions for {img_path.name}. Skipping.")
                skipped += 1
                continue
                
            cropped = img[y1:y2, x1:x2]
            
            dest_img_path = dest_dog_dir / img_path.name
            cv2.imwrite(str(dest_img_path), cropped)
            processed += 1
            
    print(f"Finished processing. Cropped {processed} images. Skipped {skipped} images.")
    print(f"Your cropped dataset is ready at: {dest_dir}")

if __name__ == "__main__":
    crop_dataset()
