const API_URL = '/api';

function getToken() {
    return localStorage.getItem('token');
}

async function fetchAPI(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (options.body instanceof URLSearchParams) {
        delete headers['Content-Type'];
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/';
        return null;
    }

    const data = response.status !== 204 ? await response.json() : null;

    if (!response.ok) {
        throw new Error(data.detail || 'Something went wrong');
    }

    return data;
}
