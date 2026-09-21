import torch
import torch.nn.functional as F
import timm
from pathlib import Path

class NormalizedModel(torch.nn.Module):
    """Wraps a timm backbone to L2-normalize its output."""
    def __init__(self, backbone):
        super().__init__()
        self.backbone = backbone

    def forward(self, x):
        return F.normalize(self.backbone(x), dim=1)


class NoseEmbedder:
    """
    Loads the fine-tuned MegaDescriptor-T-CNN-288 model and produces
    L2-normalized 1536-d embeddings for dog nose crops.

    Input:  PIL image or tensor of shape [B, 3, 288, 288] (RGB, ImageNet-normalized)
    Output: torch.Tensor of shape [B, 1536], unit-norm
    """

    MODEL_NAME = "hf-hub:BVRA/MegaDescriptor-T-CNN-288"
    EMBEDDING_DIM = 1536
    INPUT_SIZE = 288

    # ImageNet normalization stats (match training)
    MEAN = [0.485, 0.456, 0.406]
    STD  = [0.229, 0.224, 0.225]

    def __init__(self, weights_path: str, device: str | None = None):
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        weights_path = Path(weights_path)

        if not weights_path.exists():
            raise FileNotFoundError(f"Fine-tuned weights not found: {weights_path}")

        # Build architecture WITHOUT downloading pretrained weights
        raw = timm.create_model(self.MODEL_NAME, num_classes=0, pretrained=False)

        # Wrap FIRST (checkpoint keys are prefixed with 'backbone.')
        model = NormalizedModel(raw)

        # Load fine-tuned state
        state = torch.load(
            str(weights_path),
            map_location="cpu",
            weights_only=False,   # required — see warning above
        )
        model.load_state_dict(state)

        self.model = model.to(self.device).eval()
        self._verify()

    def _verify(self):
        """Sanity check: embedding shape and unit norm."""
        with torch.no_grad():
            dummy = torch.randn(1, 3, self.INPUT_SIZE, self.INPUT_SIZE).to(self.device)
            out = self.model(dummy)
        assert out.shape == (1, self.EMBEDDING_DIM), f"Unexpected shape: {out.shape}"
        norm = out.norm(dim=1).item()
        assert abs(norm - 1.0) < 1e-3, f"Embedding norm is {norm}, expected 1.0"

    @torch.no_grad()
    def embed(self, batch: torch.Tensor) -> torch.Tensor:
        """batch: [B, 3, 288, 288] on any device. Returns [B, 1536] on CPU."""
        return self.model(batch.to(self.device)).cpu()
