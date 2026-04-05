const BASE = '/api'

async function request(method, path, body) {
  const opts = {
    method,
    headers: {},
  }
  if (body instanceof FormData) {
    opts.body = body
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json'
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  return res.json()
}

export const api = {
  // Questions
  importDocx: (file) =>
    request('POST', '/questions/import', file),
  listQuestions: (page = 1) =>
    request('GET', `/questions?page=${page}`),
  createQuestion: (body) =>
    request('POST', '/questions', body),
  updateQuestion: (id, body) =>
    request('PUT', `/questions/${id}`, body),
  deleteQuestion: (id) =>
    request('DELETE', `/questions/${id}`),
  clearQuestions: () =>
    request('DELETE', '/questions'),

  // Quiz
  startQuiz: () =>
    request('POST', '/quiz/start'),
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

  // Similar
  getSimilar: (questionId) =>
    request('GET', `/similar/${questionId}`),

  // Tags
  listTags: () =>
    request('GET', '/tags'),
}
