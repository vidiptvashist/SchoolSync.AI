import asyncio
import os
import sys

# Add backend root to path to ensure imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.tts_service import TTSService

async def test_audio_generation():
    print("Initializing TTSService...")
    tts = TTSService()
    
    text_to_speak = "नमस्ते, यह स्कूल वॉयस एआई प्लेटफॉर्म का एक परीक्षण संदेश है।"
    school_uuid = "00000000-0000-0000-0000-000000000001"
    notice_uuid = "00000000-0000-0000-0000-000000000002"
    
    print(f"Calling generate_audio with text: '{text_to_speak}'")
    try:
        relative_path = await tts.generate_audio(
            text=text_to_speak,
            school_id=school_uuid,
            notice_id=notice_uuid
        )
        print(f"Success! Relative path returned: {relative_path}")
        
        # Verify the file was written to disk
        from services.local_storage_service import LocalStorageService
        storage = LocalStorageService()
        absolute_path = storage.get_file_path(relative_path)
        print(f"Absolute path on disk: {absolute_path}")
        
        if os.path.exists(absolute_path):
            file_size = os.path.getsize(absolute_path)
            print(f"File exists. Size: {file_size} bytes")
            if file_size > 0:
                print("Verification passed! Audio file is valid and non-empty.")
            else:
                print("Error: Audio file is empty.")
        else:
            print("Error: Audio file does not exist on disk.")
            
    except Exception as e:
        print(f"Failed to generate audio: {e}")

if __name__ == "__main__":
    asyncio.run(test_audio_generation())
