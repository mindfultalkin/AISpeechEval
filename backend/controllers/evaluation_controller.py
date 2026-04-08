from fastapi import APIRouter, Form, HTTPException
from services.evaluation_service import evaluate

router = APIRouter()

@router.post("/evaluate")
async def evaluate_response(
    question: str = Form(...),
    rubrics: str = Form(...),
    response: str = Form(...)
):
    try:
        return await evaluate(question, rubrics, response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))