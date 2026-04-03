import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const STATUS_LABEL = {
  pending_review: { text: '待确认', bg: '#FEF9C3', color: '#854D0E' },
  confirmed: { text: '复习中', bg: '#DBEAFE', color: '#1D4ED8' },
  mastered: { text: '已掌握', bg: '#DCFCE7', color: '#166534' },
}

export default function WrongLog() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setItems(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ paddingTop: 24 }}>
      <h2>❌ 错题本 <button
        onClick={() => navigate('/quiz')}
        style={{ marginLeft: 12, padding: '4px 12px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
      >
        ✏️ 重新开始测试
      </button></h2>
      <p style={{ color: '#666' }}>记录所有做错的题目，答对 3 次后移出</p>

      {loading ? (
        <p>加载中...</p>
      ) : items.length === 0 ? (
        <div style={{ marginTop: 20, padding: '40px 0', textAlign: 'center', color: '#999' }}>
          <p>暂无错题记录</p>
          <p style={{ fontSize: 13 }}>开始测试来积累错题吧</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {items.map(item => {
            const status = STATUS_LABEL[item.status] || STATUS_LABEL.pending_review
            return (
              <div key={item.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 16 }}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>
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
      )}
    </div>
  )
}
