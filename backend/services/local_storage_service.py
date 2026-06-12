import os
from settings import LOCAL_UPLOAD_DIR

class LocalStorageService:
    def __init__(self):
        self.upload_dir = LOCAL_UPLOAD_DIR
        
    def save_file(self, file_bytes: bytes, subfolder: str, filename: str) -> str:
        """
        Saves file bytes to disk under LOCAL_UPLOAD_DIR/subfolder/filename.
        Creates parent directories if they do not exist.
        Returns the relative URL path starting with /uploads.
        """
        # Ensure directories exist
        target_dir = os.path.join(self.upload_dir, subfolder)
        os.makedirs(target_dir, exist_ok=True)
        
        # Save file
        file_path = os.path.join(target_dir, filename)
        with open(file_path, "wb") as f:
            f.write(file_bytes)
            
        # Return relative URL path serving format
        return f"/uploads/{subfolder}/{filename}"
        
    def get_file_path(self, relative_path: str) -> str:
        """
        Given a relative URL path (e.g. /uploads/audio/... or uploads/audio/...),
        returns the absolute filesystem path on the local disk.
        """
        # Normalize relative path (remove leading slash)
        rel_path = relative_path.lstrip("/")
        
        # If relative path starts with "uploads/", strip it to resolve within upload_dir
        if rel_path.startswith("uploads/"):
            rel_path = rel_path[len("uploads/"):]
            
        return os.path.abspath(os.path.join(self.upload_dir, rel_path))
