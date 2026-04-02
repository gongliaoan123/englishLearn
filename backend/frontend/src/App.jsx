import React from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Upload from './pages/Upload'
import QuestionBank from './pages/QuestionBank'
import QuizSession from './pages/QuizSession'
import WrongLog from './pages/WrongLog'

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
        <nav style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid #eee' }}>
          <Link to="/">📤 上传题目</Link>
          <Link to="/questions">📚 题库</Link>
          <Link to="/quiz">✏️ 开始测试</Link>
          <Link to="/wrong-log">❌ 错题本</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Upload />} />
          <Route path="/questions" element={<QuestionBank />} />
          <Route path="/quiz" element={<QuizSession />} />
          <Route path="/wrong-log" element={<WrongLog />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
