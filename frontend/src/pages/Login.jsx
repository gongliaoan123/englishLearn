import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { login, register } = useAuth()
  const [tab, setTab] = useState('login')  // 'login' | 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) {
      setError('请填写用户名和密码')
      return
    }
    if (tab === 'register') {
      if (password !== confirmPassword) {
        setError('两次密码不一致')
        return
      }
      if (username.length < 3 || password.length < 6) {
        setError('用户名至少3位，密码至少6位')
        return
      }
    }
    setLoading(true)
    try {
      if (tab === 'login') {
        await login(username, password)
        navigate('/quiz')
      } else {
        await register(username, password)
        setTab('login')
        setPassword('')
        setConfirmPassword('')
        setError('')
        setTimeout(() => setError('注册成功，请登录'), 50)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto', textAlign: 'center' }}>
      <h2 style={{ marginBottom: 8 }}>📝 英语刷题</h2>
      <p style={{ color: '#666', marginBottom: 32 }}>登录后开始学习</p>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', marginBottom: 24, border: '1px solid #E5E7EB', borderRadius: 10, padding: 3 }}>
        {[
          { key: 'login', label: '登录' },
          { key: 'register', label: '注册' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setError('') }}
            style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 14, cursor: 'pointer',
              background: tab === t.key ? '#3B82F6' : '#fff',
              color: tab === t.key ? '#fff' : '#374151',
              border: 'none', transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="用户名（至少3位）"
          autoComplete="username"
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, outline: 'none' }}
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={tab === 'register' ? '密码（至少6位）' : '密码'}
          autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, outline: 'none' }}
        />
        {tab === 'register' && (
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="确认密码"
            autoComplete="new-password"
            style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 14, outline: 'none' }}
          />
        )}
        {error && (
          <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '12px', borderRadius: 8, background: '#3B82F6', color: '#fff', border: 'none', fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? '处理中...' : tab === 'login' ? '登录' : '注册'}
        </button>
      </form>

      <p style={{ marginTop: 24, fontSize: 13, color: '#9CA3AF' }}>
        登录后可记录个人错题本，题库共享
      </p>
    </div>
  )
}
