import io
import requests
from fastapi import UploadFile, HTTPException
from backend.core.config import client, logger


async def transcribe_file(audio: UploadFile):
    content = await audio.read()

    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    audio_buffer = io.BytesIO(content)
    audio_buffer.name = audio.filename or "audio.webm"

    transcription = client.audio.transcriptions.create(
        file=audio_buffer,
        model="whisper-large-v3",
        response_format="json",
        language="en"
    )

    text = getattr(transcription, "text", None)
    return {"text": text or ""}


async def transcribe_url(payload: dict):
    media_url = payload.get("mediaUrl")

    if not media_url:
        raise HTTPException(status_code=400, detail="mediaUrl required")

    response = requests.get(media_url)
    content = response.content

    audio_buffer = io.BytesIO(content)
    audio_buffer.name = "remote.mp3"

    transcription = client.audio.transcriptions.create(
        file=audio_buffer,
        model="whisper-large-v3",
        response_format="json",
        language="en"
    )

    text = getattr(transcription, "text", None)

    return {
        "text": text or "",
        "source": "url"
    }