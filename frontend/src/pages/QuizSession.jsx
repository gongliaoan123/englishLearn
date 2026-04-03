import React, { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuiz } from '../contexts/QuizContext'
import QuestionCard from '../components/QuestionCard'

function ExplanationPanel({ explanation, analysis, tags, isWrong }) {
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

function NavDots({ questions, currentPos, currentIsCorrect, onJump }) {
  return (
    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 5, flexWrap: 'wrap' }}>
      {questions.map((q, i) => {
        const isCurrent = i === currentPos
        const isCorrect = isCurrent ? currentIsCorrect : q.isCorrect
        const bg = isCorrect == true ? '#22C55E' : isCorrect == false ? '#EF4444' : '#9CA3AF'
        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            title={`第${i + 1}题${isCorrect === null ? '（未答）' : isCorrect ? '✓' : '✗'}`}
            style={{
              width: 24, height: 24, borderRadius: '50%',
              background: bg,
              border: isCurrent ? '2px solid #3B82F6' : '2px solid transparent',
              color: '#fff', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            {q.isCorrect !== null ? i + 1 : '·'}
          </button>
        )
      })}
    </div>
  )
}

export default function QuizSession() {
  const navigate = useNavigate()
  const {
    sessionId, questions, current, currentPos, answerState, submitting,
    analysisResult, wrongQuestionId, confirmedWrongIds, TOTAL,
    startQuiz, submitAnswer, confirmAnalysis, skipAnalysis,
    nextQuestion, prevQuestion, jumpTo,
  } = useQuiz()

  const handleSubmit = useCallback(async (selected) => {
    const res = await submitAnswer(selected)
    if (res?.is_session_over) navigate('/wrong-log')
  }, [submitAnswer, navigate])

  if (!sessionId) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <h2>✏️ 开始测试</h2>
        <p style={{ color: '#666' }}>每次 {TOTAL} 道选择题</p>
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

  const displayPos = currentPos + 1
  const canGoPrev = currentPos > 0
  const canGoNext = currentPos < questions.length - 1
  const isCurrentUnanswered = current.isCorrect === null
  const isAllDone = displayPos >= TOTAL && !isCurrentUnanswered

  const btn = { padding: '8px 12px', border: '1px solid #ccc', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', flexShrink: 0 }

  return (
    <div style={{ paddingTop: 24, paddingBottom: 80 }}>
      {/* 进度 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>✏️ 测试中</h2>
          <button
            onClick={() => { if (window.confirm('确定要重新开始吗？当前进度将丢失。')) startQuiz() }}
            style={{ padding: '4px 12px', background: '#fff', color: '#EF4444', border: '1px solid #EF4444', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            重新开始
          </button>
        </div>
        <span style={{ color: '#666' }}>{Math.min(questions.length, TOTAL)} / {TOTAL}</span>
      </div>
      <div style={{ background: '#E5E7EB', height: 6, borderRadius: 3, marginTop: 8 }}>
        <div style={{ background: '#3B82F6', height: '100%', borderRadius: 3, width: `${(Math.min(questions.length, TOTAL) / TOTAL) * 100}%`, transition: 'width 0.3s' }} />
      </div>
      <div style={{ marginTop: 10, fontSize: 13, color: '#666' }}>
        第 {displayPos} 题
        <span style={{ color: isCurrentUnanswered ? '#9CA3AF' : current.isCorrect ? '#22C55E' : '#EF4444', marginLeft: 8 }}>
          {isCurrentUnanswered ? '（未答）' : current.isCorrect ? '✓ 正确' : '✗ 错误'}
        </span>
      </div>

      {/* 题目卡片 */}
      <QuestionCard
        key={current.question_id}
        question={current}
        onSubmit={handleSubmit}
        submitting={submitting}
        readonly={current.isCorrect !== null}
      />

      {/* 答对 */}
      {answerState === 'correct' && (
        <>
          <div style={{ marginTop: 14, padding: 14, background: '#DCFCE7', borderRadius: 8, color: '#166534' }}>
            ✅ 正确！正确答案：{current.answer}
          </div>
          {current.explanation && (
            <ExplanationPanel explanation={current.explanation} isWrong={false} />
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
          />
          {/* 已处理过的错题：绿色提示 */}
          {wrongQuestionId === null && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#DCFCE7', borderRadius: 8, color: '#166534', fontSize: 14 }}>
              ✓ 已加入错题本
            </div>
          )}
        </>
      )}

      {/* 底部固定导航 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '1px solid #E5E7EB',
        padding: '10px 16px', zIndex: 50,
        display: 'flex', gap: 8, alignItems: 'center',
        maxWidth: 800, margin: '0 auto',
      }}>
        <button onClick={prevQuestion} disabled={!canGoPrev} style={{ ...btn, opacity: canGoPrev ? 1 : 0.4, cursor: canGoPrev ? 'pointer' : 'not-allowed' }}>
          ← 上一题
        </button>

        <NavDots questions={questions} currentPos={currentPos} currentIsCorrect={current.isCorrect} onJump={jumpTo} />

        {/* 操作按钮：只有答错且未处理时才显示 */}
        {answerState === 'wrong' && wrongQuestionId !== null && (
          <>
            <button onClick={skipAnalysis} disabled={submitting} style={{ ...btn, color: '#666', flexShrink: 0 }}>
              跳过
            </button>
            <button onClick={() => confirmAnalysis(navigate)} disabled={submitting} style={{ ...btn, background: '#22C55E', color: '#fff', border: 'none', opacity: submitting ? 0.6 : 1, flexShrink: 0 }}>
              {submitting ? '...' : '加入错题本'}
            </button>
          </>
        )}

        {/* 下一题：最后一题时不显示（防止尝试加载不存在的题） */}
        {answerState !== 'wrong' || wrongQuestionId === null ? (
          displayPos < TOTAL && (
            <button
              onClick={() => nextQuestion(navigate)}
              style={{ ...btn, background: '#3B82F6', color: '#fff', border: 'none', flexShrink: 0 }}
            >
              下一题 →
            </button>
          )
        ) : null}
        {/* 最后一题且已答 → 查看结果 */}
        {isAllDone && (
          <button
            onClick={() => navigate('/wrong-log')}
            style={{ ...btn, background: '#6B7280', color: '#fff', border: 'none', flexShrink: 0 }}
          >
            查看结果
          </button>
        )}
      </div>
    </div>
  )
}
