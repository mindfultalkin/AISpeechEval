import json
from fastapi import HTTPException
from backend.core.config import openai_client, OPENAI_MODEL, logger


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

    completion = openai_client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )

    raw = completion.choices[0].message.content.strip()

    try:
        start = raw.find("{")
        end = raw.rfind("}") + 1
        parsed = json.loads(raw[start:end])
    except Exception:
        raise HTTPException(status_code=500, detail="Invalid JSON from model")

    return parsed