const BASE = '/api'

async function request(method, path, body) {
  const opts = {
    method,
    headers: {},
  }
  const token = localStorage.getItem('token')
  if (token) {
    opts.headers['Authorization'] = `Bearer ${token}`
  }
  if (body instanceof FormData) {
    opts.body = body
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (res.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/login'
    throw new Error('请先登录')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Auth
  register: (username, password) =>
    request('POST', '/auth/register', { username, password }),
  login: (username, password) =>
    request('POST', '/auth/login', { username, password }),
  getMe: () =>
    request('GET', '/auth/me'),
  logout: () =>
    request('POST', '/auth/logout'),

  // Questions
  importDocx: (file) =>
    request('POST', '/questions/import', file),
  listQuestions: (page = 1, tag = null, scope = 'all') =>
    request('GET', `/questions?page=${page}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}&scope=${scope}`),
  createQuestion: (body) =>
    request('POST', '/questions', body),
  updateQuestion: (id, body) =>
    request('PUT', `/questions/${id}`, body),
  deleteQuestion: (id) =>
    request('DELETE', `/questions/${id}`),
  clearQuestions: () =>
    request('DELETE', '/questions'),

  // Quiz
  startQuiz: (tags = [], total = 10, sources = []) =>
    request('POST', '/quiz/start', { tags, total, sources }),
  startQuizFromWrong: (total = 10) =>
    request('POST', '/quiz/start-from-wrong', { total }),
  nextQuestion: (sessionId, current) =>
    request('POST', `/quiz/next?session_id=${sessionId}&current=${current}`),
  submitAnswer: (body) =>
    request('POST', '/quiz/answer', body),

  // Analysis
  getAnalysis: (wrongQuestionId) =>
    request('GET', `/analysis/${wrongQuestionId}`),
  confirmAnalysis: (wrongQuestionId, tags) =>
    request('POST', `/analysis/${wrongQuestionId}/confirm`, { tags }),
  rejectAnalysis: (wrongQuestionId) =>
    request('POST', `/analysis/${wrongQuestionId}/reject`),
  listWrongQuestions: (page = 1, pageSize = 20) =>
    request('GET', `/analysis?page=${page}&page_size=${pageSize}`),
  deleteWrongQuestion: (id) =>
    request('DELETE', `/analysis/${id}`),
  clearWrongQuestions: () =>
    request('POST', '/analysis/clear'),

  // Similar
  getSimilar: (questionId) =>
    request('GET', `/similar/${questionId}`),

  // Tags
  listTags: () =>
    request('GET', '/tags'),
  searchTags: (q) =>
    request('GET', `/tags/search?q=${encodeURIComponent(q)}`),
  deleteTag: (id) =>
    request('DELETE', `/tags/${id}`),
}
