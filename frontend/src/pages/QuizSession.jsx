import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import QuestionCard from '../components/QuestionCard'

const LS_KEY = 'quiz_session'

function saveSession(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)) } catch {}
}
function loadSession() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') } catch { return null }
}
function clearSession() {
  try { localStorage.removeItem(LS_KEY) } catch {}
}

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
  // questions[i]: { question_id, content, options, explanation, answer, selectedAnswer, isCorrect, wrongQuestionId, analysisResult }
  const [questions, setQuestions] = useState([])
  // 当前在数组中的索引
  const [currentIdx, setCurrentIdx] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const TOTAL = 10

  const current = questions[currentIdx]
  const isAtLast = currentIdx === questions.length - 1
  const currentPos = currentIdx + 1  // 1-indexed display

  // 挂载时恢复 session
  useEffect(() => {
    const saved = loadSession()
    if (saved?.sessionId) {
      setSessionId(saved.sessionId)
      setQuestions(saved.questions || [])
      setCurrentIdx(Math.min(saved.currentIdx || 0, (saved.questions?.length || 1) - 1))
    }
  }, [])

  // 每次状态变化同步到 localStorage
  useEffect(() => {
    if (sessionId) {
      saveSession({ sessionId, questions, currentIdx })
    }
  }, [sessionId, questions, currentIdx])

  // 启动全新测试
  const startQuiz = async () => {
    const res = await api.startQuiz()
    setSessionId(res.session_id)
    setQuestions([])
    setCurrentIdx(0)
    const q = await api.nextQuestion(res.session_id, 1)
    setQuestions([{ ...q, selectedAnswer: null, isCorrect: null, wrongQuestionId: null, analysisResult: null }])
  }

  // 添加新题（始终加到末尾并跳转）
  const addNextQuestion = useCallback(async () => {
    if (!sessionId) return
    setSubmitting(true)
    try {
      const pos = questions.length + 1
      const q = await api.nextQuestion(sessionId, pos)
      setQuestions(prev => {
        const next = [...prev, { ...q, selectedAnswer: null, isCorrect: null, wrongQuestionId: null, analysisResult: null }]
        // 同步设置 idx，useEffect 下次 render 前 idx 已经更新
        setCurrentIdx(next.length - 1)
        return next
      })
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }, [sessionId, questions.length])

  // 提交答案
  const handleSubmit = useCallback(async (selected) => {
    if (!current || !isAtLast || submitting) return
    if (current.isCorrect !== null) return  // 已答过
    setSubmitting(true)
    try {
      const res = await api.submitAnswer({
        session_id: sessionId,
        question_id: current.question_id,
        selected_answer: selected,
      })

      setQuestions(prev => {
        const updated = [...prev]
        updated[currentIdx] = {
          ...updated[currentIdx],
          selectedAnswer: selected,
          isCorrect: res.correct,
          wrongQuestionId: res.wrong_question_id || null,
          analysisResult: null,
        }
        return updated
      })

      if (res.is_session_over) {
        clearSession()
        navigate('/wrong-log')
        return
      }

      if (!res.correct) {
        // 异步加载 AI 分析
        setQuestions(prev => {
          const updated = [...prev]
          updated[currentIdx] = { ...updated[currentIdx], isCorrect: false, wrongQuestionId: res.wrong_question_id }
          return updated
        })
        try {
          const a = await api.getAnalysis(res.wrong_question_id)
          setQuestions(prev => {
            const updated = [...prev]
            updated[currentIdx] = { ...updated[currentIdx], analysisResult: a }
            return updated
          })
        } catch {
          setQuestions(prev => {
            const updated = [...prev]
            updated[currentIdx] = { ...updated[currentIdx], analysisResult: { analysis: '解析生成失败', suggested_tags: [] } }
            return updated
          })
        }
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }, [current, isAtLast, sessionId, currentIdx, submitting, navigate])

  // 确认分析 → 添加下一题
  const handleConfirm = async () => {
    if (!current?.wrongQuestionId) return
    setSubmitting(true)
    try {
      const tags = current.analysisResult?.suggested_tags || []
      await api.confirmAnalysis(current.wrongQuestionId, tags)
      if (questions.length >= TOTAL) {
        clearSession()
        navigate('/wrong-log')
      } else {
        addNextQuestion()
      }
    } catch (err) {
      alert('操作失败：' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // 跳过分析 → 添加下一题
  const handleSkip = async () => {
    if (!current?.wrongQuestionId) return
    setSubmitting(true)
    try {
      await api.rejectAnalysis(current.wrongQuestionId)
      if (questions.length >= TOTAL) {
        clearSession()
        navigate('/wrong-log')
      } else {
        addNextQuestion()
      }
    } catch (err) {
      alert('操作失败：' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // 上一题
  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(i => i - 1)
    }
  }

  // 下一题（仅当处于最后一题且未答完时可用）
  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(i => i + 1)
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

  if (!current) {
    return <p style={{ paddingTop: 40, textAlign: 'center' }}>加载中...</p>
  }

  const isAnswered = current.isCorrect !== null
  const isCorrect = current.isCorrect === true
  const isWrong = current.isCorrect === false
  const canSubmit = isAtLast && !isAnswered && !submitting

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
      <div style={{ marginTop: 10, fontSize: 13, color: '#666' }}>
        第 {currentPos} 题
        {questions.length > 1 && `（共 ${questions.length} 题，已答 ${questions.filter(q => q.isCorrect !== null).length} 题）`}
      </div>

      {/* 题目卡片（仅最后一题可提交） */}
      <QuestionCard
        question={current}
        onSubmit={handleSubmit}
        submitting={submitting}
        disabled={!canSubmit}
      />

      {/* 答对 */}
      {isCorrect && (
        <>
          <div style={{ marginTop: 14, padding: 14, background: '#DCFCE7', borderRadius: 8, color: '#166534' }}>
            ✅ 正确！正确答案：{current.answer}
          </div>
          {current.explanation && (
            <ExplanationPanel explanation={current.explanation} isWrong={false} loading={false} analysis={null} tags={null} />
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {currentIdx > 0 && (
              <button onClick={handlePrev} style={{ padding: '9px 18px', background: '#fff', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}>
                ← 上一题
              </button>
            )}
            {currentIdx < questions.length - 1 ? (
              <button onClick={handleNext} style={{ flex: 1, padding: '10px 0', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>
                下一题 →
              </button>
            ) : questions.length < TOTAL ? (
              <button onClick={addNextQuestion} style={{ flex: 1, padding: '10px 0', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>
                下一题 →
              </button>
            ) : (
              <button onClick={() => { clearSession(); navigate('/wrong-log') }} style={{ flex: 1, padding: '10px 0', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>
                查看结果
              </button>
            )}
          </div>
        </>
      )}

      {/* 答错 */}
      {isWrong && (
        <>
          <div style={{ marginTop: 14, padding: 14, background: '#FEE2E2', borderRadius: 8, color: '#991B1B' }}>
            ❌ 错误！你选了 {current.selectedAnswer}，正确答案：{current.answer}
          </div>
          <ExplanationPanel
            explanation={current.explanation}
            analysis={current.analysisResult?.analysis}
            tags={current.analysisResult?.suggested_tags}
            isWrong={true}
            loading={!current.analysisResult && submitting}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {currentIdx > 0 && (
              <button onClick={handlePrev} style={{ padding: '9px 18px', background: '#fff', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}>
                ← 上一题
              </button>
            )}
            <button onClick={handleSkip} style={{ padding: '10px 14px', background: '#fff', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}>
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

      {/* 未答且非最后一题 */}
      {!isAnswered && !isAtLast && (
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          {currentIdx > 0 && (
            <button onClick={handlePrev} style={{ padding: '9px 18px', background: '#fff', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}>
              ← 上一题
            </button>
          )}
          <button onClick={handleNext} style={{ flex: 1, padding: '10px 0', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}>
            下一题 →
          </button>
        </div>
      )}

      <div style={{ height: 40 }} />
    </div>
  )
}
