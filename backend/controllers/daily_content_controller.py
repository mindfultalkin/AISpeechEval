from fastapi import APIRouter, HTTPException
from services.daily_content_service import generate_daily_content

router = APIRouter()

@router.get("/daily-content")
async def get_daily_content(program: str):
    try:
        return await generate_daily_content(program)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))