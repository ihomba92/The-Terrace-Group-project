import axios from "axios";

// 1. Create the base Axios instance with dynamic environment URL fallback
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:5555',
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  timeout: 15000, // fail reasonably fast so a retry can kick in
});

// 2. Request Interceptor: Attach authorization token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 3. Response Interceptor: Handle global 401s AND cold-start retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Detect a likely cold-start / connection failure:
    // no response received at all (refused connection, network error, or timeout)
    const isConnectionIssue =
      !error.response &&
      (error.code === "ECONNABORTED" || error.message === "Network Error");

    // Retry once per request only — avoid infinite loops if the server is genuinely down
    if (isConnectionIssue && config && !config._retried) {
      config._retried = true;

      // Let the UI know we're retrying
      window.dispatchEvent(new CustomEvent("server-waking-up"));

      // Give Render a few seconds to finish booting before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));

      return api(config); // retry the exact same request once
    }

    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  },
);

// 4. Exported Service Modules for Clean Endpoint Access

// Authentication Endpoints
export const authApi = {
  login: (credentials) => api.post("/auth/login", credentials),
  register: (userData) => api.post("/auth/register", userData),
  logout: () => api.post("/auth/logout"),
  getCurrentUser: () => api.get("/auth/me"),
};

// Article Management Endpoints
export const articlesApi = {
  getAll: (params) => api.get("/articles", { params }),
  getById: (id) => api.get(`/articles/${id}`),
  create: (data) => api.post("/articles", data),
  update: (id, data) => api.patch(`/articles/${id}`, data),
  delete: (id) => api.delete(`/articles/${id}`),
};

// External News Proxy Endpoints
export const externalNewsApi = {
  getExternal: (params) => api.get("/news", { params }),
};

// Comment Management Endpoints
export const commentsApi = {
  getByArticle: (articleId) => api.get(`/articles/${articleId}/comments`),
  create: (articleId, data) =>
    api.post(`/articles/${articleId}/comments`, data),
  delete: (commentId) => api.delete(`/comments/${commentId}`),
};

export default api;