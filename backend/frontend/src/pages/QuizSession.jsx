import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import QuestionCard from '../components/QuestionCard'
import AnalysisReview from './AnalysisReview'

export default function QuizSession() {
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState(null)
  const [current, setCurrent] = useState(1)
  const [question, setQuestion] = useState(null)
  const [total] = useState(10)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [pendingWqId, setPendingWqId] = useState(null)

  const startQuiz = async () => {
    const res = await api.startQuiz()
    setSessionId(res.session_id)
    fetchNext(res.session_id, 1)
  }

  const fetchNext = async (sid, pos) => {
    setSubmitting(true)
    setFeedback(null)
    try {
      const q = await api.nextQuestion(sid, pos)
      setQuestion(q)
      setCurrent(pos)
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = useCallback(async (selected, reset) => {
    setSubmitting(true)
    try {
      const res = await api.submitAnswer({
        session_id: sessionId,
        question_id: question.question_id,
        selected_answer: selected,
      })
      if (res.is_session_over) {
        navigate('/wrong-log')
        return
      }
      setFeedback(res)
      reset()
      if (!res.correct) {
        setPendingWqId(res.wrong_question_id)
      } else {
        setTimeout(() => {
          fetchNext(sessionId, current + 1)
        }, 1200)
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }, [sessionId, question, current, navigate])

  const handleAnalysisDone = () => {
    setPendingWqId(null)
    setFeedback(null)
    fetchNext(sessionId, current + 1)
  }

  if (!sessionId) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <h2>✏️ 开始测试</h2>
        <p style={{ color: '#666' }}>每次测试 10 道选择题</p>
        <button
          onClick={startQuiz}
          style={{ marginTop: 24, padding: '12px 40px', fontSize: 16, background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          开始测试 →
        </button>
      </div>
    )
  }

  if (!question) {
    return <p style={{ paddingTop: 40, textAlign: 'center' }}>加载中...</p>
  }

  if (!feedback?.correct && pendingWqId) {
    return (
      <AnalysisReview
        wrongQuestionId={pendingWqId}
        onDone={handleAnalysisDone}
      />
    )
  }

  return (
    <div style={{ paddingTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>✏️ 测试中</h2>
        <span style={{ color: '#666' }}>{current} / {total}</span>
      </div>
      <div style={{ background: '#F3F4F6', height: 6, borderRadius: 3, margin: '12px 0 0' }}>
        <div style={{ background: '#3B82F6', height: '100%', borderRadius: 3, width: `${(current / total) * 100}%`, transition: 'width 0.3s' }} />
      </div>

      <QuestionCard
        question={question}
        onSubmit={handleSubmit}
        submitting={submitting}
      />

      {feedback?.correct && (
        <div style={{ marginTop: 16, padding: 16, background: '#DCFCE7', borderRadius: 8, color: '#166534' }}>
          ✅ 正确！正确答案：{feedback.correct_answer}
        </div>
      )}
    </div>
  )
}
