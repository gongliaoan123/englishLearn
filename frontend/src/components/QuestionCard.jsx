import React, { useState } from 'react'

function DialogueContent({ content }) {
  if (!content) return null
  const parts = content.split('\n').filter(Boolean)
  if (parts.length <= 1) {
    return <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>{content}</p>
  }
  return (
    <div style={{ marginBottom: 16 }}>
      {parts.map((line, i) => (
        <p key={i} style={{ fontSize: 16, fontWeight: 500, marginBottom: i < parts.length - 1 ? 8 : 0 }}>
          {line.trim()}
        </p>
      ))}
    </div>
  )
}

export default function QuestionCard({ question, onSubmit, submitting, readonly }) {
  const [selected, setSelected] = useState(question.selectedAnswer ?? null)

  function handleSubmit() {
    if (!selected) return
    onSubmit(selected, () => setSelected(null))
  }

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginTop: 16 }}>
      <DialogueContent content={question.content} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(question.options).map(([k, v]) => (
          <label
            key={k}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              border: `2px solid ${selected === k ? '#3B82F6' : '#e5e7eb'}`,
              borderRadius: 8,
              cursor: 'pointer',
              background: selected === k ? '#EFF6FF' : '#fff',
            }}
          >
            <input
              type="radio"
              name="option"
              value={k}
              checked={selected === k}
              onChange={() => !readonly && setSelected(k)}
              disabled={readonly || submitting}
            />
            <span style={{ fontWeight: 600 }}>{k}.</span>
            <span>{v}</span>
          </label>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!selected || submitting || readonly}
        style={{
          marginTop: 20,
          padding: '10px 32px',
          background: selected && !submitting ? '#3B82F6' : '#ccc',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: selected && !submitting ? 'pointer' : 'not-allowed',
          fontSize: 15,
        }}
      >
        {submitting ? '提交中...' : '提交答案'}
      </button>
    </div>
  )
}
