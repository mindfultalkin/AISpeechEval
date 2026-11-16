import os
from dotenv import load_dotenv
from groq import Groq
import anthropic
import logging

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-eval-api")

# Groq: speech-to-text (Whisper)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    logger.warning("GROQ_API_KEY is not set")

client = Groq(api_key=GROQ_API_KEY)

# Claude: evaluation and daily content
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
CLAUDE_MODEL = "claude-opus-5-5"

if not ANTHROPIC_API_KEY:
    logger.warning("ANTHROPIC_API_KEY is not set")

claude_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY or "missing")


def ask_claude(prompt, system=None, effort="medium", max_tokens=16000):
    """Send one prompt to Claude and return the text of its reply."""
    kwargs = {}
    if system:
        kwargs["system"] = system

    # If Claude declines, the API retries the request on a fallback model.
    response = claude_client.beta.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": effort},
        messages=[{"role": "user", "content": prompt}],
        **kwargs,
    )

    if response.stop_reason == "refusal":
        raise RuntimeError("Claude declined the request")

    return "".join(b.text for b in response.content if b.type == "text").strip()
