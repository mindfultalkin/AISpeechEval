import json
from fastapi import HTTPException
from backend.core.config import ask_claude, logger


async def evaluate(question, rubrics, response):
    prompt = f"""
    Evaluate response based on rubrics.
    Score 0-100.

    QUESTION: {question}
    RESPONSE: {response}
    RUBRICS: {rubrics}

    Return ONLY JSON:
    {{
        "rubrics": [{{"criterion": "Name", "score": 75, "feedback": "..."}}],
        "overall_score": 70,
        "summary": "..."
    }}
    """

    raw = ask_claude(prompt)

    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        parsed = json.loads(raw[start:end])
    except Exception:
        raise HTTPException(status_code=500, detail="Invalid JSON from model")

    return parsed