import re
from docx import Document
from services.ai_client import AIClient

PARSE_SYSTEM = """You are a strict English MCQ parser. You will receive raw text from a docx file containing English multiple-choice questions.
Your job is to extract ONLY valid 4-option multiple-choice questions (A/B/C/D format).
Skip anything that is not a proper MCQ (fill-in-blank, essay, short answer, etc.) and return {"skipped": true, "reason": "..."}.
Return a JSON array of question objects. Each object has:
- content: str (the question text, without the options)
- options: dict ({"A": "...", "B": "...", "C": "...", "D": "..."})
- answer: str ("A" | "B" | "C" | "D")
- explanation: str (brief explanation of why the answer is correct)

If there are no valid MCQs, return an empty array [].
Do not add any text outside the JSON array."""


def extract_text_from_docx(file_path: str) -> str:
    doc = Document(file_path)
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def parse_docx_via_ai(raw_text: str) -> list[dict]:
    ai = AIClient()
    response = ai.chat(PARSE_SYSTEM, raw_text)
    # strip markdown code fences if present
    response = re.sub(r"^```json\s*", "", response.strip())
    response = re.sub(r"\s*```$", "", response.strip())
    import json
    result = json.loads(response)
    if isinstance(result, dict) and "questions" in result:
        return result["questions"]
    if isinstance(result, list):
        return result
    return []
