import os
from ultralytics import YOLO

def train():
    print("Starting YOLOv8n detector training for dog noses...")
    
    # We start with the nano model for speed and efficiency
    model = YOLO("yolov8n.pt")
    
    # The dataset path (assumed to be mounted on Colab or uploaded)
    data_yaml = os.getenv("DETECTOR_DATA_YAML", "dataset/data.yaml")
    
    if not os.path.exists(data_yaml):
        print(f"Warning: {data_yaml} not found. Ensure dataset is available when running on Colab.")
        
    # Train the model with hyperparameters optimized for robust detection
    results = model.train(
        data=data_yaml,
        epochs=100,
        imgsz=640,
        batch=16,
        name="dog_nose_detector",
        device="0" # Assumes GPU is available on Colab
    )
    
    print(f"Training complete. Weights saved to: {results.save_dir}")

if __name__ == "__main__":
    train()
