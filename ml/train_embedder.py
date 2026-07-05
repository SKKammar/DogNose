import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import timm
import cv2
import math
import numpy as np
import torch.nn.functional as F

# Import our shared preprocessing routines
from preprocessing import apply_clahe, remove_glare

class ArcFace(nn.Module):
    def __init__(self, in_features, out_features, s=30.0, m=0.50):
        super(ArcFace, self).__init__()
        self.in_features = in_features
        self.out_features = out_features
        self.s = s
        self.m = m
        self.weight = nn.Parameter(torch.FloatTensor(out_features, in_features))
        nn.init.xavier_uniform_(self.weight)
        
        self.cos_m = math.cos(m)
        self.sin_m = math.sin(m)
        self.th = math.cos(math.pi - m)
        self.mm = math.sin(math.pi - m) * m

    def forward(self, input, label):
        cosine = F.linear(F.normalize(input), F.normalize(self.weight))
        sine = torch.sqrt(1.0 - torch.pow(cosine, 2))
        phi = cosine * self.cos_m - sine * self.sin_m
        phi = torch.where(cosine > self.th, phi, cosine - self.mm)
        
        one_hot = torch.zeros(cosine.size(), device=input.device)
        one_hot.scatter_(1, label.view(-1, 1).long(), 1)
        
        output = (one_hot * phi) + ((1.0 - one_hot) * cosine)
        output *= self.s
        return output

class NoseEmbedder(nn.Module):
    def __init__(self, num_classes):
        super(NoseEmbedder, self).__init__()
        # EfficientNet-B3 backbone, omitting the classification head
        self.backbone = timm.create_model('efficientnet_b3', pretrained=True, num_classes=0)
        
        # Output features from EfficientNet-B3 is 1536, mapping to 512 for the nose_print schema
        self.fc = nn.Linear(1536, 512)
        self.bn = nn.BatchNorm1d(512)
        
        self.arcface = ArcFace(in_features=512, out_features=num_classes)
        
    def forward(self, x, labels=None):
        features = self.backbone(x)
        embeddings = self.bn(self.fc(features))
        
        if labels is not None:
            # Training mode: return ArcFace logits
            return self.arcface(embeddings, labels)
        else:
            # Inference mode: return normalized embeddings
            return F.normalize(embeddings, p=2, dim=1)

class DogNoseDataset(Dataset):
    """
    Dataset loader enforcing that the PyTorch training pipeline uses the exact 
    same preprocessing logic as the FastAPI inference pipeline.
    """
    def __init__(self, image_paths, labels):
        self.image_paths = image_paths
        self.labels = labels

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        img = cv2.imread(self.image_paths[idx])
        
        # Crucial: Apply the same preprocessing steps explicitly
        img_no_glare = remove_glare(img)
        img_clahe = apply_clahe(img_no_glare)
        img_filtered = cv2.bilateralFilter(img_clahe, d=9, sigmaColor=75, sigmaSpace=75)
        img_resized = cv2.resize(img_filtered, (224, 224))
        
        img_float = img_resized.astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        img_normalized = (img_float - mean) / std
        
        tensor_img = torch.from_numpy(img_normalized).permute(2, 0, 1)
        return tensor_img, self.labels[idx]

def train():
    print("Starting embedder training with EfficientNet-B3 + ArcFace...")
    # This is a scaffold for the Colab execution. The user will populate dataloaders
    # dataset = DogNoseDataset(image_paths, labels)
    # dataloader = DataLoader(dataset, batch_size=32, shuffle=True)
    # ...
    print("Setup complete. Ready for Kaggle/Colab execution.")
    
if __name__ == "__main__":
    train()
