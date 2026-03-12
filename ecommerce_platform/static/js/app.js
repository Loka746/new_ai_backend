const API_URL = '/api';

async function register(email, password) {
    const res = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Registration failed');
    }
    return res.json();
}

async function login(email, password) {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Login failed');
    }
    const data = await res.json();
    localStorage.setItem('token', data.access_token);
    return data;
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/';
}

async function fetchWithAuth(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    const res = await fetch(endpoint, { ...options, headers });
    if (res.status === 401) {
        logout();
        throw new Error('Unauthorized');
    }
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Request failed');
    }
    return res.json();
}

async function loadProducts() {
    try {
        const res = await fetch(`${API_URL}/products`);
        const products = await res.json();
        const grid = document.getElementById('products-grid');
        if (!grid) return;
        
        if (products.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #6b7280;">No products available yet. Register an account (first user becomes Admin) and add products via the Dashboard.</p>';
            return;
        }

        grid.innerHTML = products.map(p => `
            <div class="product-card">
                <img src="${p.image_url}" alt="${p.name}" class="product-img" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
                <div class="product-info">
                    <h3 class="product-title">${p.name}</h3>
                    <p style="color: #6b7280; margin-bottom: 1rem; font-size: 0.9rem;">${p.description}</p>
                    <div class="product-price">$${p.price.toFixed(2)}</div>
                    <p style="font-size: 0.8rem; margin-bottom: 1rem; color: ${p.stock > 0 ? 'green' : 'red'}">${p.stock > 0 ? `In Stock: ${p.stock}` : 'Out of Stock'}</p>
                    <button onclick="buyProduct(${p.id})" class="btn btn-primary w-100" ${p.stock === 0 ? 'disabled style="background: #ccc; cursor: not-allowed;"' : ''}>Buy Now</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Failed to load products', err);
    }
}

async function buyProduct(productId) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }
    try {
        await fetchWithAuth(`${API_URL}/orders`, {
            method: 'POST',
            body: JSON.stringify({ product_id: productId, quantity: 1 })
        });
        alert('Purchase successful! Check your dashboard for order details.');
        loadProducts(); // Refresh stock
    } catch (err) {
        alert(err.message);
    }
}

function updateNav() {
    const token = localStorage.getItem('token');
    const navLinks = document.getElementById('nav-links');
    if (!navLinks) return;
    
    if (token) {
        navLinks.innerHTML = `
            <a href="/">Home</a>
            <a href="/dashboard">Dashboard</a>
            <button onclick="logout()" class="btn btn-danger" style="padding: 0.25rem 0.75rem;">Logout</button>
        `;
    }
}