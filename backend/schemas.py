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
    docx_filename: Optional[str]
    tags: list[str]
    source: str

    class Config:
        from_attributes = True


class QuestionListResponse(BaseModel):
    questions: list[QuestionResponse]
    total: int
