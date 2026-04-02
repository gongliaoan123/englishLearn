import React, { useRef, useState } from 'react'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(null)  // { current, total, found }
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  function handleUpload(e) {
    e.preventDefault()
    if (!file) return
    setError(null)
    setResult(null)
    setProgress({ current: 0, total: 1, found: 0 })

    const formData = new FormData()
    formData.append('file', file)

    fetch('/api/questions/import', { method: 'POST', body: formData })
      .then(r => {
        if (!r.ok) throw new Error(r.statusText)
        const reader = r.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        function read() {
          reader.read().then(({ done, value }) => {
            if (done) {
              // flush buffer
              if (buffer) {
                try { handleEvent(JSON.parse(buffer)) } catch {}
              }
              return
            }
            buffer += decoder.decode(value, { stream: true })
            // Handle complete SSE messages (separated by \n\n)
            const parts = buffer.split('\n\n')
            buffer = parts.pop() // last part may be incomplete
            for (const part of parts) {
              if (part.startsWith('data: ')) {
                try { handleEvent(JSON.parse(part.slice(6))) } catch {}
              }
            }
            read()
          })
        }

        function handleEvent(data) {
          if (data.type === 'progress') {
            setProgress({ current: data.current, total: data.total, found: data.found })
          } else if (data.type === 'done') {
            setProgress(null)
            setResult(data)
          } else if (data.type === 'error') {
            setProgress(null)
            setError(data.message)
          }
        }

        read()
      })
      .catch(err => {
        setProgress(null)
        setError(err.message)
      })
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
          disabled={!!progress}
        />
        <button
          type="submit"
          disabled={!file || !!progress}
          style={{
            display: 'block',
            padding: '8px 24px',
            background: file && !progress ? '#3B82F6' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: file && !progress ? 'pointer' : 'not-allowed',
          }}
        >
          {progress ? '解析中...' : '上传并解析'}
        </button>
      </form>

      {progress && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#666', marginBottom: 6 }}>
            <span>正在解析第 {progress.current} / {progress.total} 个分块</span>
            <span>已找到 {progress.found} 道题</span>
          </div>
          <div style={{ background: '#F3F4F6', borderRadius: 4, height: 8 }}>
            <div style={{
              background: '#3B82F6',
              height: '100%',
              borderRadius: 4,
              width: `${Math.round(progress.current / progress.total * 100)}%`,
              transition: 'width 0.3s',
            }} />
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
