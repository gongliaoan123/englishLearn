import React, { useEffect, useState } from 'react'
import { api } from '../api'

const TOTAL_PAGES = (total) => Math.max(1, Math.ceil(total / 50))

function QuestionForm({ editing, initial, onSave, onCancel }) {
  const [content, setContent] = useState(initial?.content || '')
  const [A, setA] = useState(initial?.options?.A || '')
  const [B, setB] = useState(initial?.options?.B || '')
  const [C, setC] = useState(initial?.options?.C || '')
  const [D, setD] = useState(initial?.options?.D || '')
  const [answer, setAnswer] = useState(initial?.answer || 'A')
  const [explanation, setExplanation] = useState(initial?.explanation || '')
  const [tags, setTags] = useState((initial?.tags || []).join(', '))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!content.trim() || !A.trim() || !B.trim() || !C.trim() || !D.trim()) {
      setError('请填写所有必填项')
      return
    }
    setSaving(true)
    setError('')
    const body = {
      content: content.trim(),
      options: { A: A.trim(), B: B.trim(), C: C.trim(), D: D.trim() },
      answer: answer.trim().toUpperCase(),
      explanation: explanation.trim() || null,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    }
    try {
      await onSave(body)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const labelStyle = { display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 500, color: '#374151' }
  const inputStyle = { width: '100%', padding: '6px 8px', border: '1px solid #D1D5DB', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }} onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{
        background: '#fff', borderRadius: 16,
        width: '90%', maxWidth: 560,
        maxHeight: '90vh', overflowY: 'auto',
        padding: 28,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 17, color: '#1F2937' }}>
            {editing ? '✏️ 编辑题目' : '➕ 新增题目'}
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9CA3AF', lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          {error && <div style={{ color: '#EF4444', marginBottom: 12, fontSize: 13 }}>{error}</div>}

          <label style={labelStyle}>题目内容 *</label>
          <textarea
            value={content} onChange={e => setContent(e.target.value)}
            rows={3} style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }}
            placeholder="输入题目内容，支持多行"
          />

          <label style={labelStyle}>选项 *</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[['A', A, setA], ['B', B, setB], ['C', C, setC], ['D', D, setD]].map(([k, val, setter]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600, color: '#374151', width: 16 }}>{k}.</span>
                <input value={val} onChange={e => setter(e.target.value)}
                  style={{ flex: 1, ...inputStyle }} placeholder={`选项${k}`} />
                <input type="radio" name="answer" value={k} checked={answer === k}
                  onChange={() => setAnswer(k)} title="设为正确答案"
                  style={{ cursor: 'pointer', width: 16, height: 16 }} />
              </div>
            ))}
          </div>

          <label style={labelStyle}>详解（可选）</label>
          <textarea value={explanation} onChange={e => setExplanation(e.target.value)}
            rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }}
            placeholder="输入题目详解" />

          <label style={labelStyle}>标签（可选，多个用逗号分隔）</label>
          <input value={tags} onChange={e => setTags(e.target.value)}
            style={{ ...inputStyle, marginBottom: 20 }}
            placeholder="如：定语从句，词义辨析" />

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onCancel}
              style={{ padding: '8px 20px', background: '#fff', color: '#666', border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
              取消
            </button>
            <button type="submit" disabled={saving}
              style={{ padding: '8px 20px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, opacity: saving ? 0.6 : 1 }}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default function QuestionBank() {
  const [questions, setQuestions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingQ, setEditingQ] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.listQuestions(page).then(res => {
      setQuestions(res.questions)
      setTotal(res.total)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [page])

  function handleClear() {
    if (!window.confirm(`确定要清空全部 ${total} 道题目吗？此操作不可恢复！`)) return
    api.clearQuestions().then(() => {
      setQuestions([])
      setTotal(0)
    }).catch(err => alert('清空失败：' + err.message))
  }

  async function handleSave(body) {
    if (editingQ) {
      const updated = await api.updateQuestion(editingQ.id, body)
      setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q))
    } else {
      await api.createQuestion(body)
      // 刷新当前页或跳到第一页
      const res = await api.listQuestions(1)
      setQuestions(res.questions)
      setTotal(res.total)
      setPage(1)
    }
    setShowForm(false)
    setEditingQ(null)
  }

  function startEdit(q) {
    setEditingQ(q)
    setShowForm(true)
  }

  function startAdd() {
    setEditingQ(null)
    setShowForm(true)
  }

  async function handleDeleteOne(id) {
    if (!window.confirm('确定删除该题目？')) return
    setDeleting(true)
    try {
      await api.deleteQuestion(id)
      setQuestions(prev => prev.filter(q => q.id !== id))
      setTotal(t => t - 1)
      setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
    } catch (err) {
      alert('删除失败：' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  async function handleDeleteSelected() {
    const ids = [...selected]
    if (!window.confirm(`确定删除选中的 ${ids.length} 道题目？`)) return
    setDeleting(true)
    try {
      await Promise.all(ids.map(id => api.deleteQuestion(id)))
      setQuestions(prev => prev.filter(q => !selected.has(q.id)))
      setTotal(t => t - ids.length)
      setSelected(new Set())
    } catch (err) {
      alert('删除失败：' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div style={{ paddingTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>📚 题库</h2>
          <p style={{ color: '#666', margin: '4px 0 0' }}>共 {total} 题</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={startAdd}
            style={{
              padding: '8px 16px',
              background: '#3B82F6',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ➕ 手动录入
          </button>
          {total > 0 && (
            <button
              onClick={handleClear}
              style={{
                padding: '8px 16px',
                background: '#EF4444',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              🗑️ 清空题库
            </button>
          )}
        </div>
      </div>

      {/* 批量删除栏 */}
      {selected.size > 0 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: '#FEE2E2', border: '1px solid #FECACA',
          borderRadius: 10, padding: '10px 16px', marginTop: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={questions.length > 0 && questions.every(q => selected.has(q.id))}
              ref={el => { if (el) el.indeterminate = questions.length > 0 && !questions.every(q => selected.has(q.id)) && selected.size > 0 }}
              onChange={() => {
                if (questions.every(q => selected.has(q.id))) {
                  // 全不选
                  setSelected(prev => { const s = new Set(prev); questions.forEach(q => s.delete(q.id)); return s })
                } else {
                  // 全选
                  setSelected(prev => { const s = new Set(prev); questions.forEach(q => s.add(q.id)); return s })
                }
              }}
              style={{ cursor: 'pointer', width: 16, height: 16 }}
            />
            <span style={{ color: '#991B1B', fontWeight: 600 }}>已选 {selected.size} 道题目</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelected(new Set())}
              style={{ padding: '6px 14px', fontSize: 13, background: '#fff', color: '#666', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' }}>
              取消全选
            </button>
            <button onClick={handleDeleteSelected} disabled={deleting}
              style={{ padding: '6px 14px', fontSize: 13, background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: deleting ? 0.6 : 1 }}>
              {deleting ? '删除中...' : `删除选中 (${selected.size})`}
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <QuestionForm
          editing={!!editingQ}
          initial={editingQ}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingQ(null) }}
        />
      )}

      {loading ? (
        <p>加载中...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {questions.length === 0 && !showForm && (
            <p style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
              题库为空，请先上传 docx 文件或手动录入题目
            </p>
          )}
          {questions.map(q => (
            <div key={q.id} style={{
              border: '1px solid #eee', borderRadius: 8, padding: 14,
              display: 'flex', alignItems: 'flex-start', gap: 12,
              background: selected.has(q.id) ? '#F0F9FF' : '#fff',
            }}>
              <input
                type="checkbox"
                checked={selected.has(q.id)}
                onChange={() => {
                  setSelected(prev => {
                    const s = new Set(prev)
                    s.has(q.id) ? s.delete(q.id) : s.add(q.id)
                    return s
                  })
                }}
                style={{ marginTop: 3, cursor: 'pointer', width: 16, height: 16, flexShrink: 0 }}
              />
              <div style={{ flex: 1 }}>
                  {q.content.includes('\n')
                    ? q.content.split('\n').map((line, i, arr) => (
                        <p key={i} style={{ fontWeight: 500, margin: 0, marginBottom: i < arr.length - 1 ? 4 : 0 }}>
                          {line.trim()}
                        </p>
                      ))
                    : <p style={{ fontWeight: 500 }}>{q.content}</p>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8 }}>
                    {Object.entries(q.options).map(([k, v]) => (
                      <div key={k} style={{
                        padding: '4px 8px',
                        background: k === q.answer ? '#DCFCE7' : '#f9f9f9',
                        borderRadius: 4,
                        fontSize: 13,
                      }}>
                        {k}) {v}
                        {k === q.answer && ' ✓'}
                      </div>
                    ))}
                  </div>
                  {q.explanation && (
                    <div style={{ marginTop: 10, padding: '10px 12px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, fontSize: 13, color: '#9A3412' }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>📖 详解</div>
                      <div>{q.explanation}</div>
                    </div>
                  )}
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {q.tags && q.tags.map(t => (
                      <span key={t} style={{ background: '#EDE9FE', color: '#5B21B6', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
                        #{t}
                      </span>
                    ))}
                    <span style={{ background: q.source === 'ai_generated' ? '#FEF9C3' : '#DBEAFE', color: '#555', padding: '2px 8px', borderRadius: 12, fontSize: 11 }}>
                      {q.source === 'ai_generated' ? '🤖 AI生成' : q.source === 'manual' ? '✏️ 手动' : '📄 导入'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => startEdit(q)}
                    style={{ padding: '4px 12px', background: '#fff', color: '#3B82F6', border: '1px solid #3B82F6', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                    编辑
                  </button>
                  <button onClick={() => handleDeleteOne(q.id)} disabled={deleting}
                    style={{ padding: '4px 12px', background: '#fff', color: '#EF4444', border: '1px solid #EF4444', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                    删除
                  </button>
                </div>
              </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 24 }}>
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 14px', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}>← 上一页</button>
        <span style={{ lineHeight: '36px' }}>第 {page} / {TOTAL_PAGES(total)} 页</span>
        <button disabled={questions.length < 50} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 14px', cursor: questions.length < 50 ? 'not-allowed' : 'pointer', opacity: questions.length < 50 ? 0.4 : 1 }}>下一页 →</button>
        <span style={{ color: '#666', fontSize: 13 }}>|</span>
        <input
          type="number"
          min={1}
          max={TOTAL_PAGES(total)}
          defaultValue={page}
          id="page-jump-input"
          style={{ width: 50, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 6, fontSize: 13 }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const val = parseInt(e.target.value)
              if (val >= 1 && val <= TOTAL_PAGES(total)) setPage(val)
            }
          }}
        />
        <button
          onClick={() => {
            const input = document.getElementById('page-jump-input')
            const val = parseInt(input.value)
            if (val >= 1 && val <= TOTAL_PAGES(total)) setPage(val)
          }}
          style={{ padding: '4px 12px', fontSize: 13, background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          跳转
        </button>
      </div>
    </div>
  )
}
