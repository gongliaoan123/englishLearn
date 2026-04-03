import React, { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuiz } from '../contexts/QuizContext'
import QuestionCard from '../components/QuestionCard'

// 详解 / AI分析 折叠面板
function ExplanationPanel({ explanation, analysis, tags, isWrong, loading }) {
  const [expanded, setExpanded] = React.useState(true)
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

// 导航栏：题号圆点 + 上一题/下一题
function QuizNav({ questions, currentPos, onJump }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: '1px solid #E5E7EB',
      padding: '10px 16px', zIndex: 50,
      display: 'flex', alignItems: 'center', gap: 8,
      maxWidth: 800, margin: '0 auto',
    }}>
      <span style={{ fontSize: 12, color: '#666', marginRight: 4 }}>导航：</span>
      {questions.map((q, i) => {
        const idx = i + 1
        const isCurrent = idx === currentPos
        const bg = q.isCorrect === true ? '#22C55E' : q.isCorrect === false ? '#EF4444' : '#D1D5DB'
        const color = isCurrent ? '#fff' : '#fff'
        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            style={{
              width: 26, height: 26, borderRadius: '50%',
              background: bg, border: isCurrent ? '2px solid #3B82F6' : 'none',
              color, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {idx}
          </button>
        )
      })}
    </div>
  )
}

// 已答题目缩略展示
function AnsweredSummary({ questions, onJump }) {
  if (questions.length <= 1) return null
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>已答 {questions.length - 1} 题</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {questions.slice(0, -1).map((q, i) => (
          <div
            key={i}
            onClick={() => onJump(i)}
            style={{
              padding: '10px 14px',
              background: q.isCorrect ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${q.isCorrect ? '#BBF7D0' : '#FECACA'}`,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{
              width: 20, height: 20, borderRadius: '50%',
              background: q.isCorrect ? '#22C55E' : '#EF4444',
              color: '#fff', fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {q.isCorrect ? '✓' : '✗'}
            </span>
            <span style={{ fontSize: 13, color: q.isCorrect ? '#166534' : '#991B1B', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {q.content.replace(/\n/g, ' ').substring(0, 60)}
            </span>
            <span style={{ fontSize: 11, color: '#9CA3AF' }}>第{i + 1}题</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function QuizSession() {
  const navigate = useNavigate()
  const {
    sessionId, questions, current, currentPos, answerState, submitting,
    analysisResult, wrongQuestionId, TOTAL,
    startQuiz, submitAnswer, confirmAnalysis, skipAnalysis,
    nextQuestion, prevQuestion, jumpTo,
  } = useQuiz()

  const handleSubmit = useCallback(async (selected) => {
    const res = await submitAnswer(selected)
    if (res?.is_session_over) {
      navigate('/wrong-log')
    }
  }, [submitAnswer, navigate])

  const handleConfirm = async () => {
    await confirmAnalysis(navigate)
  }

  const handleSkip = async () => {
    await skipAnalysis(navigate)
  }

  const handleNext = async () => {
    await nextQuestion(navigate)
  }

  const handlePrev = () => {
    prevQuestion()
  }

  const handleJump = (idx) => {
    jumpTo(idx)
  }

  // 未开始
  if (!sessionId) {
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

  const btnStyle = { padding: '9px 16px', background: '#fff', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', fontSize: 14 }
  const primaryBtn = { flex: 1, padding: '10px 0', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }
  const greenBtn = { flex: 1, padding: '10px 0', background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15 }
  const canGoPrev = currentPos > 0
  const canGoNext = currentPos < questions.length - 1
  const isLast = questions.length >= TOTAL && currentPos === questions.length - 1

  return (
    <div style={{ paddingTop: 24, paddingBottom: 80 }}>
      {/* 进度 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>✏️ 测试中</h2>
        <span style={{ color: '#666' }}>{Math.min(currentPos + 1, TOTAL)} / {TOTAL}</span>
      </div>
      <div style={{ background: '#E5E7EB', height: 6, borderRadius: 3, marginTop: 8 }}>
        <div style={{ background: '#3B82F6', height: '100%', borderRadius: 3, width: `${(Math.min(currentPos + 1, TOTAL) / TOTAL) * 100}%`, transition: 'width 0.3s' }} />
      </div>
      <div style={{ marginTop: 10, fontSize: 13, color: '#666' }}>
        第 {currentPos + 1} 题
        {currentPos > 0 && <span style={{ marginLeft: 12 }}>（已答 {currentPos} 题）</span>}
      </div>

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
            loading={false}
          />
        </>
      )}

      {/* 已答题目列表 */}
      {questions.length > 1 && answerState !== 'idle' && (
        <AnsweredSummary questions={questions} onJump={handleJump} />
      )}

      {/* 底部固定导航 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '1px solid #E5E7EB',
        padding: '10px 16px', zIndex: 50,
        display: 'flex', gap: 8, alignItems: 'center',
        maxWidth: 800, margin: '0 auto',
      }}>
        {/* 上一题 */}
        <button
          onClick={handlePrev}
          disabled={!canGoPrev}
          style={{
            padding: '8px 14px', border: '1px solid #ccc', borderRadius: 8,
            background: '#fff', cursor: canGoPrev ? 'pointer' : 'not-allowed',
            opacity: canGoPrev ? 1 : 0.4, fontSize: 14, flexShrink: 0,
          }}
        >
          ← 上一题
        </button>

        {/* 题号圆点 */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 5, flexWrap: 'wrap' }}>
          {questions.map((q, i) => {
            const isCurrent = i === currentPos
            const bg = q.isCorrect === true ? '#22C55E' : q.isCorrect === false ? '#EF4444' : '#9CA3AF'
            return (
              <button
                key={i}
                onClick={() => handleJump(i)}
                title={`第${i + 1}题`}
                style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: bg,
                  border: isCurrent ? '2px solid #3B82F6' : '2px solid transparent',
                  color: '#fff', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', flexShrink: 0,
                }}
              >
                {i + 1}
              </button>
            )
          })}
        </div>

        {/* 下一题 / 完成 */}
        {answerState === 'wrong' ? (
          <>
            <button onClick={handleSkip} style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 8, background: '#fff', fontSize: 13 }}>
              跳过
            </button>
            <button onClick={handleConfirm} disabled={submitting} style={{ padding: '8px 14px', background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, opacity: submitting ? 0.6 : 1, fontSize: 14 }}>
              {submitting ? '...' : '确认'}
            </button>
          </>
        ) : (
          <button
            onClick={isLast ? () => navigate('/wrong-log') : handleNext}
            style={{
              padding: '8px 14px', borderRadius: 8, border: 'none',
              background: isLast ? '#6B7280' : '#3B82F6',
              color: '#fff', fontSize: 14, flexShrink: 0,
              cursor: 'pointer',
            }}
          >
            {isLast ? '查看结果' : currentPos < questions.length - 1 ? '下一题 →' : '下一题 →'}
          </button>
        )}
      </div>
    </div>
  )
}
