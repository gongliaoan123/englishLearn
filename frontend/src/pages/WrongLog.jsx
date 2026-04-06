import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const STATUS_LABEL = {
  pending_review: { text: '待确认', bg: '#FEF9C3', color: '#854D0E' },
  confirmed: { text: '复习中', bg: '#DBEAFE', color: '#1D4ED8' },
  mastered: { text: '已掌握', bg: '#DCFCE7', color: '#166534' },
}

const PAGE_SIZE = 20

export default function WrongLog() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.listWrongQuestions(page, PAGE_SIZE).then(data => {
      setItems(data.items || [])
      setTotal(data.total || 0)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [page])

  async function handleDelete(id) {
    await api.deleteWrongQuestion(id)
    setItems(prev => prev.filter(i => i.id !== id))
    setTotal(prev => prev - 1)
  }

  async function handleClearAll() {
    if (!window.confirm(`确定要清空全部错题（${total}条）吗？此操作不可恢复。`)) return
    await api.clearWrongQuestions()
    setItems([])
    setTotal(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div style={{ paddingTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>❌ 错题本</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {total > 0 && (
            <button
              onClick={handleClearAll}
              style={{ padding: '4px 12px', background: '#fff', color: '#EF4444', border: '1px solid #EF4444', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
            >
              清空全部
            </button>
          )}
          <button
            onClick={() => navigate('/quiz')}
            style={{ padding: '4px 12px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            ✏️ 重新开始测试
          </button>
        </div>
      </div>
      <p style={{ color: '#666' }}>共 {total} 条错题记录，答对 3 次后移出</p>

      {loading ? (
        <p>加载中...</p>
      ) : items.length === 0 ? (
        <div style={{ marginTop: 20, padding: '40px 0', textAlign: 'center', color: '#999' }}>
          <p>暂无错题记录</p>
          <p style={{ fontSize: 13 }}>开始测试来积累错题吧</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            {items.map(item => {
              const status = STATUS_LABEL[item.status] || STATUS_LABEL.pending_review
              return (
                <div key={item.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 16, position: 'relative' }}>
                  <button
                    onClick={() => handleDelete(item.id)}
                    title="删除"
                    style={{
                      position: 'absolute', top: 12, right: 12,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#D1D5DB', fontSize: 18, lineHeight: 1, padding: 0,
                    }}
                  >
                    ×
                  </button>
                  <div style={{ fontWeight: 500, marginBottom: 8, paddingRight: 24 }}>
                    {item.content.includes('\n') || item.content.includes('—')
                      ? item.content.split(/\n| — /).filter(Boolean).map((line, i, arr) => (
                          <p key={i} style={{ margin: 0, marginBottom: i < arr.length - 1 ? 4 : 0 }}>
                            {line.trim()}
                          </p>
                        ))
                      : <p style={{ margin: 0 }}>{item.content}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ background: status.bg, color: status.color, padding: '2px 8px', borderRadius: 12, fontSize: 12 }}>
                      {status.text}
                    </span>
                    <span style={{ color: '#666', fontSize: 13 }}>错误次数：{item.wrong_count}</span>
                    <span style={{ color: '#666', fontSize: 13 }}>连续答对：{item.consecutive_correct}/3</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{ padding: '4px 12px', border: '1px solid #D1D5DB', borderRadius: 6, cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, background: '#fff', fontSize: 13 }}
              >
                ← 上一页
              </button>
              <span style={{ fontSize: 13, color: '#666' }}>第 {page} 页 / 共 {totalPages} 页</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{ padding: '4px 12px', border: '1px solid #D1D5DB', borderRadius: 6, cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, background: '#fff', fontSize: 13 }}
              >
                下一页 →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}