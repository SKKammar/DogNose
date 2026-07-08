import pytest
import io
import numpy as np
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from backend.main import app
from backend.dependencies import get_supabase

client = TestClient(app)

def override_get_supabase():
    mock = MagicMock()
    mock_user = MagicMock()
    mock_user.user.id = "test-user-id"
    mock.auth.get_user.return_value = mock_user
    return mock

def override_security():
    mock = MagicMock()
    mock.credentials = "fake-token"
    return mock

from backend.dependencies import get_supabase, security
app.dependency_overrides[get_supabase] = override_get_supabase
app.dependency_overrides[security] = override_security

def test_register_dog_success():
    # Because we mocked auth.get_user(), it won't fail with 401.
    # To avoid 500 from the un-mocked DB insert, we can patch supabase.table().insert().execute()
    with patch("backend.routers.dogs.Depends") as mock_depends:
        # Instead of patching Depends which is complex, we just mock the db insert on the already mocked supabase client
        client.app.dependency_overrides[get_supabase]().table.return_value.insert.return_value.execute.return_value.data = [{"id": "new-dog-id", "name": "Rex", "breed": "GSD", "created_at": "2024-01-01T00:00:00Z"}]
        
    response = client.post("/dogs", json={"name": "Rex", "breed": "GSD"})
    assert response.status_code == 200
    assert response.json()["name"] == "Rex"

def test_file_validation_invalid_type():
    file_content = b"fake image content"
    file = io.BytesIO(file_content)
    
    response = client.post("/dogs/123/enroll", files={"file": ("test.txt", file, "text/plain")})
    assert response.status_code == 400
    assert "Invalid file type" in response.json()["detail"]

def test_file_validation_size_limit():
    # Max size is 8MB. Create 8.5MB.
    file_content = b"0" * int(8.5 * 1024 * 1024)
    file = io.BytesIO(file_content)
    
    response = client.post("/dogs/123/enroll", files={"file": ("test.jpg", file, "image/jpeg")})
    assert response.status_code == 400
    assert "too large" in response.json()["detail"].lower()

@patch("backend.routers.dogs.extract_embedding")
@patch("backend.routers.dogs.match_embedding")
def test_identify_no_match(mock_match, mock_extract):
    mock_extract.return_value = np.array([0.1, 0.2])
    # Threshold is configured as 0.65 in .env.example, mock match returning 0.5
    mock_match.return_value = {"confidence": 0.5, "candidates": [{"dog_id": "1", "confidence": 0.5}]}
    
    file_content = b"fake jpeg"
    file = io.BytesIO(file_content)
    
    response = client.post("/dogs/identify", files={"file": ("test.jpg", file, "image/jpeg")})
    assert response.status_code == 200
    assert response.json() == {"status": "no_match"}

@patch("backend.routers.dogs.extract_embedding")
@patch("backend.routers.dogs.match_embedding")
def test_identify_match(mock_match, mock_extract):
    mock_extract.return_value = np.array([0.1, 0.2])
    # Threshold is 0.65, so 0.85 is a match
    mock_match.return_value = {
        "confidence": 0.85, 
        "candidates": [
            {"dog_id": "d1", "confidence": 0.85},
            {"dog_id": "d2", "confidence": 0.7}
        ]
    }
    
    file_content = b"fake jpeg"
    file = io.BytesIO(file_content)
    
    response = client.post("/dogs/identify", files={"file": ("test.jpg", file, "image/jpeg")})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "match"
    assert data["confidence"] == 0.85
    assert len(data["candidates"]) == 2
