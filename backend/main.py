from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.controllers.transcription_controller import router as transcription_router
from backend.controllers.evaluation_controller import router as evaluation_router
from backend.controllers.daily_content_controller import router as daily_content_router

app = FastAPI(title="AI Evaluation Tool API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "AI Evaluation Tool API is running"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy"},
    "api_configured": bool(os.getenv("GROQ_API_KEY"))

# Register routers
app.include_router(transcription_router, prefix="/api")
app.include_router(evaluation_router, prefix="/api")
app.include_router(daily_content_router, prefix="/api")