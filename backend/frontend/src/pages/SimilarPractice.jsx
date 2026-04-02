import React, { useEffect, useState } from 'react'
import QuestionCard from '../components/QuestionCard'
import { api } from '../api'

export default function SimilarPractice({ questionId, onDone }) {
  const [questions, setQuestions] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSimilar(questionId).then(res => {
      setQuestions(res.questions)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [questionId])

  const handleSubmit = async (selected, reset) => {
    const nextIndex = index + 1
    setIndex(nextIndex)
    reset()
  }

  if (loading) return <p style={{ paddingTop: 40 }}>加载中...</p>

  if (index >= questions.length) {
    return (
      <div style={{ paddingTop: 40, textAlign: 'center' }}>
        <h3 style={{ color: '#166534' }}>✅ 举一反三完成！</h3>
        <p style={{ color: '#666' }}>已完成 {questions.length} 道同类题练习</p>
        <button
          onClick={onDone}
          style={{ marginTop: 16, padding: '10px 32px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          返回继续测试 →
        </button>
      </div>
    )
  }

  const q = questions[index]
  return (
    <div style={{ paddingTop: 24 }}>
      <h2>📚 举一反三 ({index + 1}/{questions.length})</h2>
      <QuestionCard
        question={q}
        onSubmit={handleSubmit}
        submitting={false}
      />
    </div>
  )
}
