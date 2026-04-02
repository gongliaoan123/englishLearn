import React, { useState } from 'react'
import { api } from '../api'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    setProgress(0)
    setProgressText('正在读取文件…')

    // Simulate progress since backend doesn't stream progress events
    const steps = [
      { progress: 10, text: '正在读取文件…' },
      { progress: 25, text: '正在切分文档段落…' },
      { progress: 50, text: 'AI 解析中（第 1/3 步）…' },
      { progress: 70, text: 'AI 解析中（第 2/3 步）…' },
      { progress: 90, text: 'AI 解析中（第 3/3 步）…' },
      { progress: 95, text: '正在保存到数据库…' },
    ]
    let stepIdx = 0
    const ticker = setInterval(() => {
      if (stepIdx < steps.length) {
        setProgress(steps[stepIdx].progress)
        setProgressText(steps[stepIdx].text)
        stepIdx++
      } else {
        clearInterval(ticker)
      }
    }, 800)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.importDocx(formData)
      clearInterval(ticker)
      setProgress(100)
      setProgressText('解析完成！')
      setResult(res)
    } catch (err) {
      clearInterval(ticker)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ paddingTop: 24 }}>
      <h2>📤 上传题目文件</h2>
      <p style={{ color: '#666', fontSize: 14 }}>
        上传包含英语选择题的 .docx 文件，系统将自动解析入库。
        <br />解析需要一定时间，请耐心等待…
      </p>

      <form onSubmit={handleUpload} style={{ marginTop: 20 }}>
        <input
          type="file"
          accept=".docx"
          onChange={e => setFile(e.target.files[0])}
          style={{ marginBottom: 12 }}
          disabled={loading}
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
          {loading ? '解析中…' : '上传并解析'}
        </button>
      </form>

      {loading && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 200,
              height: 8,
              background: '#E5E7EB',
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${progress}%`,
                height: '100%',
                background: '#3B82F6',
                borderRadius: 4,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <span style={{ color: '#666', fontSize: 13, minWidth: 200 }}>{progressText}</span>
          </div>
        </div>
      )}

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
          {result.errors && result.errors.length > 0 && (
            <p style={{ color: '#92400E' }}>错误：{result.errors.join('; ')}</p>
          )}
        </div>
      )}
    </div>
  )
}
