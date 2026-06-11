import httpx
import base64
from settings import SARVAM_API_KEY
from services.local_storage_service import LocalStorageService

class TTSService:
    def __init__(self):
        self.storage_service = LocalStorageService()
        self.api_url = "https://api.sarvam.ai/text-to-speech"
        
    async def generate_audio(self, text: str, school_id: str, notice_id: str) -> str:
        """
        1. Call Sarvam AI TTS API to convert text to audio.
        2. Decode the base64-encoded audio returned in the response.
        3. Save to local storage under subfolder: audio/{school_id} and filename: {notice_id}.wav.
        4. Return the relative file path URL (e.g. /uploads/audio/{school_id}/{notice_id}.wav).
        """
        headers = {
            "api-subscription-key": SARVAM_API_KEY,
            "Content-Type": "application/json"
        }
        
        payload = {
            "inputs": [text],
            "target_language_code": "hi-IN",
            "speaker": "shreya",
            "model": "bulbul:v3",
            "speech_sample_rate": 8000
        }
        
        async with httpx.AsyncClient() as client:
            # Setting timeout to 30 seconds to handle voice generation latency
            response = await client.post(self.api_url, json=payload, headers=headers, timeout=30.0)
            
        if response.status_code != 200:
            raise Exception(f"Sarvam AI TTS API failed with status {response.status_code}: {response.text}")
            
        data = response.json()
        if "audios" not in data or not data["audios"]:
            raise Exception("No audio data returned in Sarvam AI response")
            
        # The REST API returns base64-encoded audio strings in the 'audios' list
        base64_audio = data["audios"][0]
        audio_bytes = base64.b64decode(base64_audio)
        
        # Save to local disk using LocalStorageService
        subfolder = f"audio/{school_id}"
        filename = f"{notice_id}.wav"
        
        relative_path = self.storage_service.save_file(audio_bytes, subfolder, filename)
        return relative_path
