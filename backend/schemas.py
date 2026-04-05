from pydantic import BaseModel
from typing import Optional


class QuestionImportResponse(BaseModel):
    imported: int
    skipped: int
    errors: list[str]


class QuestionResponse(BaseModel):
    id: int
    content: str
    options: dict
    answer: str
    explanation: Optional[str]
    docx_filename: Optional[str]
    tags: list[str]
    source: str

    class Config:
        from_attributes = True


class QuestionListResponse(BaseModel):
    questions: list[QuestionResponse]
    total: int


class QuestionCreate(BaseModel):
    content: str
    options: dict       # {"A": "...", "B": "...", "C": "...", "D": "..."}
    answer: str         # "A" | "B" | "C" | "D"
    explanation: str | None = None
    tags: list[str] = []


class QuestionUpdate(BaseModel):
    content: str | None = None
    options: dict | None = None
    answer: str | None = None
    explanation: str | None = None
    tags: list[str] | None = None


# --- Quiz schemas ---

class QuizStartResponse(BaseModel):
    session_id: str
    total: int  # 10

class QuizNextResponse(BaseModel):
    question_id: int
    content: str
    options: dict
    answer: str
    explanation: Optional[str]
    current: int   # 1-indexed position in session
    total: int      # 10

class QuizAnswerRequest(BaseModel):
    session_id: str
    question_id: int
    selected_answer: str   # "A" | "B" | "C" | "D"

class QuizAnswerResponse(BaseModel):
    correct: bool
    correct_answer: str
    wrong_question_id: int | None  # set only if wrong
    is_session_over: bool

class SessionSummaryResponse(BaseModel):
    session_id: str
    total: int
    correct: bool        # whether the final answer was correct
    correct_count: int  # how many correct in total
    wrong: int
    wrong_question_ids: list[int]


# --- Analysis schemas ---

class AIAnalysisResponse(BaseModel):
    id: int
    analysis: str
    suggested_tags: list[str]
    confirmed: bool

    class Config:
        from_attributes = True


class AnalysisConfirmRequest(BaseModel):
    tags: list[str] | None = None  # optional user edits


class SimilarQuestionsResponse(BaseModel):
    questions: list[QuestionResponse]
    generated_count: int  # how many were AI-generated vs from DB
