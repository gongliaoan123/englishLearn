import React from 'react'

export default function AnalysisReview({ wrongQuestionId, onDone }) {
  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <p>AnalysisReview stub (Task 12)</p>
      <button onClick={onDone} style={{ padding: '8px 24px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
        Continue
      </button>
    </div>
  )
}
