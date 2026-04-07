import React from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'
import { QuizProvider } from './contexts/QuizContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import QuestionBank from './pages/QuestionBank'
import QuizSession from './pages/QuizSession'
import WrongLog from './pages/WrongLog'
import Result from './pages/Result'
import Login from './pages/Login'

// 需要登录的路由
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <p style={{ paddingTop: 40, textAlign: 'center' }}>加载中...</p>
  if (!user) return <Navigate to="/login" replace />
  return children
}

// 免登录路由
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <p style={{ paddingTop: 40, textAlign: 'center' }}>加载中...</p>
  if (user) return <Navigate to="/quiz" replace />
  return children
}

function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <nav style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid #eee', alignItems: 'center', flexWrap: 'wrap' }}>
      <Link to="/questions">📚 题库</Link>
      <Link to="/quiz">✏️ 开始测试</Link>
      <Link to="/wrong-log">❌ 错题本</Link>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: '#666', fontSize: 13 }}>👤 {user?.username}</span>
        <button
          onClick={() => { logout(); navigate('/login') }}
          style={{ padding: '4px 10px', background: '#fff', color: '#EF4444', border: '1px solid #EF4444', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
        >
          退出
        </button>
      </div>
    </nav>
  )
}

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <p style={{ paddingTop: 40, textAlign: 'center' }}>加载中...</p>
  if (!user) return <Navigate to="/login" replace />
  return (
    <div style={{ paddingTop: 40, textAlign: 'center' }}>
      <p style={{ fontSize: 16, color: '#666' }}>欢迎回来，{user?.username}！</p>
      <p style={{ marginTop: 16 }}>👇 开始学习</p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
        <button onClick={() => window.location.href = '/quiz'} style={{ padding: '10px 24px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
          ✏️ 开始测试
        </button>
        <button onClick={() => window.location.href = '/questions'} style={{ padding: '10px 24px', background: '#fff', color: '#3B82F6', border: '1px solid #3B82F6', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
          📚 题库
        </button>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <QuizProvider>
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 16px' }}>
            <Routes>
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
              <Route path="/questions" element={<><NavBar /><QuestionBank /></>} />
              <Route path="/quiz" element={<ProtectedRoute><><NavBar /><QuizSession /></></ProtectedRoute>} />
              <Route path="/wrong-log" element={<ProtectedRoute><><NavBar /><WrongLog /></></ProtectedRoute>} />
              <Route path="/result" element={<ProtectedRoute><Result /></ProtectedRoute>} />
              <Route path="/" element={<HomeRedirect />} />
            </Routes>
          </div>
        </QuizProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
