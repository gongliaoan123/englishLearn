from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    options = Column(JSON, nullable=False)          # {"A": "...", "B": "...", "C": "...", "D": "..."}
    answer = Column(String(1), nullable=False)     # "A" | "B" | "C" | "D"
    docx_filename = Column(String(255), nullable=True)
    source = Column(String(20), default="imported")  # "imported" | "ai_generated"
    created_at = Column(DateTime, default=datetime.utcnow)

    tags = relationship("Tag", secondary="question_tag", back_populates="questions")
    wrong_questions = relationship("WrongQuestion", back_populates="question")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)  # always lowercase-kebab
    created_at = Column(DateTime, default=datetime.utcnow)

    questions = relationship("Question", secondary="question_tag", back_populates="tags")


class QuestionTag(Base):
    __tablename__ = "question_tag"

    question_id = Column(Integer, ForeignKey("questions.id"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id"), primary_key=True)


class WrongQuestion(Base):
    __tablename__ = "wrong_questions"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    user_id = Column(Integer, nullable=True)              # nullable for single-user
    wrong_count = Column(Integer, default=1)
    consecutive_correct = Column(Integer, default=0)     # reaches 3 -> "mastered"
    last_wrong_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="pending_review")  # pending_review | confirmed | mastered

    question = relationship("Question", back_populates="wrong_questions")
    analysis = relationship("AIAnalysis", back_populates="wrong_question", uselist=False)


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id = Column(Integer, primary_key=True, index=True)
    wrong_question_id = Column(Integer, ForeignKey("wrong_questions.id"), nullable=False, unique=True)
    analysis = Column(Text, nullable=False)
    suggested_tags = Column(JSON, nullable=False)   # list[str]
    confirmed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    wrong_question = relationship("WrongQuestion", back_populates="analysis")
