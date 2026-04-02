import re
import json
from docx import Document
from services.ai_client import AIClient

PARSE_SYSTEM = """You are a strict English MCQ parser. Extract multiple-choice questions from the text below.

DOCUMENT STRUCTURE — each question occupies 4 consecutive lines:
  Line 1 (question):  "N. (source) Question text?"  — ends with ? or contains a full question
  Line 2 (options):    "A．option1\\tB．option2\\tC．option3\\tD．option4"  (tab-separated, full-width dot)
  Line 3 (answer):      "【答案】A"  or "答案：A"
  Line 4 (explanation): "【详解】explanation text here"  ← IGNORE THIS LINE, it is NOT a question!

Then the next question starts on line 5.

CRITICAL RULE: Any line that starts with "【详解】" or "详解" is explanation text for the PREVIOUS question.
  It is NOT a question. Do NOT include it as question content.
  Skip explanation lines entirely — they do not belong to any question.

YOUR TASK:
Read the input line by line. Group every 4 lines (question + options + answer + explanation).
Extract all valid MCQs and return a JSON array. Each object:
{
  "content": "Question text only — strip the leading number and source tag like (2023·中考)",
  "options": {"A": "option A text", "B": "option B text", "C": "option C text", "D": "option D text"},
  "answer": "A"  (single letter A/B/C/D only)
}

IMPORTANT:
- Return ONLY a valid JSON array. No markdown fences, no explanation, no extra text.
- options must be an object with keys A, B, C, D — never empty, never missing.
- answer must be exactly "A", "B", "C", or "D" (not "A．", not "．A").
- If a line starts with 【详解】or 详解, SKIP IT — do not treat it as a question.
- If no valid MCQs are found in the chunk, return [].
- Handle both "A)" and "A．" and "A\t" styles in the options line."""


def extract_text_from_docx(file_path: str) -> list[str]:
    doc = Document(file_path)
    return [p.text.strip() for p in doc.paragraphs if p.text.strip()]


def _extract_json(text: str) -> str:
    """Extract the first valid JSON array from text."""
    text = re.sub(r"```json\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```\s*$", "", text, flags=re.MULTILINE)
    start = text.find('[')
    end = text.rfind(']') + 1
    if start != -1 and end > start:
        return text[start:end]
    return text.strip()


def _parse_chunk(lines: list[str]) -> list[dict]:
    """Parse a chunk (list of paragraph lines) via AI."""
    chunk_text = "\n".join(lines)
    ai = AIClient()
    response = ai.chat(PARSE_SYSTEM, chunk_text)
    try:
        cleaned = _extract_json(response)
        result = json.loads(cleaned)
        if isinstance(result, list):
            return result
        if isinstance(result, dict) and "questions" in result:
            return result["questions"]
        return []
    except json.JSONDecodeError:
        return []


def parse_docx_stream(paragraphs: list[str], paragraphs_per_chunk: int = 40,
                       progress_callback=None) -> list[dict]:
    """
    Split paragraphs into chunks and parse each via AI.
    Calls progress_callback(chunk_idx, total_chunks) after each chunk.
    Returns all valid MCQs found.
    """
    all_questions = []
    total_chunks = (len(paragraphs) + paragraphs_per_chunk - 1) // paragraphs_per_chunk
    i = 0
    chunk_idx = 0

    while i < len(paragraphs):
        chunk = paragraphs[i:i + paragraphs_per_chunk]
        chunk_idx += 1
        chunk_questions = _parse_chunk(chunk)
        if chunk_questions:
            all_questions.extend(chunk_questions)
        if progress_callback:
            progress_callback(chunk_idx, total_chunks)
        i += paragraphs_per_chunk

    return all_questions
