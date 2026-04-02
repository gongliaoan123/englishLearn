import React, { useEffect, useState } from 'react'
import { api } from '../api'

export default function AnalysisReview({ wrongQuestionId, onDone }) {
  const [analysis, setAnalysis] = useState(null)
  const [similarQuestions, setSimilarQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [editingTags, setEditingTags] = useState(false)
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [analysisRes, similarRes] = await Promise.all([
          api.getAnalysis(wrongQuestionId),
          api.getSimilar(wrongQuestionId),
        ])
        setAnalysis(analysisRes)
        setTagInput(analysisRes.suggested_tags.join(', '))
        setSimilarQuestions(similarRes.questions)
      } catch (err) {
        alert(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [wrongQuestionId])

  async function handleConfirm() {
    setConfirming(true)
    try {
      const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean)
      await api.confirmAnalysis(wrongQuestionId, tags)
      onDone()
    } catch (err) {
      alert(err.message)
    } finally {
      setConfirming(false)
    }
  }

  async function handleReject() {
    try {
      await api.rejectAnalysis(wrongQuestionId)
      onDone()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return <p style={{ paddingTop: 40 }}>AI 分析中...</p>

  return (
    <div style={{ paddingTop: 24 }}>
      <h2>🤖 错题分析</h2>

      <div style={{ background: '#FEF9C3', borderRadius: 8, padding: 16, marginTop: 16 }}>
        <h4 style={{ margin: '0 0 8px', color: '#854D0E' }}>AI 分析</h4>
        <p style={{ margin: 0, color: '#713F12' }}>{analysis?.analysis}</p>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>🏷️ 推断的知识点</h4>
          <button onClick={() => setEditingTags(v => !v)} style={{ fontSize: 12, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer' }}>
            {editingTags ? '保存' : '编辑'}
          </button>
        </div>
        {editingTags ? (
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            placeholder="用逗号分隔，如: past-perfect, subjunctive"
            style={{ width: '100%', marginTop: 8, padding: '6px 10px', border: '1px solid #ccc', borderRadius: 6 }}
          />
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {(analysis?.suggested_tags || []).map(t => (
              <span key={t} style={{ background: '#EDE9FE', color: '#5B21B6', padding: '4px 10px', borderRadius: 12, fontSize: 13 }}>
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button
          onClick={handleConfirm}
          disabled={confirming}
          style={{ flex: 1, padding: '10px 0', background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          {confirming ? '处理中...' : '✅ 确认，开始举一反三'}
        </button>
        <button
          onClick={handleReject}
          style={{ padding: '10px 16px', background: '#f3f4f6', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer' }}
        >
          跳过
        </button>
      </div>
    </div>
  )
}
