const API_URL = import.meta.env.DEV ? 'http://localhost:3000' : '';

const getHeaders = () => {
  const token = localStorage.getItem('homescreen_token');
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || `HTTP error! Status: ${response.status}`;
    
    // Auto logout on token expiration
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('homescreen_token');
      localStorage.removeItem('homescreen_user');
      if (!window.location.pathname.includes('/login') && window.location.pathname !== '/') {
        window.location.reload();
      }
    }
    
    throw new Error(errorMessage);
  }
  return response.json();
};

export const api = {
  // Auth APIs
  login: async (username, password) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return handleResponse(res);
  },

  getMe: async () => {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  changePassword: async (oldPassword, newPassword) => {
    const res = await fetch(`${API_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    return handleResponse(res);
  },

  // Admin APIs (User management)
  adminGetUsers: async () => {
    const res = await fetch(`${API_URL}/api/admin/users`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  adminCreateUser: async (username, password, role) => {
    const res = await fetch(`${API_URL}/api/admin/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ username, password, role }),
    });
    return handleResponse(res);
  },

  adminUpdateUser: async (id, username, password, role) => {
    const res = await fetch(`${API_URL}/api/admin/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ username, password, role }),
    });
    return handleResponse(res);
  },

  adminDeleteUser: async (id) => {
    const res = await fetch(`${API_URL}/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Dashboard APIs
  getDashboards: async () => {
    const res = await fetch(`${API_URL}/api/dashboards`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  createDashboard: async (name) => {
    const res = await fetch(`${API_URL}/api/dashboards`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    return handleResponse(res);
  },

  updateDashboard: async (id, name, order_index) => {
    const res = await fetch(`${API_URL}/api/dashboards/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ name, order_index }),
    });
    return handleResponse(res);
  },

  deleteDashboard: async (id) => {
    const res = await fetch(`${API_URL}/api/dashboards/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Widget APIs
  getWidgets: async (dashboardId) => {
    const res = await fetch(`${API_URL}/api/dashboards/${dashboardId}/widgets`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  createWidget: async (dashboardId, widgetData) => {
    const res = await fetch(`${API_URL}/api/dashboards/${dashboardId}/widgets`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(widgetData),
    });
    return handleResponse(res);
  },

  updateWidget: async (id, widgetData) => {
    const res = await fetch(`${API_URL}/api/widgets/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(widgetData),
    });
    return handleResponse(res);
  },

  deleteWidget: async (id) => {
    const res = await fetch(`${API_URL}/api/widgets/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Favicon Proxy URL helper
  getFaviconUrl: (url) => {
    return `${API_URL}/api/favicon?url=${encodeURIComponent(url)}`;
  }
};
