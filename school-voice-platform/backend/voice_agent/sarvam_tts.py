"""
Custom Sarvam AI TTS Plugin for LiveKit Agents v1.5.x.

Calls the Sarvam AI text-to-speech API and pushes raw PCM audio frames
into the LiveKit agent pipeline via the AudioEmitter interface.
"""

from __future__ import annotations

import base64
import io
import wave
import logging
import hashlib
import os
from dataclasses import dataclass

import httpx

from livekit import rtc
from livekit.agents import tts, APIConnectOptions, utils

logger = logging.getLogger("voice_agent.sarvam_tts")


@dataclass
class SarvamTTSOptions:
    """Configuration options for the Sarvam AI TTS engine."""
    api_key: str
    language_code: str = "hi-IN"
    speaker: str = "shreya"
    model: str = "bulbul:v3"
    sample_rate: int = 24000
    api_url: str = "https://api.sarvam.ai/text-to-speech"


class SarvamTTS(tts.TTS):
    """
    LiveKit-compatible TTS plugin backed by Sarvam AI.

    Usage:
        tts_engine = SarvamTTS(api_key="sk_...")
        # Pass to Agent(tts=tts_engine)
    """

    def __init__(
        self,
        *,
        api_key: str,
        language_code: str = "hi-IN",
        speaker: str = "shreya",
        model: str = "bulbul:v3",
        sample_rate: int = 24000,
    ) -> None:
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=sample_rate,
            num_channels=1,
        )
        self._opts = SarvamTTSOptions(
            api_key=api_key,
            language_code=language_code,
            speaker=speaker,
            model=model,
            sample_rate=sample_rate,
        )
        self._http_client = httpx.AsyncClient(timeout=30.0)

    def update_options(
        self, *, language_code: str | None = None, speaker: str | None = None
    ) -> None:
        if language_code is not None:
            self._opts.language_code = language_code
        if speaker is not None:
            self._opts.speaker = speaker

    def synthesize(
        self,
        text: str,
        *,
        conn_options: APIConnectOptions = APIConnectOptions(),
    ) -> "SarvamChunkedStream":
        return SarvamChunkedStream(
            tts=self,
            input_text=text,
            opts=self._opts,
            http_client=self._http_client,
            conn_options=conn_options,
        )

    async def aclose(self) -> None:
        await self._http_client.aclose()
        await super().aclose()


class SarvamChunkedStream(tts.ChunkedStream):
    """
    Streams TTS audio from a single Sarvam API call.
    Decodes base64 WAV → strips header → pushes raw PCM frames
    through the AudioEmitter.
    """

    def __init__(
        self,
        *,
        tts: SarvamTTS,
        input_text: str,
        opts: SarvamTTSOptions,
        http_client: httpx.AsyncClient,
        conn_options: APIConnectOptions,
    ) -> None:
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._opts = opts
        self._http_client = http_client

    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        """
        Called by the LiveKit framework. Performs the Sarvam API call,
        decodes the audio, and pushes PCM frames via output_emitter.
        """
        text = self._input_text

        if not text or not text.strip():
            return

        # Check file cache to speed up startup/common responses
        try:
            cache_str = f"{text}_{self._opts.speaker}_{self._opts.language_code}_{self._opts.sample_rate}"
            cache_hash = hashlib.md5(cache_str.encode("utf-8")).hexdigest()
            cache_dir = os.path.join(os.path.dirname(__file__), "tts_cache")
            os.makedirs(cache_dir, exist_ok=True)
            cache_file = os.path.join(cache_dir, f"{cache_hash}.pcm")
            
            if os.path.exists(cache_file):
                logger.info(f"TTS Cache hit for text: '{text[:40]}...'")
                with open(cache_file, "rb") as f:
                    pcm_data = f.read()
                output_emitter.initialize(
                    request_id=utils.shortuuid(),
                    sample_rate=self._opts.sample_rate,
                    num_channels=1,
                    mime_type="audio/pcm",
                )
                output_emitter.push(pcm_data)
                return
        except Exception as e:
            logger.error(f"Error checking TTS cache: {e}")

        logger.debug(f"Synthesizing {len(text)} chars via Sarvam AI")

        headers = {
            "api-subscription-key": self._opts.api_key,
            "Content-Type": "application/json",
        }

        payload = {
            "inputs": [text],
            "target_language_code": self._opts.language_code,
            "speaker": self._opts.speaker,
            "model": self._opts.model,
            "speech_sample_rate": self._opts.sample_rate,
        }

        try:
            response = await self._http_client.post(
                self._opts.api_url,
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(
                f"Sarvam API HTTP error: {e.response.status_code} - {e.response.text}"
            )
            return
        except Exception as e:
            logger.error(f"Sarvam API request failed: {e}")
            return

        data = response.json()
        if "audios" not in data or not data["audios"]:
            logger.error("No audio in Sarvam response")
            return

        # Decode the base64 WAV audio
        wav_bytes = base64.b64decode(data["audios"][0])

        # Strip WAV header and extract raw PCM data
        try:
            with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
                sample_rate = wf.getframerate()
                num_channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                pcm_data = wf.readframes(wf.getnframes())
        except Exception as e:
            logger.error(f"Failed to decode WAV: {e}")
            return

        logger.debug(
            f"Sarvam returned {len(pcm_data)} PCM bytes "
            f"(rate={sample_rate}, channels={num_channels}, width={sample_width})"
        )

        # Save to cache file
        try:
            with open(cache_file, "wb") as f:
                f.write(pcm_data)
            logger.info(f"Saved TTS audio to cache for text: '{text[:40]}...'")
        except Exception as e:
            logger.error(f"Failed to write to TTS cache: {e}")

        # Initialize the audio emitter
        output_emitter.initialize(
            request_id=utils.shortuuid(),
            sample_rate=sample_rate,
            num_channels=num_channels,
            mime_type="audio/pcm",
        )

        # Push the raw PCM bytes directly
        output_emitter.push(pcm_data)
