const API_BASE = '/api/v1';

let _token = localStorage.getItem('tf_token') || null;

const api = {
  setToken(t) { _token = t; if (t) localStorage.setItem('tf_token', t); else localStorage.removeItem('tf_token'); },
  getToken() { return _token; },

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (_token) headers['Authorization'] = `Bearer ${_token}`;
    const res = await fetch(API_BASE + path, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || 'Помилка запиту');
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  patch(path, body) { return this.request('PATCH', path, body); },
  delete(path) { return this.request('DELETE', path); },

  // Auth
  login(email, password) { return this.post('/auth/login', { email, password }); },
  register(email, password, name) { return this.post('/auth/register', { email, password, name }); },
  me() { return this.get('/auth/me'); },

  // Projects
  getProjects() { return this.get('/projects'); },
  getProject(id) { return this.get(`/projects/${id}`); },
  createProject(data) { return this.post('/projects', data); },
  updateProject(id, data) { return this.patch(`/projects/${id}`, data); },
  deleteProject(id) { return this.delete(`/projects/${id}`); },
  getProjectStats(id) { return this.get(`/projects/${id}/stats`); },
  getProjectMembers(id) { return this.get(`/projects/${id}/members`); },
  searchUsers(name) { return this.get(`/users/search?name=${encodeURIComponent(name)}`); },

  // Tasks
  getTasks(projectId, params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.get(`/projects/${projectId}/tasks${q ? '?' + q : ''}`);
  },
  getTask(id) { return this.get(`/tasks/${id}`); },
  createTask(projectId, data) { return this.post(`/projects/${projectId}/tasks`, data); },
  updateTask(id, data) { return this.patch(`/tasks/${id}`, data); },
  deleteTask(id) { return this.delete(`/tasks/${id}`); },

  // Comments
  getComments(taskId) { return this.get(`/tasks/${taskId}/comments`); },
  createComment(taskId, content) { return this.post(`/tasks/${taskId}/comments`, { content }); },
  deleteComment(id) { return this.delete(`/comments/${id}`); },
};
