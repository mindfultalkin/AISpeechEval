from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import os
import json
import tempfile
import logging
import io

from dotenv import load_dotenv
load_dotenv()

# logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-eval-api")

app = FastAPI(title="AI Evaluation Tool API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure GROQ_API_KEY is set in your Vercel env (Project Settings -> Environment Variables)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    logger.warning("GROQ_API_KEY is not set. /api/health will report api_configured=false")

client = OpenAI(
    api_key=GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1"
)

@app.get("/")
def root():
    return {"message": "AI Evaluation Tool API is running"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "api_configured": bool(GROQ_API_KEY)}

@app.post("/api/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """
    In-memory transcription: read uploaded file into BytesIO and send to transcription API.
    Avoids writing to disk (necessary in many serverless environments like Vercel).
    """
    try:
        content = await audio.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        # Use BytesIO so we don't write to the function's filesystem
        audio_buffer = io.BytesIO(content)
        # Some SDKs expect a 'name' attribute on the file-like object
        audio_buffer.name = audio.filename or "upload.webm"
        audio_buffer.seek(0)

        logger.info("Received upload (name=%s size=%d)", audio_buffer.name, len(content))

        # Call Groq/OpenAI transcription API using the file-like object
        transcription = client.audio.transcriptions.create(
            file=audio_buffer,
            model="whisper-large-v3",
            response_format="json",
            language="en"
        )

        # Normalize transcription response (handle dict or SDK object)
        text = None
        if isinstance(transcription, dict):
            text = transcription.get("text") or transcription.get("transcript") or transcription.get("data", {}).get("text")
        else:
            text = getattr(transcription, "text", None) or getattr(transcription, "transcript", None)

        if text is None:
            try:
                text = json.dumps(transcription)
            except Exception:
                text = str(transcription)

        logger.info("Transcription complete (len=%d)", len(text) if text else 0)
        return {"text": text}

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Transcription error (in-memory)")
        # return the error detail so frontend sees the message (already JSON via HTTPException)
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")



@app.post("/api/evaluate")
async def evaluate_response(
    question: str = Form(...),
    rubrics: str = Form(...),
    response: str = Form(...)
):
    """Sends a prompt to the model to evaluate the response based on rubrics; returns normalized JSON."""
    try:
        prompt = f"""You are an expert evaluator. Evaluate the response based on the provided rubrics.

IMPORTANT: Score each criterion on a scale of 0 to 100 (not 0 to 10).
Examples of valid scores: 45, 67, 82, 91 (NOT 4.5, 6.7, 8.2, 9.1)

QUESTION: {question}

RESPONSE: {response}

RUBRICS:
{rubrics}

Provide a detailed evaluation with:
1. Individual scores for each rubric criterion (0-100 scale)
2. Specific feedback for each criterion
3. An overall score (0-100 scale)
4. A brief summary of the evaluation

Return ONLY valid JSON in this exact format:
{{"rubrics": [{{"criterion": "Name", "score": 75, "feedback": "Feedback here"}}], "overall_score": 72, "summary": "Summary here"}}

Do not include any markdown formatting, code blocks, or extra text. Only return the JSON object."""

        logger.info("Sending evaluation request to model (question len=%d, rubrics len=%d, response len=%d)",
                    len(question), len(rubrics), len(response))

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert evaluator. Always score on a 0-100 scale. Return only valid JSON without markdown formatting."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2000
        )

        # Extract text
        raw_text = None
        try:
            raw_text = completion.choices[0].message.content.strip()
        except Exception:
            # fallback: try to stringify
            raw_text = str(completion)
        logger.debug("Model returned: %s", raw_text[:1000])

        # Some models may add explanatory text before/after the JSON. Try to extract the JSON substring.
        json_text = raw_text
        first_brace = raw_text.find('{')
        last_brace = raw_text.rfind('}')
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            json_text = raw_text[first_brace:last_brace+1]
        else:
            # fallback leave as-is; the json.loads() below will throw if invalid
            json_text = raw_text

        try:
            evaluation = json.loads(json_text)
        except json.JSONDecodeError as e:
            logger.exception("JSON parse failed. Raw model output: %s", raw_text[:2000])
            raise HTTPException(status_code=500, detail=f"JSON parse error from model: {str(e)}")

        # Normalize scores if they are in 0-10 range
        def normalize_score(score):
            if isinstance(score, (int, float)) and 0 < score <= 10:
                return int(score * 10)
            try:
                if isinstance(score, str) and score.strip():
                    num = float(score)
                    if 0 < num <= 10:
                        return int(num * 10)
                    return int(num)
            except Exception:
                return 0
            return int(score) if isinstance(score, (int, float)) else 0

        if "rubrics" in evaluation and isinstance(evaluation["rubrics"], list):
            for rubric in evaluation["rubrics"]:
                if "score" in rubric:
                    rubric["score"] = normalize_score(rubric["score"])

        if "overall_score" in evaluation:
            evaluation["overall_score"] = normalize_score(evaluation["overall_score"])

        return evaluation

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Evaluation error")
        raise HTTPException(status_code=500, detail=f"Evaluation error: {str(e)}")

# keep the app reference for Vercel/Uvicorn
app = app
