import os
from dotenv import load_dotenv
from groq import Groq
import logging

load_dotenv()

print("KEY:", os.getenv("GROQ_API_KEY"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-eval-api")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    logger.warning("GROQ_API_KEY is not set")

client = Groq(api_key=os.getenv("GROQ_API_KEY"))