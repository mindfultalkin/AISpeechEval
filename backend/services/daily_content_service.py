import json
import re
import random
from fastapi import HTTPException
from backend.core.config import client, logger

# =========================
# VARIATION POOLS
# =========================

themes = [
    "nature","technology","space","emotions","school life",
    "science experiments","animals","future world","mystery",
    "history","friendship","sports","music","art",
    "daily routines","adventures","weather","ocean",
    "mountains","cities","villages","transport",
    "food","health","environment","robots",
    "AI and machines","fantasy worlds","time travel",
    "inventions"
]

word_categories = [
    "action verbs","descriptive adjectives","emotion words",
    "academic vocabulary","rare English words",
    "phrasal verbs","communication words","teaching vocabulary",
    "classroom phrases","analytical words",
    "creative expression words","storytelling vocabulary",
    "scientific terms","behavior words",
    "thinking-related words","problem-solving words",
    "leadership vocabulary","observation words",
    "feeling-based vocabulary","daily conversation words"
]

riddle_styles = [
    "logic puzzle","visual imagination riddle",
    "pattern recognition puzzle","lateral thinking puzzle",
    "scenario-based riddle","story-based riddle",
    "mathematical thinking puzzle","wordplay riddle",
    "analogy-based riddle","deduction puzzle",
    "mystery-solving riddle","sequence puzzle",
    "hidden meaning riddle","trick question",
    "real-life situation puzzle","decision-making puzzle",
    "critical thinking challenge","observation puzzle",
    "abstract thinking riddle","conceptual puzzle"
]

def extract_json(text: str):
    try:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
    except:
        return {}
    return {}

# =========================
# MAIN SERVICE
# =========================

async def generate_daily_content(program: str):

    if not program:
        raise HTTPException(400, "program is required")

    program = program.upper()

    try:
        level = int(program.split("-")[1])
    except:
        raise HTTPException(400, "Invalid format (CC-1, PET-2)")

    if program.startswith("CC"):
        audience = "school students"
        difficulty = f"Grade {level}"
        tone = "simple, engaging, and easy to understand"

    elif program.startswith("PET"):
        audience = "teachers and professionals"
        difficulty = f"Professional level {level}"
        tone = "refined, practical, and real-world"

    else:
        raise HTTPException(400, "Unsupported program")

    # RANDOMIZATION
    selected_themes = random.sample(themes, 2)
    selected_word_category = random.choice(word_categories)
    selected_riddle_style = random.choice(riddle_styles)
    seed = random.randint(1, 9999999)

    prompt = f"""
You are generating UNIQUE daily LMS content.

SEED: {seed}

CONTEXT:
Audience: {audience}
Difficulty: {difficulty}
Tone: {tone}

DIVERSITY INPUT:
Themes: {selected_themes}
Word Category: {selected_word_category}
Riddle Style: {selected_riddle_style}

STRICT RULES:
- Content MUST strongly reflect the given themes
- NEVER use common words
- NEVER use common riddles
- Each response must feel new

OUTPUT FORMAT:
Return ONLY JSON:
{{
  "wordOfTheDay": {{
    "word": "",
    "pronunciation": "",
    "type": "",
    "meaning": "",
    "example": ""
  }},
  "brainTeaser": {{
    "question": "",
    "hint": "",
    "answer": ""
  }}
}}
"""

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "Generate highly diverse content"},
                {"role": "user", "content": prompt}
            ],
            temperature=1.2,
            top_p=0.9,
            frequency_penalty=1.0,
            presence_penalty=1.0,
            max_tokens=500
        )

        raw = completion.choices[0].message.content
        result = extract_json(raw)

        if not result:
            raise Exception("Invalid response format")

        return result

    except Exception as e:
        logger.exception("Daily content generation failed")
        raise HTTPException(500, str(e))