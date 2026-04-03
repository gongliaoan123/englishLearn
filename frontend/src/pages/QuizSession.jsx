import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import QuestionCard from '../components/QuestionCard'

// 知识点标签展示
function TagList({ tags }) {
  if (!tags || tags.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {tags.map(t => (
        <span key={t} style={{ background: '#EDE9FE', color: '#5B21B6', padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>
          #{t}
        </span>
      ))}
    </div>
  )
}

// 详解展示区（答对、答错都用这个组件）
function ExplanationPanel({ explanation, analysis, tags, isWrong }) {
  const [expanded, setExpanded] = useState(false)
  if (!explanation && !analysis) return null
  return (
    <div style={{ marginTop: 14, border: `1px solid ${isWrong ? '#FED7AA' : '#BFDBFE'}`, borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', padding: '10px 16px', background: 'none',
          border: 'none', cursor: 'pointer', textAlign: 'left',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: isWrong ? '#FFF7ED' : '#EFF6FF',
        }}
      >
        <span style={{ fontWeight: 600, color: isWrong ? '#9A3412' : '#1D4ED8', fontSize: 14 }}>
          {isWrong ? '🤖 AI 错题分析 + 📖 详解' : '📖 详解'}
        </span>
        <span style={{ color: '#666', fontSize: 13 }}>{expanded ? '▲ 收起' : '▼ 展开'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '14px 16px', background: isWrong ? '#FFF7ED' : '#F0F9FF' }}>
          {explanation && (
            <div style={{ marginBottom: analysis ? 14 : 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#9A3412', marginBottom: 4 }}>📖 详解</div>
              <p style={{ margin: 0, fontSize: 14, color: '#7C2D12', lineHeight: 1.6 }}>{explanation}</p>
            </div>
          )}
          {analysis && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#854D0E', marginBottom: 4 }}>🤖 AI 分析</div>
              <p style={{ margin: 0, fontSize: 14, color: '#713F12', lineHeight: 1.6 }}>{analysis}</p>
              <TagList tags={tags} />
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
  const [questions, setQuestions] = useState([])    // 历史题目（含答题结果）
  const [currentIdx, setCurrentIdx] = useState(0)  // 当前题目索引
  const [submitting, setSubmitting] = useState(false)
  // session 状态: 'idle' | 'wrong' | 'correct'
  const [sessionState, setSessionState] = useState('idle')
  const [wrongQuestionId, setWrongQuestionId] = useState(null)
  const [analysis, setAnalysis] = useState(null)   // AI 分析结果
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [total] = useState(10)

  const current = questions[currentIdx]
  const progress = questions.filter((_, i) => i < currentIdx || (i === currentIdx && sessionState !== 'idle')).length

  // 启动测试
  const startQuiz = async () => {
    const res = await api.startQuiz()
    setSessionId(res.session_id)
    setQuestions([])
    setCurrentIdx(0)
    setSessionState('idle')
    fetchNext()
  }

  // 获取下一题
  const fetchNext = async () => {
    setSubmitting(true)
    setSessionState('idle')
    setAnalysis(null)
    setWrongQuestionId(null)
    try {
      const pos = questions.length + 1
      const q = await api.nextQuestion(sessionId, pos)
      setQuestions(prev => [...prev, { ...q, selectedAnswer: null, isCorrect: null }])
      setCurrentIdx(questions.length)  // will be set after state updates
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // 等待 questions 更新后再设置 currentIdx
  useEffect(() => {
    if (questions.length > 0 && sessionState === 'idle' && !questions[currentIdx]?.question_id) {
      // new question just added
    }
  }, [questions])

  // 提交答案
  const handleSubmit = useCallback(async (selected) => {
    if (!current || sessionState !== 'idle') return
    setSubmitting(true)
    try {
      const res = await api.submitAnswer({
        session_id: sessionId,
        question_id: current.question_id,
        selected_answer: selected,
      })

      // 更新本题答题结果
      setQuestions(prev => {
        const updated = [...prev]
        updated[currentIdx] = { ...updated[currentIdx], selectedAnswer: selected, isCorrect: res.correct }
        return updated
      })

      if (res.is_session_over) {
        navigate('/wrong-log')
        return
      }

      if (res.correct) {
        setSessionState('correct')
      } else {
        setSessionState('wrong')
        setWrongQuestionId(res.wrong_question_id)
        // 加载 AI 分析
        setAnalysisLoading(true)
        try {
          const a = await api.getAnalysis(res.wrong_question_id)
          setAnalysis(a)
        } catch {
          setAnalysis({ analysis: '解析生成失败', suggested_tags: [] })
        } finally {
          setAnalysisLoading(false)
        }
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }, [current, sessionId, currentIdx, sessionState, navigate])

  // 确认分析 -> 下一题
  const handleConfirm = async () => {
    if (!wrongQuestionId) return
    setSubmitting(true)
    try {
      const tags = analysis?.suggested_tags || []
      await api.confirmAnalysis(wrongQuestionId, tags)
      if (questions.length >= total) {
        navigate('/wrong-log')
      } else {
        fetchNext()
        // 更新 currentIdx
        setCurrentIdx(questions.length)
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // 跳过分析 -> 下一题
  const handleSkip = async () => {
    if (!wrongQuestionId) return
    setSubmitting(true)
    try {
      await api.rejectAnalysis(wrongQuestionId)
      if (questions.length >= total) {
        navigate('/wrong-log')
      } else {
        fetchNext()
        setCurrentIdx(questions.length)
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // 上一题
  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(i => i - 1)
      setSessionState(questions[currentIdx - 1]?.isCorrect === false ? 'wrong'
                    : questions[currentIdx - 1]?.isCorrect === true ? 'correct' : 'idle')
      setAnalysis(null)
      setWrongQuestionId(null)
    }
  }

  // 等待下一题加载
  useEffect(() => {
    if (questions.length > 0 && !current?.question_id) {
      setCurrentIdx(questions.length - 1)
    }
  }, [questions])

  if (!sessionId || questions.length === 0) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <h2>✏️ 开始测试</h2>
        <p style={{ color: '#666' }}>每次测试 {total} 道选择题</p>
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
      {/* 进度条 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>✏️ 测试中</h2>
        <span style={{ color: '#666' }}>{Math.min(currentIdx + 1, total)} / {total}</span>
      </div>
      <div style={{ background: '#E5E7EB', height: 6, borderRadius: 3 }}>
        <div style={{ background: '#3B82F6', height: '100%', borderRadius: 3, width: `${(Math.min(currentIdx + 1, total) / total) * 100}%`, transition: 'width 0.3s' }} />
      </div>

      {/* 题号 */}
      <div style={{ marginTop: 14, fontSize: 13, color: '#666' }}>
        第 {Math.min(currentIdx + 1, total)} 题
      </div>

      {/* 题目卡片 */}
      <QuestionCard
        question={current}
        onSubmit={handleSubmit}
        submitting={submitting}
        disabled={sessionState !== 'idle'}
      />

      {/* 答对反馈 */}
      {sessionState === 'correct' && (
        <>
          <div style={{ marginTop: 14, padding: 14, background: '#DCFCE7', borderRadius: 8, color: '#166534' }}>
            ✅ 正确！正确答案：{current.answer}
          </div>
          {current.explanation && (
            <ExplanationPanel explanation={current.explanation} isWrong={false} />
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {currentIdx > 0 && (
              <button onClick={handlePrev} style={{ padding: '8px 18px', background: '#fff', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}>
                ← 上一题
              </button>
            )}
            <button
              onClick={fetchNext}
              style={{ flex: 1, padding: '10px 0', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }}
            >
              {questions.length >= total ? '查看结果' : '下一题 →'}
            </button>
          </div>
        </>
      )}

      {/* 答错反馈 */}
      {sessionState === 'wrong' && (
        <>
          <div style={{ marginTop: 14, padding: 14, background: '#FEE2E2', borderRadius: 8, color: '#991B1B' }}>
            ❌ 错误！你选了 {current.selectedAnswer}，正确答案：{current.answer}
          </div>

          {analysisLoading ? (
            <div style={{ marginTop: 14, padding: 14, textAlign: 'center', color: '#666', fontSize: 14 }}>
              🤖 AI 分析中...
            </div>
          ) : (
            <ExplanationPanel
              explanation={current.explanation}
              analysis={analysis?.analysis}
              tags={analysis?.suggested_tags}
              isWrong={true}
            />
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            {currentIdx > 0 && (
              <button onClick={handlePrev} style={{ padding: '8px 18px', background: '#fff', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}>
                ← 上一题
              </button>
            )}
            <button
              onClick={handleSkip}
              style={{ padding: '10px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}
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

      {/* 底部占位，防止内容被导航栏遮挡 */}
      <div style={{ height: 40 }} />
    </div>
  )
}
