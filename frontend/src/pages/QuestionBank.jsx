import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api'

const TOTAL_PAGES = (total) => Math.max(1, Math.ceil(total / 50))

// 标签自动补全输入框
// 去除首字符 #（容错，防止数据中已有前缀）
function cleanTag(tag) {
  return tag.startsWith('#') ? tag.slice(1) : tag
}

function TagInput({ value, onChange }) {
  const [liveInput, setLiveInput] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [show, setShow] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const timerRef = useRef(null)
  const ref = useRef(null)
  // 用 ref 追踪 IME composition 状态，避免闭包问题
  const isComposingRef = useRef(false)

  function handleChange(e) {
    const v = e.target.value
    setLiveInput(v)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const last = v.split(/[,，]/).pop().trim()
      if (!last) { setSuggestions([]); setShow(false); return }
      const res = await api.searchTags(last)
      setSuggestions(res)
      setShow(true)
      setHighlighted(-1)
    }, 200)
  }

  // IME composition 开始
  function handleCompositionStart(e) {
    isComposingRef.current = true
  }

  // IME composition 结束：此时 text 已确定，可以安全提交
  function handleCompositionEnd(e) {
    isComposingRef.current = false
    const text = e.data || liveInput
    if (!text.trim()) return
    const current = text.split(/[,，]/).pop().trim()
    if (!current) return
    const matched = suggestions.find(s => s.name === current)
    commit(matched ? matched.name : current)
  }

  function handleKeyDown(e) {
    if (isComposingRef.current) return  // IME 未结束时忽略
    if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
      e.preventDefault()
      const current = liveInput.split(/[,，]/).pop().trim()
      if (!current) return
      const matched = suggestions.find(s => s.name === current)
      commit(matched ? matched.name : current)
      return
    }
    // 退格键：输入框为空时删除最后一个标签
    if (e.key === 'Backspace' && liveInput === '' && cleanValue.length > 0) {
      const last = cleanValue[cleanValue.length - 1]
      removeTag(last)
      return
    }
    if (!show || suggestions.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(i => Math.min(i + 1, suggestions.length - 1)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(i => Math.max(i - 1, -1)); return }
    if (e.key === 'Tab') {
      if (suggestions[0]) { e.preventDefault(); commit(suggestions[0].name) }
    }
  }

  function commit(tag) {
    const clean = cleanTag(tag)
    const parts = liveInput.split(/[,，]/)
    parts.pop()
    const pending = parts.map(t => cleanTag(t)).filter(Boolean)
    const existingClean = value.map(cleanTag)
    const all = [...existingClean, ...pending, clean]
    const seen = new Set()
    const next = all.filter(t => t && !seen.has(t) && (seen.add(t), true))
    onChange(next)
    setLiveInput('')
    setSuggestions([])
    setShow(false)
    setHighlighted(-1)
  }

  function removeTag(tag) {
    const clean = cleanTag(tag)
    const next = value.filter(t => cleanTag(t) !== clean)
    onChange(next)
  }

  const cleanValue = value.map(cleanTag)

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 6, minHeight: 36, alignItems: 'center', background: '#fff' }}>
        {cleanValue.map(tag => (
          <span key={tag} style={{ background: '#EDE9FE', color: '#5B21B6', padding: '2px 6px', borderRadius: 12, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            #{tag}
            <button onClick={() => removeTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
          </span>
        ))}
        <input
          value={liveInput}
          onChange={handleChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onKeyDown={handleKeyDown}
          onFocus={() => liveInput && setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 150)}
          placeholder={value.length === 0 ? '输入标签，回车确认' : ''}
          style={{ flex: 1, minWidth: 80, border: 'none', outline: 'none', fontSize: 14, padding: '2px 0', background: 'transparent' }}
        />
      </div>
      {show && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #D1D5DB', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50, marginTop: 4, maxHeight: 180, overflowY: 'auto' }}>
          {suggestions.map((t, i) => (
            <div
              key={t.id}
              onMouseDown={() => commit(t.name)}
              style={{
                padding: '8px 12px', cursor: 'pointer', fontSize: 14,
                background: i === highlighted ? '#EFF6FF' : '#fff',
                color: '#1D4ED8',
              }}
            >
              #{t.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function QuestionForm({ editing, initial, onSave, onCancel }) {
  const [content, setContent] = useState(initial?.content || '')
  const [A, setA] = useState(initial?.options?.A || '')
  const [B, setB] = useState(initial?.options?.B || '')
  const [C, setC] = useState(initial?.options?.C || '')
  const [D, setD] = useState(initial?.options?.D || '')
  const [answer, setAnswer] = useState(initial?.answer || 'A')
  const [explanation, setExplanation] = useState(initial?.explanation || '')
  const [tags, setTags] = useState(initial?.tags || [])
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
      tags,
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

          <label style={labelStyle}>选项 *（点击选项行将其设为正确答案）</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[['A', A, setA], ['B', B, setB], ['C', C, setC], ['D', D, setD]].map(([k, val, setter]) => {
              const isCorrect = answer === k
              return (
                <div key={k} onClick={() => setAnswer(k)} title="点击设为正确答案"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    padding: '6px 10px', borderRadius: 8,
                    background: isCorrect ? '#DCFCE7' : '#fff',
                    border: isCorrect ? '1.5px solid #22C55E' : '1.5px solid #E5E7EB',
                    boxSizing: 'border-box',
                  }}>
                  <span style={{
                    fontWeight: 700, fontSize: 13, minWidth: 20,
                    color: isCorrect ? '#16A34A' : '#9CA3AF',
                    textAlign: 'center',
                  }}>{k}</span>
                  <input value={val} onChange={e => setter(e.target.value)} onClick={e => e.stopPropagation()}
                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, background: 'transparent', color: '#1F2937' }}
                    placeholder={`选项${k}`} />
                  {isCorrect && <span style={{ color: '#22C55E', fontSize: 16, lineHeight: 1 }}>✓</span>}
                </div>
              )
            })}
          </div>

          <label style={labelStyle}>详解（可选）</label>
          <textarea value={explanation} onChange={e => setExplanation(e.target.value)}
            rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: 14 }}
            placeholder="输入题目详解" />

          <label style={labelStyle}>标签（可选，输入时有自动补全）</label>
          <div style={{ marginBottom: 20 }}>
            <TagInput value={tags} onChange={setTags} />
          </div>

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
  const [allTags, setAllTags] = useState([])
  const [filterTags, setFilterTags] = useState(() => new Set())
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const tagDropdownRef = useRef(null)

  useEffect(() => {
    api.listTags().then(setAllTags).catch(() => {})
  }, [])

  // 点击外部关闭标签下拉
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

  useEffect(() => {
    setLoading(true)
    api.listQuestions(page, filterTags.size > 0 ? [...filterTags].join(',') : null).then(res => {
      setQuestions(res.questions)
      setTotal(res.total)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [page, filterTags])

  function handleClear() {
    if (!window.confirm(`确定要清空全部 ${total} 道题目吗？此操作不可恢复！`)) return
    api.clearQuestions().then(() => {
      setQuestions([])
      setTotal(0)
    }).catch(err => alert('清空失败：' + err.message))
  }

  async function handleDeleteTag(tagId, tagName) {
    if (!window.confirm(`确定删除标签「${tagName}」？所有题目的该标签都会被移除。`)) return
    try {
      await api.deleteTag(tagId)
      setAllTags(prev => prev.filter(t => t.id !== tagId))
      setFilterTags(prev => { const s = new Set(prev); s.delete(tagName); return s })
    } catch (err) {
      alert('删除失败：' + err.message)
    }
  }

  async function handleRemoveTagFromQuestion(questionId, tagName) {
    const q = questions.find(q => q.id === questionId)
    if (!q) return
    const newTags = (q.tags || []).filter(t => t !== tagName)
    try {
      const updated = await api.updateQuestion(questionId, { tags: newTags })
      setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, tags: updated.tags } : q))
    } catch (err) {
      alert('移除标签失败：' + err.message)
    }
  }

  async function handleSave(body) {
    if (editingQ) {
      const updated = await api.updateQuestion(editingQ.id, body)
      setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q))
    } else {
      await api.createQuestion(body)
      const res = await api.listQuestions(1)
      setQuestions(res.questions)
      setTotal(res.total)
      setPage(1)
    }
    setShowForm(false)
    setEditingQ(null)
    api.listTags().then(setAllTags).catch(() => {})
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2>📚 题库</h2>
          <p style={{ color: '#666', margin: '4px 0 0' }}>共 {total} 题</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={startAdd}
            style={{ padding: '8px 16px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            ➕ 手动录入
          </button>
          {total > 0 && (
            <button onClick={handleClear}
              style={{ padding: '8px 16px', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
              🗑️ 清空题库
            </button>
          )}
        </div>
      </div>

      {/* 标签筛选栏：紧凑下拉多选 */}
      {allTags.length > 0 && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* 已选标签 chips */}
          {filterTags.size > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {[...filterTags].map(tag => (
                <span key={tag} style={{ background: '#3B82F6', color: '#fff', padding: '3px 8px', borderRadius: 16, fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {tag}
                  <button onClick={() => { setFilterTags(prev => { const s = new Set(prev); s.delete(tag); return s }); setPage(1) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BFDBFE', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
              <button onClick={() => { setFilterTags(new Set()); setPage(1) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 12 }}>清除</button>
            </div>
          )}
          {/* 下拉选择器 */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <button onClick={() => setTagDropdownOpen(v => !v)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                background: filterTags.size > 0 ? '#EFF6FF' : '#fff',
                color: filterTags.size > 0 ? '#1D4ED8' : '#374151',
                border: filterTags.size > 0 ? '1px solid #BFDBFE' : '1px solid #D1D5DB' }}>
              🏷️ 按标签筛选 {filterTags.size > 0 ? `(${filterTags.size})` : ''} ▾
            </button>
            {tagDropdownOpen && (
              <div ref={tagDropdownRef} style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4,
                background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50,
                minWidth: 220, maxHeight: 280, overflowY: 'auto', padding: '8px 0', textAlign: 'left' }}>
                <div style={{ padding: '4px 12px 8px', borderBottom: '1px solid #F3F4F6' }}>
                  <input value={tagSearch} onChange={e => setTagSearch(e.target.value)}
                    placeholder="搜索标签..." autoFocus
                    style={{ width: '100%', border: 'none', outline: 'none', fontSize: 13, padding: '2px 0', boxSizing: 'border-box' }} />
                </div>
                {[...filterTags].map(tag => {
                  const tagObj = allTags.find(t => t.name === tag)
                  return (
                    <div key={tag} style={{ padding: '7px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, background: '#EFF6FF', color: '#1D4ED8' }}>
                      <span onClick={() => { setFilterTags(prev => { const s = new Set(prev); s.delete(tag); return s }); setPage(1) }}
                        style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#3B82F6', fontWeight: 700, width: 16 }}>✓</span> {tag}
                      </span>
                      {tagObj && (
                        <button onClick={() => handleDeleteTag(tagObj.id, tag)}
                          title="删除此标签"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>×</button>
                      )}
                    </div>
                  )
                })}
                {[...allTags].filter(t => !filterTags.has(t.name) && t.name.includes(tagSearch)).map(t => (
                  <div key={t.id} style={{ padding: '7px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, color: '#374151' }}>
                    <span onClick={() => { setFilterTags(prev => new Set([...prev, t.name])); setPage(1) }}
                      style={{ flex: 1, cursor: 'pointer' }}>{t.name}</span>
                    <button onClick={() => handleDeleteTag(t.id, t.name)}
                      title="删除此标签"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 14, padding: '0 2px', lineHeight: 1 }}>×</button>
                  </div>
                ))}
                {[...allTags].filter(t => !filterTags.has(t.name) && !t.name.includes(tagSearch)).length > 0 && tagSearch && (
                  <div style={{ padding: '6px 12px', fontSize: 12, color: '#9CA3AF' }}>无匹配结果</div>
                )}
              </div>
            )}
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
                  setSelected(prev => { const s = new Set(prev); questions.forEach(q => s.delete(q.id)); return s })
                } else {
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
                      <span key={t} style={{ background: '#EDE9FE', color: '#5B21B6', padding: '2px 6px 2px 8px', borderRadius: 12, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ cursor: 'pointer' }} onClick={() => { setFilterTags(new Set([t])); setPage(1) }}>#{t}</span>
                        <button onClick={() => handleRemoveTagFromQuestion(q.id, t)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7C3AED', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
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
