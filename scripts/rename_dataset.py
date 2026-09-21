import os
from pathlib import Path

dest_dir = Path(r"Z:\Santu\IntelliJ\DoGNose\dataset_cropped")

def rename_dataset():
    if not dest_dir.exists():
        print(f"Dataset directory not found: {dest_dir}")
        return

    print(f"Renaming images in {dest_dir}...")
    for dog_dir in dest_dir.iterdir():
        if not dog_dir.is_dir():
            continue
            
        images = []
        for p in dog_dir.iterdir():
            if p.is_file() and p.suffix.lower() in ['.jpg', '.jpeg', '.png']:
                images.append(p)
        
        # Sort images to maintain a consistent order
        images.sort()
        
        # Step 1: Rename all to a temporary name to avoid ANY naming collisions
        temp_paths = []
        for idx, img_path in enumerate(images, start=1):
            temp_name = f"temp_rename_{idx:03d}{img_path.suffix.lower()}"
            temp_path = dog_dir / temp_name
            img_path.rename(temp_path)
            temp_paths.append(temp_path)
            
        # Step 2: Rename from temporary names to final names (e.g., image_01.jpg)
        for idx, temp_path in enumerate(temp_paths, start=1):
            final_name = f"image_{idx:02d}{temp_path.suffix.lower()}"
            final_path = dog_dir / final_name
            temp_path.rename(final_path)

    print("All files have been successfully renamed to image_01, image_02, etc.")

if __name__ == "__main__":
    rename_dataset()
