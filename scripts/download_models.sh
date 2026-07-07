#!/bin/bash

# Ensure models directory exists
mkdir -p models

# Define base URL for the release assets
RELEASE_TAG="v0.1.0-models"
BASE_URL="https://github.com/SKKammar/DogNose/releases/download/${RELEASE_TAG}"

echo "Downloading ONNX models..."

# Download detector
if [ ! -f "models/detector.onnx" ]; then
    echo "Downloading detector.onnx..."
    curl -L -o models/detector.onnx "${BASE_URL}/detector.onnx"
else
    echo "models/detector.onnx already exists. Skipping."
fi

# Download embedder
if [ ! -f "models/embedder.onnx" ]; then
    echo "Downloading embedder.onnx..."
    curl -L -o models/embedder.onnx "${BASE_URL}/embedder.onnx"
else
    echo "models/embedder.onnx already exists. Skipping."
fi

echo "Model download complete."
