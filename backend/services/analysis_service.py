import json
import re
from services.ai_client import AIClient

ANALYSIS_SYSTEM = """You are an expert English teacher. A student answered a multiple-choice question incorrectly.
Analyze why they got it wrong and suggest 2-5 knowledge point tags that describe the skill/concept being tested.
Return a JSON object with:
- analysis: str (2-3 sentences explaining the mistake cause in Chinese)
- suggested_tags: list[str] (knowledge tags in Chinese, e.g. ["过去完成时", "虚拟语气", "定语从句"])
Be concise and educational."""


def analyze_wrong_answer(
    question_content: str,
    correct_answer: str,
    wrong_answer: str,
    options: dict,
) -> dict:
    prompt = f"""Question: {question_content}

Options:
A) {options.get("A", "?")}
B) {options.get("B", "?")}
C) {options.get("C", "?")}
D) {options.get("D", "?")}

Student chose: {wrong_answer}
Correct answer: {correct_answer}

Analyze the student's mistake."""
    try:
        ai = AIClient()
        response = ai.chat(ANALYSIS_SYSTEM, prompt)
        response = re.sub(r"^```json\s*", "", response.strip(), flags=re.IGNORECASE)
        response = re.sub(r"\s*```$", "", response.strip())
        result = json.loads(response)
        if isinstance(result, dict) and "analysis" in result:
            return result
        return {"analysis": "解析生成失败", "suggested_tags": []}
    except (json.JSONDecodeError, Exception):
        return {"analysis": "解析生成失败，请稍后重试", "suggested_tags": []}
