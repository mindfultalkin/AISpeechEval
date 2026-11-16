import os
from dotenv import load_dotenv
from groq import Groq
from openai import OpenAI
import logging

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-eval-api")

# Groq: speech-to-text (Whisper)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    logger.warning("GROQ_API_KEY is not set")

client = Groq(api_key=GROQ_API_KEY)

# OpenAI: evaluation and daily content
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY is not set")

openai_client = OpenAI(api_key=OPENAI_API_KEY or "missing")
