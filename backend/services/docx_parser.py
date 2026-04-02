import re
import json
from docx import Document
from services.ai_client import AIClient

PARSE_SYSTEM = """You are a strict English MCQ parser. Given consecutive text lines from a .docx file, your job is to extract all valid multiple-choice questions.

## DOCUMENT STRUCTURE (important — read carefully)

Each question occupies a group of consecutive lines. A new question STARTS when you see a line matching these patterns:
- Starts with a number: "1．" "1." "1、" "2." "2．" "2、" etc.
- Starts with "（" followed by a year/nian: "（2023·中考）" "（2024·河北）" etc.

Within a question group, lines have these possible types:
- **Question line(s)**: The English question text. May span 1-3 lines before the options appear.
    - Look for lines ending with "?" (the question ends with a question mark)
    - A question can have a follow-up answer line (e.g., "—It was introduced through the Silk Road.") before options appear.
    - A question can have a BLANK: "Do you know ___________ ?" or "I wonder ________."
- **Options**: Always start with "A" (A． A) followed by text. May be on separate lines or on ONE line separated by tabs/whitespace.
    - The options line may have A, B, C, D all on one line separated by tabs, OR
    - Each option on its own line starting with "A．" / "A)" etc.
- **Answer**: Line starting with "【答案】" or "答案：" or "答：" followed by A/B/C/D
- **Explanation**: Line starting with "【详解】" or "详解：" or "【解析】" or "解析：" — this is the EXPLANATION. SKIP it, it is NOT a question.

## YOUR TASK

Group lines into question blocks. For each block:
1. Collect all question text lines (everything before the options)
2. Combine multi-line question text into one string (join with " ")
3. Extract A, B, C, D options (from one line or multiple lines)
4. Extract answer (A/B/C/D)
5. Output JSON

## OUTPUT FORMAT

Return a JSON array of objects:
{
  "content": "The complete question text as a single string. If there was a blank (________) in the original, KEEP it as _________. If there was a follow-up answer line, include it too. Preserve the English as-is.",
  "options": {"A": "option A text", "B": "option B text", "C": "option C text", "D": "option D text"},
  "answer": "A"  (single letter A or B or C or D)
}

## RULES

- content: NEVER include the explanation text (【详解】...) in the question content. The explanation is a SEPARATE field.
- content: The question text is the English question (with possible blank). If the question has a follow-up answer, include it: "—Do you know ___________ ?\n—It was introduced through the Silk Road."
- options: ALWAYS an object with keys A, B, C, D. Each option must be the complete text.
- options: Handle both "A．" (full-width dot), "A)" (parenthesis), and "A\t" (tab) styles.
- answer: Must be exactly "A", "B", "C", or "D". Not "A．" or "．A".
- If a line starts with 【详解】or 【答案】or 【解析】or 详解 or 答案 or 解析, it is METADATA, not content — skip it for the content field.
- Questions with blanks (________) are valid MCQs — preserve the blank in content.
- Return [] if no valid MCQs are found.
- Return ONLY valid JSON array. No markdown fences, no explanation.
"""


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


def _is_question_start(line: str) -> bool:
    """Check if a line starts a new question block."""
    # Numbered question: "1．" "1." "1、" at start, possibly with leading whitespace
    if re.match(r'^\s*\d+[．.、]', line):
        return True
    # Source tag without number: "（2023·中考）" etc. — only if not mid-question
    if re.match(r'^\s*（\d{4}', line):
        return True
    return False


def _is_option(line: str) -> bool:
    """Check if a line is an option (starts with A/B/C/D)."""
    return bool(re.match(r'^\s*[A-D][）).\t：:、]?\s*\S', line))


def _is_answer(line: str) -> bool:
    """Check if a line is an answer marker."""
    return bool(re.search(r'【?\s*答案\s*】?\s*[A-D]', line))


def _is_explanation(line: str) -> bool:
    """Check if a line is an explanation marker."""
    return bool(re.search(r'【?\s*详解\s*】?\s*', line)) or bool(re.search(r'【?\s*解析\s*】?\s*', line))


def _group_lines(lines: list[str]) -> list[list[str]]:
    """
    Group consecutive lines into question blocks.
    A block starts at a numbered question and ends before the next numbered question.
    """
    blocks = []
    current = []
    for line in lines:
        if _is_question_start(line):
            if current:
                blocks.append(current)
            current = [line]
        else:
            current.append(line)
    if current:
        blocks.append(current)
    return blocks


def _parse_single_block(lines: list[str]) -> list[dict]:
    """
    Parse a single question block (list of lines) via AI.
    The block may contain question text + options + answer + explanation.
    """
    if not lines:
        return []

    chunk_text = "\n".join(f"[{i}] {line}" for i, line in enumerate(lines))
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
    Split paragraphs into question-aware chunks and parse each via AI.
    Groups paragraphs into question blocks first, then batches blocks into chunks.
    Calls progress_callback(chunk_idx, total_chunks) after each chunk.
    """
    blocks = _group_lines(paragraphs)
    if not blocks:
        return []

    # Batch blocks into chunks of ~10 blocks each (roughly matches ~40 paragraphs)
    all_questions = []
    total_chunks = (len(blocks) + 9) // 10

    for i in range(0, len(blocks), 10):
        chunk_blocks = blocks[i:i + 10]
        chunk_lines = []
        for block in chunk_blocks:
            chunk_lines.extend(block)
            chunk_lines.append("---")  # Block separator

        chunk_idx = i // 10 + 1
        block_questions = _parse_single_block(chunk_lines)
        if block_questions:
            all_questions.extend(block_questions)
        if progress_callback:
            progress_callback(chunk_idx, total_chunks)

    return all_questions
