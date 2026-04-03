import React, { createContext, useContext, useState, useCallback } from 'react'
import { api } from '../api'

const QuizContext = createContext(null)

export function QuizProvider({ children }) {
  const [sessionId, setSessionId] = useState(null)
  // questions: full list of questions in order
  const [questions, setQuestions] = useState([])
  // currentPos: index into questions array (-1 = not started)
  const [currentPos, setCurrentPos] = useState(-1)
  const [answerState, setAnswerState] = useState('idle')  // 'idle' | 'correct' | 'wrong'
  const [analysisResult, setAnalysisResult] = useState(null)
  const [wrongQuestionId, setWrongQuestionId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const TOTAL = 10

  const current = currentPos >= 0 ? questions[currentPos] : null

  // 启动测试
  const startQuiz = useCallback(async () => {
    const res = await api.startQuiz()
    setSessionId(res.session_id)
    setQuestions([])
    setCurrentPos(-1)
    setAnswerState('idle')
    setAnalysisResult(null)
    setWrongQuestionId(null)
    await _fetchNext(res.session_id, 1)
  }, [])

  // 获取下一题并追加到列表
  const _fetchNext = useCallback(async (sid, pos) => {
    setSubmitting(true)
    setAnswerState('idle')
    setAnalysisResult(null)
    setWrongQuestionId(null)
    try {
      const q = await api.nextQuestion(sid, pos)
      setQuestions(prev => [...prev, { ...q, selectedAnswer: null, isCorrect: null }])
      setCurrentPos(prev => prev + 1)
    } catch (err) {
      console.error('fetchNext error:', err)
    } finally {
      setSubmitting(false)
    }
  }, [])

  // 提交答案（更新当前题）
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
        updated[currentPos] = {
          ...updated[currentPos],
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
  }, [current, currentPos, sessionId, answerState, submitting])

  // 跳转到指定题
  const jumpTo = useCallback((idx) => {
    if (idx < 0 || idx >= questions.length) return
    const target = questions[idx]
    setCurrentPos(idx)
    if (target.isCorrect === true) {
      setAnswerState('correct')
      setWrongQuestionId(null)
      setAnalysisResult(null)
    } else if (target.isCorrect === false) {
      setAnswerState('wrong')
      setWrongQuestionId(null)
      setAnalysisResult(null)
    } else {
      setAnswerState('idle')
      setWrongQuestionId(null)
      setAnalysisResult(null)
    }
  }, [questions])

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

  // 下一题
  const nextQuestion = useCallback(async (navigate) => {
    if (currentPos < questions.length - 1) {
      // 还有已答的题可以往后翻
      jumpTo(currentPos + 1)
    } else if (questions.length >= TOTAL) {
      navigate('/wrong-log')
    } else {
      await _fetchNext(sessionId, questions.length + 1)
    }
  }, [currentPos, questions.length, sessionId, _fetchNext, jumpTo])

  // 上一题
  const prevQuestion = useCallback(() => {
    if (currentPos > 0) {
      jumpTo(currentPos - 1)
    }
  }, [currentPos, jumpTo])

  return (
    <QuizContext.Provider value={{
      sessionId, questions, current, currentPos, answerState, submitting,
      analysisResult, wrongQuestionId, TOTAL,
      startQuiz, submitAnswer, confirmAnalysis, skipAnalysis,
      nextQuestion, prevQuestion, jumpTo, _fetchNext,
    }}>
      {children}
    </QuizContext.Provider>
  )
}

export const useQuiz = () => useContext(QuizContext)
