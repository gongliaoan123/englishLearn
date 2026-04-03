import React, { createContext, useContext, useState, useCallback } from 'react'
import { api } from '../api'

const QuizContext = createContext(null)

export function QuizProvider({ children }) {
  const [sessionId, setSessionId] = useState(null)
  // All questions in order: unanswered (selectedAnswer=null) + answered
  const [questions, setQuestions] = useState([])
  const [currentPos, setCurrentPos] = useState(-1)  // index into questions
  const [answerState, setAnswerState] = useState('idle')  // 'idle' | 'correct' | 'wrong'
  const [analysisResult, setAnalysisResult] = useState(null)
  const [wrongQuestionId, setWrongQuestionId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmedWrongIds, setConfirmedWrongIds] = useState(() => new Set())
  const TOTAL = 10

  // current = the question currently displayed (at currentPos)
  const current = currentPos >= 0 ? questions[currentPos] : null
  const displayPos = currentPos + 1  // 1-indexed

  // 启动测试
  const startQuiz = useCallback(async () => {
    const res = await api.startQuiz()
    setSessionId(res.session_id)
    setQuestions([])
    setCurrentPos(-1)
    setAnswerState('idle')
    setAnalysisResult(null)
    setWrongQuestionId(null)
    setConfirmedWrongIds(() => new Set())
    // fetch first question
    const q = await api.nextQuestion(res.session_id, 1)
    setQuestions([{ ...q, selectedAnswer: null, isCorrect: null }])
    setCurrentPos(0)
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
      // 更新当前题结果
      setQuestions(prev => {
        const updated = [...prev]
        updated[currentPos] = { ...updated[currentPos], selectedAnswer: selected, isCorrect: res.correct }
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
  }, [current, currentPos, sessionId, answerState, submitting])

  // 确认分析 → 下一题
  const confirmAnalysis = useCallback(async (navigate) => {
    if (!wrongQuestionId) return
    setSubmitting(true)
    try {
      const tags = analysisResult?.suggested_tags || []
      await api.confirmAnalysis(wrongQuestionId, tags)
      setConfirmedWrongIds(prev => new Set([...prev, wrongQuestionId]))
      await _loadNext(navigate)
    } catch (err) {
      alert('操作失败：' + err.message)
    } finally {
      setSubmitting(false)
    }
  }, [wrongQuestionId, analysisResult, questions.length, sessionId, currentPos])

  // 跳过 → 下一题
  const skipAnalysis = useCallback(async (navigate) => {
    if (!wrongQuestionId) return
    setSubmitting(true)
    try {
      await api.rejectAnalysis(wrongQuestionId)
      setConfirmedWrongIds(prev => new Set([...prev, wrongQuestionId]))
      await _loadNext(navigate)
    } catch (err) {
      alert('操作失败：' + err.message)
    } finally {
      setSubmitting(false)
    }
  }, [wrongQuestionId, questions.length, sessionId, currentPos])

  // 内部：加载下一题
  const _loadNext = useCallback(async (navigate) => {
    setAnswerState('idle')
    setAnalysisResult(null)
    setWrongQuestionId(null)
    if (questions.length >= TOTAL) {
      navigate('/wrong-log')
      return
    }
    const nextPos = questions.length
    // 已经有下一题了（之前预加载的），直接跳
    if (nextPos < questions.length) {
      setCurrentPos(nextPos)
      return
    }
    // fetch 新题并追加
    setSubmitting(true)
    try {
      const q = await api.nextQuestion(sessionId, nextPos + 1)
      setQuestions(prev => [...prev, { ...q, selectedAnswer: null, isCorrect: null }])
      setCurrentPos(nextPos)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }, [questions.length, sessionId])

  // 下一题
  const nextQuestion = useCallback(async (navigate) => {
    // 先尝试跳到已有题目
    if (currentPos < questions.length - 1) {
      jumpTo(currentPos + 1)
      return
    }
    // 真的没有下一题了，才创建新的
    if (questions.length >= TOTAL) {
      navigate('/wrong-log')
      return
    }
    setSubmitting(true)
    setAnswerState('idle')
    setAnalysisResult(null)
    setWrongQuestionId(null)
    try {
      const nextPos = questions.length
      const q = await api.nextQuestion(sessionId, nextPos + 1)
      setQuestions(prev => [...prev, { ...q, selectedAnswer: null, isCorrect: null }])
      setCurrentPos(nextPos)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }, [currentPos, questions.length, sessionId])

  // 上一题
  const prevQuestion = useCallback(() => {
    if (currentPos > 0) {
      const prevPos = currentPos - 1
      const target = questions[prevPos]
      setCurrentPos(prevPos)
      setAnswerState('idle')
      setAnalysisResult(null)
      setWrongQuestionId(null)
      if (target.isCorrect === true) {
        setAnswerState('correct')
      } else if (target.isCorrect === false) {
        setAnswerState('wrong')
        setWrongQuestionId(null)
        setAnalysisResult(null)
      }
    }
  }, [currentPos, questions])

  // 跳转到指定题
  const jumpTo = useCallback((idx) => {
    if (idx < 0 || idx >= questions.length) return
    setCurrentPos(idx)
    setAnswerState('idle')
    setAnalysisResult(null)
    setWrongQuestionId(null)
    const target = questions[idx]
    if (target.isCorrect === true) {
      setAnswerState('correct')
    } else if (target.isCorrect === false) {
      setAnswerState('wrong')
      setWrongQuestionId(null)
      setAnalysisResult(null)
    }
  }, [questions])

  return (
    <QuizContext.Provider value={{
      sessionId, questions, current, currentPos, answerState, submitting,
      analysisResult, wrongQuestionId, confirmedWrongIds, TOTAL,
      startQuiz, submitAnswer, confirmAnalysis, skipAnalysis,
      nextQuestion, prevQuestion, jumpTo,
    }}>
      {children}
    </QuizContext.Provider>
  )
}

export const useQuiz = () => useContext(QuizContext)
