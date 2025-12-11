from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Evaluation Tool API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

@app.get("/")
def root():
    return {"message": "AI Evaluation Tool API is running"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "api_configured": bool(os.getenv("GROQ_API_KEY"))}

@app.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    try:
        temp_file = f"temp_{audio.filename}"
        with open(temp_file, "wb") as f:
            content = await audio.read()
            f.write(content)
        
        with open(temp_file, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3",
                response_format="json",
                language="en"
            )
        
        os.remove(temp_file)
        
        return {"text": transcription.text}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/evaluate")
async def evaluate_response(
    question: str = Form(...),
    rubrics: str = Form(...),
    response: str = Form(...)
):
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
        
        result_text = completion.choices[0].message.content.strip()
        
        # Clean markdown code blocks if present
        code_fence = '```'
        if code_fence in result_text:
            lines = result_text.split('\n')
            cleaned_lines = [line for line in lines if not line.strip().startswith(code_fence)]
            result_text = '\n'.join(cleaned_lines).strip()
        
        # Parse JSON
        evaluation = json.loads(result_text)
        
        # Normalize scores if they are in 0-10 range
        def normalize_score(score):
            if isinstance(score, (int, float)) and 0 < score <= 10:
                return int(score * 10)
            return int(score) if isinstance(score, (int, float)) else 0
        
        # Apply normalization
        if "rubrics" in evaluation:
            for rubric in evaluation["rubrics"]:
                if "score" in rubric:
                    rubric["score"] = normalize_score(rubric["score"])
        
        if "overall_score" in evaluation:
            evaluation["overall_score"] = normalize_score(evaluation["overall_score"])
        
        return evaluation
    
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"JSON parse error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation error: {str(e)}")