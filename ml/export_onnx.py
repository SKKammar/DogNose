import os
import torch
from ultralytics import YOLO
from train_embedder import NoseEmbedder

import shutil

def export_detector():
    print("Exporting YOLOv8n detector to ONNX...")
    model_path = "best.pt"
    if not os.path.exists(model_path):
        print(f"Skipping detector export: {model_path} not found.")
        return
        
    model = YOLO(model_path)
    exported_path = model.export(format="onnx", imgsz=640, dynamic=True, opset=14)
    
    # Move the exported model to models/detector.onnx
    os.makedirs("models", exist_ok=True)
    shutil.move(exported_path, "models/detector.onnx")
    print("Detector exported to ONNX successfully.")

def export_embedder():
    print("Exporting EfficientNet-B3 embedder to ONNX...")
    embedder_path = "best_embedder.pt"
    if not os.path.exists(embedder_path):
        print(f"Skipping embedder export: {embedder_path} not found.")
        return
        
    # We initialize with a dummy num_classes just to load the state dict
    model = NoseEmbedder(num_classes=2) 
    model.load_state_dict(torch.load(embedder_path, map_location="cpu"))
    model.eval()
    
    # 1 batch, 3 channels, 224x224 (as defined in our preprocessing)
    dummy_input = torch.randn(1, 3, 224, 224)
    
    torch.onnx.export(
        model,
        (dummy_input,), # labels=None for inference path
        "models/embedder.onnx",
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=['input'],
        output_names=['embedding'],
        dynamic_axes={'input': {0: 'batch_size'}, 'embedding': {0: 'batch_size'}}
    )
    print("Embedder exported to ONNX successfully.")

if __name__ == "__main__":
    # Ensure models directory exists for the ONNX exports
    os.makedirs("models", exist_ok=True)
    export_detector()
    export_embedder()
