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
      <p style={{ color: '#666', fontSize: 14 }}>上传包含英语选择题的 .docx 文件，系统将自动解析入库</p>

      <form onSubmit={handleUpload} style={{ marginTop: 20 }}>
        <input
          type="file"
          accept=".docx"
          onChange={e => setFile(e.target.files[0])}
          style={{ marginBottom: 12 }}
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
          }}
        >
          {loading ? '解析中...' : '上传并解析'}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: '#FEE2E2', borderRadius: 6, color: '#991B1B' }}>
          ❌ {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 16, padding: 16, background: '#DCFCE7', borderRadius: 6 }}>
          <h3 style={{ color: '#166534', margin: '0 0 8px' }}>✅ 导入完成</h3>
          <p>成功导入：<strong>{result.imported}</strong> 题</p>
          <p>跳过（非选择题）：<strong>{result.skipped}</strong> 题</p>
          {result.errors.length > 0 && (
            <p style={{ color: '#92400E' }}>错误：{result.errors.join('; ')}</p>
          )}
        </div>
      )}
    </div>
  )
}
