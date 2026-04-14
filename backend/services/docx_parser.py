import re
import json
from docx import Document
from services.ai_client import AIClient

PARSE_SYSTEM = """You are a strict English MCQ parser. Extract ALL multiple-choice questions from the given text.

The input may contain a separator "---". Content BEFORE "---" is the question text.
Content AFTER "---" is the answer key: starts with "N．AnswerLetter" then 【详解】explanation.

Extract each question:
- content: English question text (combine multi-line with \\n, preserve blanks as ________)
- options: {"A": "option A", "B": "option B", "C": "option C", "D": "option D"}
- answer: EXACTLY one letter: A, B, C, or D (extract from after ---)
- explanation: the 【详解】text after the answer letter (extract from after ---)

RULES:
- content: DO NOT include 【详解】text
- answer: must be a single letter A/B/C/D (not "A．")
- options: always A/B/C/D as keys
- explanation: extract everything after 【详解】or 【解析】(can be empty string if not found)
- Extract ALL questions found in the text
- Return ONLY valid JSON array. No markdown fences."""

def extract_text_from_docx(file_path: str) -> list[str]:
    doc = Document(file_path)
    return [p.text.strip() for p in doc.paragraphs if p.text.strip()]


def _extract_json(text: str) -> str:
    """Extract the first valid JSON array from text."""
    # Strip thinking tags that some models prepend
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    text = re.sub(r"```json\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"```\s*$", "", text, flags=re.MULTILINE)
    start = text.find('[')
    end = text.rfind(']') + 1
    if start != -1 and end > start:
        return text[start:end]
    return text.strip()


def _is_question_start(line: str) -> bool:
    """Check if a line starts a new question block.

    Must match number prefix AND not look like a title.
    Titles often contain keywords like '易错点', '专题', or are just a heading.
    Real questions typically contain '?' or have option letters nearby.
    """
    # Must start with a number
    if not re.match(r'^\s*\d+[．.、]', line):
        return False
    # Skip lines that look like section titles (no '?' and contain title keywords)
    title_keywords = ['易错点', '专题', '考点', '知识点', '单元', '第一章', '第二章']
    has_title_keyword = any(kw in line for kw in title_keywords)
    # If it's a title keyword line without '?', treat as not a question
    if has_title_keyword and '?' not in line:
        return False
    # Skip lines that look like standalone answer lines 'N．A'
    if re.match(r'^\s*\d+[．.、]\s*[A-D]\s*$', line.strip()):
        return False
    return True


def _is_answer_marker(line: str) -> bool:
    """Check if a line is an answer marker like '1．C' or '1.C'."""
    return bool(re.match(r'^\s*\d+[．.、]\s*[A-D]', line))


def _is_question_line(line: str) -> bool:
    """
    Check if a numbered line is a real question (vs. an answer marker).
    '1．C' is an answer marker (ends with A/B/C/D directly after the number).
    '1．(2023·...) —Question?' is a question.
    '易错点05 动词的时态' is a title (contains title keywords).
    """
    # Must start with a number
    if not re.match(r'^\s*\d+[．.、]', line):
        return False
    # 'N．A' (with optional space) at end = answer marker
    if re.match(r'^\s*\d+[．.、]\s*[A-D]\s*$', line.strip()):
        return False
    # Skip title/section-header lines (contain title keywords)
    title_keywords = ['易错点', '专题', '考点', '知识点', '单元', '第一章', '第二章']
    if any(kw in line for kw in title_keywords):
        return False
    return True


def _is_explanation(line: str) -> bool:
    """Check if a line is an explanation marker."""
    return bool(re.search(r'【?\s*详解\s*】?\s*', line)) or bool(re.search(r'【?\s*解析\s*】?\s*', line))


def _preclassify_lines(paragraphs: list[str]) -> tuple[list[list[str]], list[list[str]]]:
    """
    Split all paragraphs into question blocks and answer/analysis blocks.
    Returns (question_blocks, answer_blocks) in document order.

    Format detection: count numbered lines that look like questions vs answers.
    If the doc has many answer markers (N．A/B/C/D) among numbered lines,
    it's Format B (questions and answers in separate sections).
    """
    numbered = [(i, p) for i, p in enumerate(paragraphs)
                if re.match(r'^\s*\d+[．.、]', p)]
    q_count = sum(1 for _, p in numbered if _is_question_line(p))
    a_count = sum(1 for _, p in numbered if _is_answer_marker(p))

    # If significant number of answer markers → Format B
    if a_count > 0 and a_count >= q_count * 0.3:
        return _split_format_b(paragraphs)
    else:
        return _split_format_a(paragraphs)


def _split_format_a(paragraphs: list[str]) -> tuple[list[list[str]], list[list[str]]]:
    """Traditional format: questions and answers are in the same block."""
    blocks = []
    current = []
    first_q_found = False

    for line in paragraphs:
        if _is_question_start(line):
            first_q_found = True
            if current:
                blocks.append(current)
            current = [line]
        elif first_q_found:
            # Only accumulate lines after first question found
            current.append(line)
    if current:
        blocks.append(current)
    # Format A: answer blocks are empty (answers are inside question blocks)
    return blocks, []


def _split_format_b(paragraphs: list[str]) -> tuple[list[list[str]], list[list[str]]]:
    """
    Format B: all questions first, then all answers/analyses.
    Split into two sections at the first answer marker.
    """
    question_lines = []
    answer_lines = []
    seen_answer = False

    for line in paragraphs:
        if not seen_answer and _is_answer_marker(line):
            seen_answer = True
        if seen_answer:
            answer_lines.append(line)
        else:
            question_lines.append(line)

    # Group question lines into blocks (skip pre-title content)
    question_blocks = []
    current = []
    first_q_found = False
    for line in question_lines:
        if _is_question_start(line):
            first_q_found = True
            if current:
                question_blocks.append(current)
            current = [line]
        elif first_q_found:
            current.append(line)
    if current:
        question_blocks.append(current)

    # Group answer lines into blocks (each starts with N． or 【详解】)
    answer_blocks = []
    current = []
    for line in answer_lines:
        is_new = _is_answer_marker(line) or (not current and _is_explanation(line))
        # Start new block on answer marker
        if _is_answer_marker(line):
            if current:
                answer_blocks.append(current)
            current = [line]
        elif _is_explanation(line) and not current:
            # Explanation without preceding answer marker (starts a block)
            current.append(line)
        elif current:
            current.append(line)
        # Skip standalone explanations that don't start a block
    if current:
        answer_blocks.append(current)

    return question_blocks, answer_blocks


def _match_answer_to_question(question_num: int, answer_blocks: list[list[str]]) -> str:
    """
    Find the answer+analysis block that corresponds to question_num.
    Match by the number prefix in the first line (e.g., '1．C').
    """
    for block in answer_blocks:
        if not block:
            continue
        first = block[0]
        m = re.match(r'^\s*(\d+)[．.、]', first)
        if m and int(m.group(1)) == question_num:
            return '\n'.join(block)
    return ''



def _is_valid_question_block(block: list[str]) -> bool:
    """Return True if this block looks like a real MCQ (has numbered question start)."""
    if not block:
        return False
    return bool(_is_question_start(block[0]))


def _extract_question_number(block: list[str]) -> int | None:
    """Extract the question number from the first line of a block."""
    if not block:
        return None
    m = re.match(r'^\s*(\d+)', block[0])
    return int(m.group(1)) if m else None


def _parse_q_block_with_context(block: list[str], answer_text: str) -> list[dict]:
    """Parse a question block via AI, optionally including answer context."""
    if answer_text:
        block_text = '\n'.join(f"[{i}] {line}" for i, line in enumerate(block)) + '\n---\n' + answer_text
    else:
        block_text = '\n'.join(f"[{i}] {line}" for i, line in enumerate(block))

    ai = AIClient()
    response = ai.chat(PARSE_SYSTEM, block_text, max_tokens=2048)
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
    Parse docx paragraphs into questions.
    Supports:
    - Format A: answers embedded inside question blocks
    - Format B: all answers in a separate section (after first answer marker)
    """
    question_blocks, answer_blocks = _preclassify_lines(paragraphs)
    total = len(question_blocks)
    all_questions = []

    for idx, block in enumerate(question_blocks):
        if not _is_valid_question_block(block):
            if progress_callback:
                progress_callback(idx + 1, total)
            continue

        # Format B: find matching answer text for this question
        answer_text = ''
        if answer_blocks:
            q_num = _extract_question_number(block)
            if q_num is not None:
                answer_text = _match_answer_to_question(q_num, answer_blocks)

        questions = _parse_q_block_with_context(block, answer_text)
        if questions:
            all_questions.extend(questions)
        elif not answer_blocks:
            # Format A fallback: parse without answer context
            fallback = _parse_q_block_with_context(block, '')
            all_questions.extend(fallback)

        if progress_callback:
            progress_callback(idx + 1, total)

    return all_questions
