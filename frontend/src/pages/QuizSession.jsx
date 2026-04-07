import React, { useCallback, useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuiz } from '../contexts/QuizContext'
import QuestionCard from '../components/QuestionCard'
import { api } from '../api'

function StartScreen({ startQuiz, startQuizFromWrong }) {
  const [mode, setMode] = useState(null)  // null | 'bank' | 'wrong'
  const [tags, setTags] = useState([])
  const [selectedTags, setSelectedTags] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const [starting, setStarting] = useState(false)
  const tagDropdownRef = useRef(null)
  const [total, setTotal] = useState(10)
  const [customTotal, setCustomTotal] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [srcPublic, setSrcPublic] = useState(true)
  const [srcMine, setSrcMine] = useState(true)

  useEffect(() => {
    api.listTags().then(res => {
      setTags(res)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!tagDropdownOpen) return
    function handleClick(e) {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target)) {
        setTagDropdownOpen(false)
        setTagSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [tagDropdownOpen])

  const effectiveTotal = useCustom ? (parseInt(customTotal, 10) || 10) : total

  async function handleStart() {
    setStarting(true)
    try {
      if (mode === 'wrong') {
        await startQuizFromWrong(effectiveTotal)
      } else {
        const sources = []
        if (srcPublic) sources.push('public')
        if (srcMine) sources.push('mine')
        await startQuiz([...selectedTags], effectiveTotal, sources)
      }
    } catch (err) {
      alert(err.message)
      setStarting(false)
    }
  }

  const QUICK_TOTALS = [5, 10, 15, 20]

  // ---- 步骤1：选择出题方式 ----
  if (mode === null) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <h2>✏️ 开始测试</h2>
        <p style={{ color: '#666', marginBottom: 32 }}>选择出题方式</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div onClick={() => setMode('bank')}
            style={{ width: 200, padding: '24px 16px', border: '2px solid #E5E7EB', borderRadius: 16, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', background: '#fff' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#3B82F6'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📚</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>从题库出题</div>
            <div style={{ fontSize: 13, color: '#666' }}>从公共题库或我的题库随机出题</div>
          </div>
          <div onClick={() => setMode('wrong')}
            style={{ width: 200, padding: '24px 16px', border: '2px solid #E5E7EB', borderRadius: 16, cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', background: '#fff' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#3B82F6'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>❌</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>从错题本出题</div>
            <div style={{ fontSize: 13, color: '#666' }}>从我的错题中随机抽取练习</div>
          </div>
        </div>
      </div>
    )
  }

  // ---- 步骤2：配置出题参数 ----
  return (
    <div style={{ paddingTop: 40, textAlign: 'center' }}>
      <h2>✏️ 开始测试</h2>

      {/* 切换出题方式 */}
      <div style={{ display: 'inline-flex', justifyContent: 'center', gap: 0, marginTop: 16, border: '1px solid #E5E7EB', borderRadius: 10, padding: 3 }}>
        {[
          { key: 'bank', label: '从题库出题' },
          { key: 'wrong', label: '从错题本出题' },
        ].map(t => (
          <button key={t.key} onClick={() => setMode(t.key)}
            style={{ padding: '6px 20px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              background: mode === t.key ? '#3B82F6' : '#fff',
              color: mode === t.key ? '#fff' : '#374151',
              border: 'none', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- 题库出题配置 ---- */}
      {mode === 'bank' && (
        <>
          {/* 题库来源多选 */}
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#666' }}>题库来源：</span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={srcPublic} onChange={e => setSrcPublic(e.target.checked)} style={{ cursor: 'pointer' }} />
              公共题库
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={srcMine} onChange={e => setSrcMine(e.target.checked)} style={{ cursor: 'pointer' }} />
              我的题库
            </label>
          </div>

          {/* 标签筛选 */}
          {!loading && tags.length > 0 && (
            <div style={{ maxWidth: 500, margin: '16px auto 0', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
              {selectedTags.size > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {[...selectedTags].map(tag => (
                    <span key={tag} style={{ background: '#3B82F6', color: '#fff', padding: '3px 8px', borderRadius: 16, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {tag}
                      <button onClick={() => setSelectedTags(prev => { const s = new Set(prev); s.delete(tag); return s })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BFDBFE', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                    </span>
                  ))}
                  <button onClick={() => setSelectedTags(new Set())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 12 }}>清除</button>
                </div>
              )}
              <div style={{ position: 'relative' }} ref={tagDropdownRef}>
                <button onClick={() => setTagDropdownOpen(v => !v)}
                  style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                    background: selectedTags.size > 0 ? '#EFF6FF' : '#fff',
                    color: selectedTags.size > 0 ? '#1D4ED8' : '#374151',
                    border: selectedTags.size > 0 ? '1px solid #BFDBFE' : '1px solid #D1D5DB' }}>
                  🏷️ 按标签筛选 {selectedTags.size > 0 ? `(${selectedTags.size})` : ''} ▾
                </button>
                {tagDropdownOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                    marginTop: 4, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50,
                    minWidth: 220, maxHeight: 280, overflowY: 'auto', padding: '8px 0', textAlign: 'left' }}>
                    <div style={{ padding: '4px 12px 8px', borderBottom: '1px solid #F3F4F6' }}>
                      <input value={tagSearch} onChange={e => setTagSearch(e.target.value)}
                        placeholder="搜索标签..." autoFocus
                        style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, padding: '2px 0', boxSizing: 'border-box' }} />
                    </div>
                    {[...selectedTags].map(tag => (
                      <div key={tag} onClick={() => setSelectedTags(prev => { const s = new Set(prev); s.delete(tag); return s })}
                        style={{ padding: '7px 12px', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, color: '#1D4ED8', background: '#EFF6FF' }}>
                        <span style={{ color: '#3B82F6', fontWeight: 700, width: 16 }}>✓</span> {tag}
                      </div>
                    ))}
                    {[...tags].filter(t => !selectedTags.has(t.name) && t.name.includes(tagSearch)).map(t => (
                      <div key={t.id} onClick={() => setSelectedTags(prev => new Set([...prev, t.name]))}
                        style={{ padding: '7px 12px', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                        {t.name}
                      </div>
                    ))}
                    {[...tags].filter(t => !selectedTags.has(t.name) && !t.name.includes(tagSearch)).length > 0 && tagSearch && (
                      <div style={{ padding: '6px 12px', fontSize: 12, color: '#9CA3AF' }}>无匹配结果</div>
                    )}
                  </div>
                )}
              </div>
              {selectedTags.size > 0 && <p style={{ fontSize: 13, color: '#3B82F6' }}>从 {selectedTags.size} 个标签出题</p>}
            </div>
          )}
        </>
      )}

      {/* ---- 错题本说明 ---- */}
      {mode === 'wrong' && (
        <p style={{ marginTop: 20, fontSize: 13, color: '#666' }}>自动从错题本随机抽取题目练习</p>
      )}

      {/* 题目数量选择 */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#666' }}>题目数量：</span>
          {QUICK_TOTALS.map(n => (
            <button key={n} onClick={() => { setTotal(n); setUseCustom(false) }}
              style={{ padding: '4px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
                background: !useCustom && total === n ? '#3B82F6' : '#fff',
                color: !useCustom && total === n ? '#fff' : '#374151',
                border: !useCustom && total === n ? 'none' : '1px solid #D1D5DB',
                transition: 'all 0.15s' }}>
              {n}题
            </button>
          ))}
          <span style={{ color: '#9CA3AF', fontSize: 12 }}>|</span>
          <input
            type="number"
            min="1"
            max="100"
            value={customTotal}
            onChange={e => { setCustomTotal(e.target.value); setUseCustom(true) }}
            placeholder="自定义"
            style={{ width: 56, padding: '4px 8px', borderRadius: 6, border: '1px solid #D1D5DB', fontSize: 13, outline: 'none' }}
          />
        </div>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>共 {effectiveTotal} 道题</span>
      </div>

      <div style={{ marginTop: 28, textAlign: 'center' }}>
        <button
          onClick={handleStart}
          disabled={starting}
          style={{ padding: '12px 40px', fontSize: 16, background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: starting ? 'not-allowed' : 'pointer', opacity: starting ? 0.6 : 1 }}
        >
          {starting ? '加载中...' : '开始测试 →'}
        </button>
      </div>
    </div>
  )
}

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
    analysisResult, wrongQuestionId, confirmedWrongIds, sessionTotal,
    startQuiz, startQuizFromWrong, resetQuiz, submitAnswer, confirmAnalysis, skipAnalysis,
    nextQuestion, prevQuestion, jumpTo,
  } = useQuiz()

  const handleSubmit = useCallback(async (selected) => {
    const res = await submitAnswer(selected)
    if (res?.is_session_over) {
      navigate('/result', {
        state: { questions, correctCount: res.correct_count, total: sessionTotal },
      })
    }
  }, [submitAnswer, navigate, questions, sessionTotal])

  const handleBack = useCallback(() => {
    if (!window.confirm('确定要退出测试吗？当前进度将丢失。')) return
    resetQuiz()
  }, [resetQuiz])

  if (!sessionId) {
    return <StartScreen startQuiz={startQuiz} startQuizFromWrong={startQuizFromWrong} />
  }

  if (!current) {
    return <p style={{ paddingTop: 40, textAlign: 'center' }}>加载中...</p>
  }

  const displayPos = currentPos + 1
  const canGoPrev = currentPos > 0
  const canGoNext = currentPos < questions.length - 1
  const isCurrentUnanswered = current.isCorrect === null
  const isAllDone = displayPos >= sessionTotal && !isCurrentUnanswered

  const btn = { padding: '8px 12px', border: '1px solid #ccc', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer', flexShrink: 0 }

  return (
    <div style={{ paddingTop: 24, paddingBottom: 80 }}>
      {/* 进度 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0 }}>✏️ 测试中</h2>
          <button
            onClick={handleBack}
            style={{ padding: '4px 12px', background: '#fff', color: '#6B7280', border: '1px solid #D1D5DB', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            ← 返回
          </button>
          <button
            onClick={() => { if (window.confirm('确定要重新开始吗？当前进度将丢失。')) startQuiz() }}
            style={{ padding: '4px 12px', background: '#fff', color: '#EF4444', border: '1px solid #EF4444', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            重新开始
          </button>
        </div>
        <span style={{ color: '#666' }}>{Math.min(questions.length, sessionTotal)} / {sessionTotal}</span>
      </div>
      <div style={{ background: '#E5E7EB', height: 6, borderRadius: 3, marginTop: 8 }}>
        <div style={{ background: '#3B82F6', height: '100%', borderRadius: 3, width: `${(Math.min(questions.length, sessionTotal) / sessionTotal) * 100}%`, transition: 'width 0.3s' }} />
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
          displayPos < sessionTotal && (
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
            onClick={() => navigate('/result', { state: { questions, total: sessionTotal } })}
            style={{ ...btn, background: '#6B7280', color: '#fff', border: 'none', flexShrink: 0 }}
          >
            查看结果
          </button>
        )}
      </div>
    </div>
  )
}
