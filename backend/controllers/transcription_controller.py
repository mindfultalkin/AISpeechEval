from fastapi import APIRouter, UploadFile, File, HTTPException
from backend.services.transcription_service import transcribe_file, transcribe_url

router = APIRouter()

@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    try:
        return await transcribe_file(audio)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transcribe-url")
async def transcribe_audio_url(payload: dict):
    try:
        return await transcribe_url(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))