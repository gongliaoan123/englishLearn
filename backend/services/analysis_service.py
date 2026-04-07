import json
import re
from services.ai_client import AIClient

ANALYSIS_SYSTEM = """You are an expert English teacher. A student answered a multiple-choice question incorrectly.
Analyze why they got it wrong and suggest 2-5 knowledge point tags that describe the skill/concept being tested.
Return a JSON object with:
- analysis: str (2-3 sentences explaining the mistake cause in Chinese)
- suggested_tags: list[str] (knowledge tags in Chinese ONLY, e.g. ["过去完成时", "虚拟语气", "定语从句"], NOT English)
Be concise and educational. The tags MUST be in Chinese, never in English."""


def _translate_to_chinese(text: str) -> str:
    """Translate common English grammar/phrase tags to Chinese."""
    MAP = {
        "past perfect": "过去完成时",
        "past simple": "一般过去时",
        "present perfect": "现在完成时",
        "present simple": "一般现在时",
        "future simple": "一般将来时",
        "passive voice": "被动语态",
        "relative clause": "定语从句",
        "subjunctive": "虚拟语气",
        "gerund": "动名词",
        "infinitive": "不定式",
        "adjective": "形容词",
        "adverb": "副词",
        "noun": "名词",
        "pronoun": "代词",
        "preposition": "介词",
        "conjunction": "连词",
        "article": "冠词",
        "definite article": "定冠词",
        "indefinite article": "不定冠词",
        "comparative": "比较级",
        "superlative": "最高级",
        "conditionals": "条件句",
        "if clause": "条件状语从句",
        "direct speech": "直接引语",
        "indirect speech": "间接引语",
        "modal verb": "情态动词",
        "modal": "情态动词",
        "vocabulary": "词汇辨析",
        "word choice": "词汇辨析",
        "word usage": "词汇用法",
        "phrasal verb": "短语动词",
        "idiom": "习惯用语",
        "collocation": "固定搭配",
        "preposition choice": "介词搭配",
        "reading comprehension": "阅读理解",
        "cloze test": "完形填空",
        "grammar": "语法",
        "tense": "时态",
        "aspect": "体态",
        "voice": "语态",
        "sentence structure": "句子结构",
        "clause": "从句",
        "noun clause": "名词性从句",
        "adverbial clause": "状语从句",
        "word formation": "构词法",
        "prefix": "词缀",
        "suffix": "词缀",
        "antonyms": "反义词",
        "synonyms": "同义词",
        "meaning": "词义理解",
        "context": "语境理解",
        "intonation": "语调",
        "punctuation": "标点符号",
        "capitalization": "大小写",
        "spelling": "拼写",
    }
    text_lower = text.lower().strip()
    return MAP.get(text_lower, text)


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

Analyze the student's mistake. Return tags ONLY in Chinese, never in English."""
    try:
        ai = AIClient()
        response = ai.chat(ANALYSIS_SYSTEM, prompt)
        response = re.sub(r"^```json\s*", "", response.strip(), flags=re.IGNORECASE)
        response = re.sub(r"\s*```$", "", response.strip())
        result = json.loads(response)
        if isinstance(result, dict) and "analysis" in result:
            # 强制将标签翻译为中文
            tags = result.get("suggested_tags", [])
            result["suggested_tags"] = [_translate_to_chinese(t) for t in tags]
            return result
        return {"analysis": "解析生成失败", "suggested_tags": []}
    except (json.JSONDecodeError, Exception):
        return {"analysis": "解析生成失败，请稍后重试", "suggested_tags": []}
