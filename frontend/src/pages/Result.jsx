import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuiz } from '../contexts/QuizContext'

const RANK = [
  { min: 10, emoji: '🎉', text: '太棒了，全对！' },
  { min: 8,  emoji: '👍', text: '很不错，再接再厉！' },
  { min: 6,  emoji: '💪', text: '还需多练习哦' },
  { min: 0,  emoji: '📚', text: '别灰心，继续加油！' },
]

function getRank(score) {
  return RANK.find(r => score >= r.min) || RANK[RANK.length - 1]
}

export default function Result() {
  const navigate = useNavigate()
  const location = useLocation()
  const { startQuiz } = useQuiz()

  const state = location.state || {}
  const questions = state.questions || []
  const total = state.total || questions.length || 10
  const wrongQuestions = questions.filter(q => q.isCorrect === false)
  const correctCount = questions.filter(q => q.isCorrect === true).length
  const score = correctCount
  const rate = total > 0 ? Math.round((score / total) * 100) : 0
  const { emoji, text: motivate } = getRank(score)

  function handleRestart() {
    startQuiz()
    navigate('/quiz')
  }

  return (
    <div style={{ paddingTop: 40 }}>
      {/* 卡片 */}
      <div style={{
        maxWidth: 520, margin: '0 auto',
        background: '#fff', borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: '36px 32px',
        textAlign: 'center',
      }}>
        {/* 激励文案 */}
        <div style={{ fontSize: 20, marginBottom: 8 }}>{emoji} {motivate}</div>
        <p style={{ color: '#666', margin: '0 0 28px' }}>本次测试结果</p>

        {/* 分数大字 */}
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 72, fontWeight: 800, color: '#1F2937', lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 32, color: '#9CA3AF', fontWeight: 300 }}> / {total}</span>
        </div>

        {/* 正确率 */}
        <div style={{ fontSize: 18, color: '#6B7280', marginBottom: 24 }}>
          正确率 {rate}%
        </div>

        {/* 进度条 */}
        <div style={{ background: '#E5E7EB', borderRadius: 6, height: 10, marginBottom: 8 }}>
          <div style={{
            background: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
            height: '100%', borderRadius: 6,
            width: `${rate}%`, transition: 'width 0.6s',
          }} />
        </div>

        {/* 对错计数 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#22C55E' }}>{correctCount}</div>
            <div style={{ fontSize: 13, color: '#666' }}>答对</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#EF4444' }}>{wrongQuestions.length}</div>
            <div style={{ fontSize: 13, color: '#666' }}>答错</div>
          </div>
        </div>

        {/* 错题列表 */}
        {wrongQuestions.length > 0 && (
          <div style={{ textAlign: 'left', marginBottom: 32 }}>
            <div style={{ fontWeight: 600, color: '#374151', marginBottom: 12, fontSize: 15 }}>
              本次错题回顾
            </div>
            {wrongQuestions.map((q, i) => (
              <div key={i} style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 10, padding: '10px 14px', marginBottom: 8,
              }}>
                <div style={{ fontSize: 13, color: '#7F1D1D', marginBottom: 4 }}>
                  {q.content.replace(/\n/g, ' ').slice(0, 60)}{q.content.length > 60 ? '…' : ''}
                </div>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: '#EF4444' }}>✗ 你选了：{q.selectedAnswer} </span>
                  <span style={{ color: '#22C55E' }}>✓ 正确答案：{q.answer}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 按钮 */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/wrong-log')}
            style={{
              padding: '10px 24px', fontSize: 15,
              background: '#fff', color: '#3B82F6',
              border: '1px solid #3B82F6', borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            查看错题本 →
          </button>
          <button
            onClick={handleRestart}
            style={{
              padding: '10px 24px', fontSize: 15,
              background: '#3B82F6', color: '#fff',
              border: 'none', borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            重新测试
          </button>
        </div>
      </div>
    </div>
  )
}
