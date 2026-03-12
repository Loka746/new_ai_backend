/**
 * Authentication Logic for CRM
 * Handles login, registration, token storage, and route guarding
 */

const API_URL = 'http://localhost:8000/api';

// --- Utility Functions ---
function setToken(token) {
    localStorage.setItem('crm_token', token);
}

function getToken() {
    return localStorage.getItem('crm_token');
}

function removeToken() {
    localStorage.removeItem('crm_token');
}

function setUserData(user) {
    localStorage.setItem('crm_user', JSON.stringify(user));
}

function getUserData() {
    const user = localStorage.getItem('crm_user');
    return user ? JSON.parse(user) : null;
}

function isAuthenticated() {
    const token = getToken();
    if (!token) return false;
    
    // Check token expiry (basic check, could be expanded with jwt-decode)
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
            removeToken();
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

function logout() {
    removeToken();
    localStorage.removeItem('crm_user');
    window.location.href = '/';
}

// --- Toast Notifications ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// --- API Calls ---
async function login(email, password) {
    try {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Login failed');
        }

        setToken(data.access_token);
        await fetchUserProfile();
        
        showToast('Login successful!');
        setTimeout(() => window.location.href = '/dashboard', 1000);
        
    } catch (error) {
        showToast(error.message, 'error');
        console.error('Login Error:', error);
    }
}

async function register(fullName, email, password) {
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                full_name: fullName,
                email: email,
                password: password,
                role: 'sales',
                is_active: true
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Registration failed');
        }

        showToast('Registration successful! Please login.');
        // Automatically switch to login modal if on index page
        if (typeof closeAllModals === 'function') {
            closeAllModals();
            document.getElementById('loginModal').classList.add('active');
        }
        
    } catch (error) {
        showToast(error.message, 'error');
        console.error('Registration Error:', error);
    }
}

async function fetchUserProfile() {
    try {
        const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });
        
        if (response.ok) {
            const userData = await response.json();
            setUserData(userData);
            return userData;
        }
    } catch (error) {
        console.error('Error fetching profile:', error);
    }
}

// --- Route Guarding ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const isAuthPage = path === '/' || path === '/index.html';
    
    if (isAuthenticated()) {
        if (isAuthPage) {
            window.location.href = '/dashboard';
        }
    } else {
        if (!isAuthPage) {
            window.location.href = '/';
        }
    }
});
