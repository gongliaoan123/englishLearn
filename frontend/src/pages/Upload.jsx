import React, { useState } from 'react'
import { api } from '../api'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.importDocx(formData)
      setResult(res)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ paddingTop: 24 }}>
      <h2>📤 上传题目文件</h2>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
        上传包含英语选择题的 .docx 文件，系统将自动解析入库。
      </p>

      <form onSubmit={handleUpload}>
        <input
          type="file"
          accept=".docx"
          onChange={e => setFile(e.target.files[0])}
          disabled={loading}
          style={{ marginBottom: 16 }}
        />
        <button
          type="submit"
          disabled={!file || loading}
          style={{
            display: 'block',
            padding: '8px 24px',
            background: file && !loading ? '#3B82F6' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: file && !loading ? 'pointer' : 'not-allowed',
            marginTop: 8,
          }}
        >
          {loading ? '解析中…' : '上传并解析'}
        </button>
      </form>

      {loading && (
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 40,
            height: 40,
            border: '4px solid #E5E7EB',
            borderTop: '4px solid #3B82F6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ color: '#666', fontSize: 15 }}>
            AI 正在解析文档，请耐心等待…
          </p>
          <p style={{ color: '#999', fontSize: 13 }}>
            大文件可能需要 1-3 分钟
          </p>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 20, padding: 14, background: '#FEE2E2', borderRadius: 8, color: '#991B1B' }}>
          ❌ {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 20, padding: 20, background: '#DCFCE7', borderRadius: 8 }}>
          <h3 style={{ color: '#166534', margin: '0 0 12px' }}>✅ 导入完成</h3>
          <p>成功导入：<strong>{result.imported} 题</strong></p>
          {result.skipped > 0 && (
            <p>跳过（非选择题）：<strong>{result.skipped} 题</strong></p>
          )}
          {result.errors && result.errors.length > 0 && (
            <p style={{ color: '#92400E' }}>错误：{result.errors.join('; ')}</p>
          )}
        </div>
      )}
    </div>
  )
}
