import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import QuestionCard from '../components/QuestionCard'

// 详解 / AI分析 折叠面板
function ExplanationPanel({ explanation, analysis, tags, isWrong, loading }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div style={{ marginTop: 14, border: `1px solid ${isWrong ? '#FED7AA' : '#BFDBFE'}`, borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', padding: '10px 16px', border: 'none', cursor: 'pointer',
          textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: isWrong ? '#FFF7ED' : '#EFF6FF',
        }}
      >
        <span style={{ fontWeight: 600, color: isWrong ? '#9A3412' : '#1D4ED8', fontSize: 14 }}>
          {isWrong ? '🤖 AI 分析 + 📖 详解' : '📖 详解'}
        </span>
        <span style={{ color: '#666', fontSize: 13 }}>{expanded ? '▲ 收起' : '▼ 展开'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '14px 16px', background: isWrong ? '#FFF7ED' : '#F0F9FF' }}>
          {loading && <p style={{ color: '#666', fontSize: 14 }}>🤖 AI 分析中...</p>}
          {explanation && (
            <div style={{ marginBottom: analysis ? 14 : 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#9A3412', marginBottom: 4 }}>📖 详解</div>
              <p style={{ margin: 0, fontSize: 14, color: '#7C2D12', lineHeight: 1.6 }}>{explanation}</p>
            </div>
          )}
          {analysis && !loading && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#854D0E', marginBottom: 4 }}>🤖 AI 分析</div>
              <p style={{ margin: 0, fontSize: 14, color: '#713F12', lineHeight: 1.6 }}>{analysis}</p>
              {tags?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {tags.map(t => (
                    <span key={t} style={{ background: '#EDE9FE', color: '#5B21B6', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function QuizSession() {
  const navigate = useNavigate()
  const [sessionId, setSessionId] = useState(null)
  // questions: array of { question_id, content, options, explanation, answer, selectedAnswer, isCorrect }
  const [questions, setQuestions] = useState([])
  // answerState: 'idle' | 'correct' | 'wrong'
  const [answerState, setAnswerState] = useState('idle')
  const [submitting, setSubmitting] = useState(false)
  // 当前显示的分析（从 /api/analysis/{id} 加载）
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [wrongQuestionId, setWrongQuestionId] = useState(null)
  const TOTAL = 10

  // 当前题目（最后一个）
  const current = questions[questions.length - 1]
  const currentPos = questions.length  // 1-indexed

  // 启动测试
  const startQuiz = async () => {
    const res = await api.startQuiz()
    setSessionId(res.session_id)
    setQuestions([])
    setAnswerState('idle')
    setAnalysisResult(null)
    setWrongQuestionId(null)
    await _fetchNext(res.session_id, 1)
  }

  // 获取下一题（内部用，不读 state）
  const _fetchNext = async (sid, pos) => {
    setSubmitting(true)
    setAnswerState('idle')
    setAnalysisResult(null)
    setWrongQuestionId(null)
    try {
      const q = await api.nextQuestion(sid, pos)
      setQuestions(prev => [...prev, { ...q, selectedAnswer: null, isCorrect: null }])
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // 提交答案
  const handleSubmit = useCallback(async (selected) => {
    if (!current || answerState !== 'idle' || submitting) return
    setSubmitting(true)
    try {
      const res = await api.submitAnswer({
        session_id: sessionId,
        question_id: current.question_id,
        selected_answer: selected,
      })

      // 更新本题的答题结果
      setQuestions(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { ...updated[updated.length - 1], selectedAnswer: selected, isCorrect: res.correct }
        return updated
      })

      if (res.is_session_over) {
        navigate('/wrong-log')
        return
      }

      if (res.correct) {
        setAnswerState('correct')
      } else {
        setAnswerState('wrong')
        setWrongQuestionId(res.wrong_question_id)
        setAnalysisLoading(true)
        try {
          const a = await api.getAnalysis(res.wrong_question_id)
          setAnalysisResult(a)
        } catch {
          setAnalysisResult({ analysis: '解析生成失败', suggested_tags: [] })
        } finally {
          setAnalysisLoading(false)
        }
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }, [current, sessionId, answerState, submitting, navigate])

  // 确认分析 → 下一题
  const handleConfirm = async () => {
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
  }

  // 跳过分析 → 下一题
  const handleSkip = async () => {
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
  }

  // 上一题
  const handlePrev = () => {
    if (questions.length <= 1) return
    const removed = questions[questions.length - 1]
    setQuestions(prev => prev.slice(0, -1))
    // 恢复上一题的答题状态
    if (removed.isCorrect === false) {
      setAnswerState('wrong')
      setWrongQuestionId(null)  // 简化：忽略 wq_id
      setAnalysisResult(null)
    } else if (removed.isCorrect === true) {
      setAnswerState('correct')
    } else {
      setAnswerState('idle')
    }
  }

  // --- 渲染 ---

  if (!sessionId || questions.length === 0) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <h2>✏️ 开始测试</h2>
        <p style={{ color: '#666' }}>每次测试 {TOTAL} 道选择题</p>
        <button
          onClick={startQuiz}
          style={{ marginTop: 24, padding: '12px 40px', fontSize: 16, background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          开始测试 →
        </button>
      </div>
    )
  }

  if (submitting && !current) {
    return <p style={{ paddingTop: 40, textAlign: 'center' }}>加载中...</p>
  }

  return (
    <div style={{ paddingTop: 24 }}>
      {/* 进度 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>✏️ 测试中</h2>
        <span style={{ color: '#666' }}>{Math.min(currentPos, TOTAL)} / {TOTAL}</span>
      </div>
      <div style={{ background: '#E5E7EB', height: 6, borderRadius: 3, marginTop: 8 }}>
        <div style={{ background: '#3B82F6', height: '100%', borderRadius: 3, width: `${(Math.min(currentPos, TOTAL) / TOTAL) * 100}%`, transition: 'width 0.3s' }} />
      </div>
      <div style={{ marginTop: 10, fontSize: 13, color: '#666' }}>第 {currentPos} 题</div>

      {/* 题目卡片 */}
      <QuestionCard
        question={current}
        onSubmit={handleSubmit}
        submitting={submitting}
        disabled={answerState !== 'idle'}
      />

      {/* 答对 */}
      {answerState === 'correct' && (
        <>
          <div style={{ marginTop: 14, padding: 14, background: '#DCFCE7', borderRadius: 8, color: '#166534' }}>
            ✅ 正确！正确答案：{current.answer}
          </div>
          {current.explanation && (
            <ExplanationPanel explanation={current.explanation} isWrong={false} loading={false} />
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {questions.length > 1 && (
              <button onClick={handlePrev} style={{ padding: '9px 18px', background: '#fff', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}>
                ← 上一题
              </button>
            )}
            <button
              onClick={() => _fetchNext(sessionId, currentPos + 1)}
              style={{ flex: 1, padding: '10px 0', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}
            >
              {currentPos >= TOTAL ? '查看结果' : '下一题 →'}
            </button>
          </div>
        </>
      )}

      {/* 答错 */}
      {answerState === 'wrong' && (
        <>
          <div style={{ marginTop: 14, padding: 14, background: '#FEE2E2', borderRadius: 8, color: '#991B1B' }}>
            ❌ 错误！你选了 {current.selectedAnswer}，正确答案：{current.answer}
          </div>
          <ExplanationPanel
            explanation={current.explanation}
            analysis={analysisResult?.analysis}
            tags={analysisResult?.suggested_tags}
            isWrong={true}
            loading={analysisLoading}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {questions.length > 1 && (
              <button onClick={handlePrev} style={{ padding: '9px 18px', background: '#fff', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}>
                ← 上一题
              </button>
            )}
            <button
              onClick={handleSkip}
              style={{ padding: '10px 14px', background: '#fff', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}
            >
              跳过
            </button>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              style={{ flex: 1, padding: '10px 0', background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}
            >
              {submitting ? '处理中...' : '✅ 确认，开始举一反三'}
            </button>
          </div>
        </>
      )}

      <div style={{ height: 40 }} />
    </div>
  )
}
