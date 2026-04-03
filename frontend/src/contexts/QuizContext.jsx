import React, { createContext, useContext, useState, useCallback } from 'react'
import { api } from '../api'

const QuizContext = createContext(null)

export function QuizProvider({ children }) {
  const [sessionId, setSessionId] = useState(null)
  // questions: only contains questions that have been ANSWERED (with result)
  // unanswered future questions are NOT in this array
  const [questions, setQuestions] = useState([])
  // currentPos: index into questions (-1 = first question not yet answered)
  // first unanswered question is always at index = questions.length
  const [currentPos, setCurrentPos] = useState(-1)
  // tempCurrent: the question currently being displayed (not yet answered)
  const [tempCurrent, setTempCurrent] = useState(null)
  const [answerState, setAnswerState] = useState('idle')  // 'idle' | 'correct' | 'wrong'
  const [analysisResult, setAnalysisResult] = useState(null)
  const [wrongQuestionId, setWrongQuestionId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const TOTAL = 10

  // The question to display: tempCurrent (unanswered) first, then questions[currentPos]
  const current = tempCurrent

  // 启动测试
  const startQuiz = useCallback(async () => {
    const res = await api.startQuiz()
    setSessionId(res.session_id)
    setQuestions([])
    setCurrentPos(-1)
    setAnswerState('idle')
    setAnalysisResult(null)
    setWrongQuestionId(null)
    setTempCurrent(null)
    await _fetchNext(res.session_id)
  }, [])

  // 获取下一题到 tempCurrent（不追加到 questions 数组）
  const _fetchNext = useCallback(async (sid) => {
    setSubmitting(true)
    setAnswerState('idle')
    setAnalysisResult(null)
    setWrongQuestionId(null)
    try {
      const pos = questions.length + 1
      const q = await api.nextQuestion(sid, pos)
      setTempCurrent({ ...q, selectedAnswer: null, isCorrect: null })
    } catch (err) {
      console.error('fetchNext error:', err)
    } finally {
      setSubmitting(false)
    }
  }, [questions.length])

  // 提交答案（将 tempCurrent 移入 questions，更新 currentPos）
  const submitAnswer = useCallback(async (selected) => {
    if (!current || answerState !== 'idle' || submitting) return
    setSubmitting(true)
    try {
      const res = await api.submitAnswer({
        session_id: sessionId,
        question_id: current.question_id,
        selected_answer: selected,
      })
      const answered = {
        ...current,
        selectedAnswer: selected,
        isCorrect: res.correct,
      }
      setQuestions(prev => [...prev, answered])
      setCurrentPos(prev => prev + 1)
      setTempCurrent(null)

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

  // 跳转到指定已答题目
  const jumpTo = useCallback((idx) => {
    if (idx < 0 || idx >= questions.length) return
    setCurrentPos(idx)
    setTempCurrent(null)
    const target = questions[idx]
    if (target.isCorrect === true) {
      setAnswerState('correct')
    } else if (target.isCorrect === false) {
      setAnswerState('wrong')
      setWrongQuestionId(null)
      setAnalysisResult(null)
    } else {
      setAnswerState('idle')
    }
  }, [questions])

  // 确认分析 → 下一题（将 tempCurrent 追加，fetch 新题）
  const confirmAnalysis = useCallback(async (navigate) => {
    if (!wrongQuestionId) return
    setSubmitting(true)
    try {
      const tags = analysisResult?.suggested_tags || []
      await api.confirmAnalysis(wrongQuestionId, tags)
      if (questions.length >= TOTAL) {
        navigate('/wrong-log')
      } else {
        setWrongQuestionId(null)
        setAnalysisResult(null)
        setAnswerState('idle')
        // fetch next into tempCurrent
        await _fetchNext(sessionId)
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
        setWrongQuestionId(null)
        setAnalysisResult(null)
        setAnswerState('idle')
        await _fetchNext(sessionId)
      }
    } catch (err) {
      alert('操作失败：' + err.message)
    } finally {
      setSubmitting(false)
    }
  }, [wrongQuestionId, questions.length, sessionId, _fetchNext])

  // 答对后下一题（追加当前题，fetch 新题）
  const nextQuestion = useCallback(async (navigate) => {
    // 先把 tempCurrent 追加进 questions（如果没有的话）
    if (tempCurrent) {
      const answered = { ...tempCurrent, selectedAnswer: null, isCorrect: null }
      setQuestions(prev => [...prev, answered])
      setCurrentPos(prev => prev + 1)
      setTempCurrent(null)
    }
    if (questions.length + (tempCurrent ? 1 : 0) >= TOTAL) {
      navigate('/wrong-log')
    } else {
      await _fetchNext(sessionId)
    }
  }, [questions.length, tempCurrent, sessionId, _fetchNext])

  // 上一题
  const prevQuestion = useCallback(() => {
    if (tempCurrent) {
      // 还没答当前题，删除 tempCurrent，回复到上一题
      setTempCurrent(null)
      setAnswerState('idle')
    } else if (currentPos > 0) {
      // 跳转到上一题
      const prevIdx = currentPos - 1
      const target = questions[prevIdx]
      setCurrentPos(prevIdx)
      if (target.isCorrect === true) {
        setAnswerState('correct')
      } else if (target.isCorrect === false) {
        setAnswerState('wrong')
        setWrongQuestionId(null)
        setAnalysisResult(null)
      } else {
        setAnswerState('idle')
      }
    }
  }, [tempCurrent, currentPos, questions])

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
