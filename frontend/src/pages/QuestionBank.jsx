import React, { useEffect, useState } from 'react'
import { api } from '../api'

export default function QuestionBank() {
  const [questions, setQuestions] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

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

  return (
    <div style={{ paddingTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>📚 题库</h2>
          <p style={{ color: '#666', margin: '4px 0 0' }}>共 {total} 题</p>
        </div>
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

      {loading ? (
        <p>加载中...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {questions.length === 0 && (
            <p style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
              题库为空，请先上传 docx 文件
            </p>
          )}
          {questions.map(q => (
            <div key={q.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 16 }}>
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
                  {q.source === 'ai_generated' ? '🤖 AI生成' : '📄 导入'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24 }}>
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← 上一页</button>
        <span style={{ lineHeight: '36px' }}>第 {page} 页</span>
        <button disabled={questions.length < 50} onClick={() => setPage(p => p + 1)}>下一页 →</button>
      </div>
    </div>
  )
}
