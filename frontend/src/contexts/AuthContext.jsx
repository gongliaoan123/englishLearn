import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)  // {id, username}
  const [loading, setLoading] = useState(true)

  // 启动时从 localStorage 恢复登录状态
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.getMe().then(data => {
        setUser(data)
      }).catch(() => {
        localStorage.removeItem('token')
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function login(username, password) {
    const res = await api.login(username, password)
    localStorage.setItem('token', res.token)
    setUser(res.user)
    return res
  }

  async function register(username, password) {
    const res = await api.register(username, password)
    return res
  }

  function logout() {
    localStorage.removeItem('token')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
