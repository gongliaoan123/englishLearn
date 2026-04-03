import React, { createContext, useContext, useState, useCallback } from 'react'
import { api } from '../api'

const QuizContext = createContext(null)

export function QuizProvider({ children }) {
  const [sessionId, setSessionId] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answerState, setAnswerState] = useState('idle')  // 'idle' | 'correct' | 'wrong'
  const [analysisResult, setAnalysisResult] = useState(null)
  const [wrongQuestionId, setWrongQuestionId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const TOTAL = 10

  const current = questions[questions.length - 1]

  // 启动测试
  const startQuiz = useCallback(async () => {
    const res = await api.startQuiz()
    setSessionId(res.session_id)
    setQuestions([])
    setAnswerState('idle')
    setAnalysisResult(null)
    setWrongQuestionId(null)
    await _fetchNext(res.session_id, 1)
  }, [])

  // 内部获取下一题
  const _fetchNext = useCallback(async (sid, pos) => {
    setSubmitting(true)
    setAnswerState('idle')
    setAnalysisResult(null)
    setWrongQuestionId(null)
    try {
      const q = await api.nextQuestion(sid, pos)
      setQuestions(prev => [...prev, { ...q, selectedAnswer: null, isCorrect: null }])
    } catch (err) {
      console.error('fetchNext error:', err)
    } finally {
      setSubmitting(false)
    }
  }, [])

  // 提交答案
  const submitAnswer = useCallback(async (selected) => {
    if (!current || answerState !== 'idle' || submitting) return
    setSubmitting(true)
    try {
      const res = await api.submitAnswer({
        session_id: sessionId,
        question_id: current.question_id,
        selected_answer: selected,
      })
      setQuestions(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          selectedAnswer: selected,
          isCorrect: res.correct,
        }
        return updated
      })
      if (res.correct) {
        setAnswerState('correct')
      } else {
        setAnswerState('wrong')
        setWrongQuestionId(res.wrong_question_id)
        try {
          const a = await api.getAnalysis(res.wrong_question_id)
          setAnalysisResult(a)
        } catch {
          setAnalysisResult({ analysis: '解析生成失败', suggested_tags: [] })
        }
      }
      return res
    } finally {
      setSubmitting(false)
    }
  }, [current, sessionId, answerState, submitting])

  // 确认分析 → 下一题
  const confirmAnalysis = useCallback(async (navigate) => {
    if (!wrongQuestionId) return
    setSubmitting(true)
    try {
      const tags = analysisResult?.suggested_tags || []
      await api.confirmAnalysis(wrongQuestionId, tags)
      if (questions.length >= TOTAL) {
        navigate('/wrong-log')
      } else {
        await _fetchNext(sessionId, questions.length + 1)
      }
    } catch (err) {
      alert('操作失败：' + err.message)
    } finally {
      setSubmitting(false)
    }
  }, [wrongQuestionId, analysisResult, questions.length, sessionId, _fetchNext])

  // 跳过 → 下一题
  const skipAnalysis = useCallback(async (navigate) => {
    if (!wrongQuestionId) return
    setSubmitting(true)
    try {
      await api.rejectAnalysis(wrongQuestionId)
      if (questions.length >= TOTAL) {
        navigate('/wrong-log')
      } else {
        await _fetchNext(sessionId, questions.length + 1)
      }
    } catch (err) {
      alert('操作失败：' + err.message)
    } finally {
      setSubmitting(false)
    }
  }, [wrongQuestionId, questions.length, sessionId, _fetchNext])

  // 答对后下一题
  const nextQuestion = useCallback(async (navigate) => {
    if (questions.length >= TOTAL) {
      navigate('/wrong-log')
    } else {
      await _fetchNext(sessionId, questions.length + 1)
    }
  }, [questions.length, sessionId, _fetchNext])

  // 上一题
  const prevQuestion = useCallback(() => {
    if (questions.length <= 1) return
    const removed = questions[questions.length - 1]
    setQuestions(prev => prev.slice(0, -1))
    if (removed.isCorrect === false) {
      setAnswerState('wrong')
      setWrongQuestionId(null)
      setAnalysisResult(null)
    } else if (removed.isCorrect === true) {
      setAnswerState('correct')
    } else {
      setAnswerState('idle')
    }
  }, [questions])

  return (
    <QuizContext.Provider value={{
      sessionId, questions, current, answerState, submitting,
      analysisResult, wrongQuestionId, TOTAL,
      startQuiz, submitAnswer, confirmAnalysis, skipAnalysis,
      nextQuestion, prevQuestion, _fetchNext,
    }}>
      {children}
    </QuizContext.Provider>
  )
}

export const useQuiz = () => useContext(QuizContext)
