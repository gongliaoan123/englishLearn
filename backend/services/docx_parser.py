import re
import json
from docx import Document
from services.ai_client import AIClient

PARSE_SYSTEM = """You are a strict English MCQ parser. Extract multiple-choice questions from the text below.

FORMAT YOU WILL SEE:
- Question line: "1. (2023·中考) Question text here?"
- Options line: "A．answer1\tB．answer2\tC．answer3\tD．answer4"  (tab-separated, full-width dot)
- Answer line: "【答案】A"
- Explanation: "【详解】reason here"
- Then next question...

YOUR TASK:
Extract all valid MCQs and return a JSON array. Each object:
{
  "content": "Question text (without the number and source)",
  "options": {"A": "option A text", "B": "option B text", "C": "option C text", "D": "option D text"},
  "answer": "A" (or B/C/D),
  "explanation": "brief explanation"
}

IMPORTANT:
- Return ONLY valid JSON array. No markdown fences, no explanation, no extra text.
- Handle both "A)" and "A．" (full-width dot) formats.
- Handle both "A" and "．A" in answer lines.
- If a chunk has no valid questions, return [].
- Every question must have exactly A, B, C, D options."""


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
