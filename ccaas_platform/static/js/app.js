const API_URL = '/api';
let ws = null;

// --- Auth Logic ---
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('authError');

        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Login failed');
            }

            const data = await response.json();
            localStorage.setItem('token', data.access_token);
            window.location.href = '/dashboard';
        } catch (err) {
            errorEl.textContent = err.message;
        }
    });

    document.getElementById('showRegister').addEventListener('click', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        if(!username || !password) {
            document.getElementById('authError').textContent = "Enter username and password to register";
            return;
        }
        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if(res.ok) {
                alert("Registration successful! Please sign in.");
            } else {
                const data = await res.json();
                document.getElementById('authError').textContent = data.detail;
            }
        } catch(err) {
            console.error(err);
        }
    });
}

// --- Dashboard Logic ---
async function initDashboard() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    try {
        // Fetch user profile
        const res = await fetch(`${API_URL}/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Unauthorized');
        const user = await res.json();
        
        document.getElementById('agentName').textContent = user.username;
        document.getElementById('statusSelect').value = user.status;

        // Setup WebSocket
        connectWebSocket(token);

        // Setup Event Listeners
        document.getElementById('statusSelect').addEventListener('change', async (e) => {
            const newStatus = e.target.value;
            await fetch(`${API_URL}/users/me/status?status=${newStatus}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        });

        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('token');
            if(ws) ws.close();
            window.location.href = '/';
        });

    } catch (err) {
        console.error(err);
        localStorage.removeItem('token');
        window.location.href = '/';
    }
}

function connectWebSocket(token) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws/${token}`);

    const statusIndicator = document.getElementById('wsStatus');
    const statusText = statusIndicator.nextSibling;

    ws.onopen = () => {
        statusIndicator.className = 'status-indicator online';
        statusText.textContent = ' System Connected';
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('WS Message:', data);
        
        if (data.type === 'system') {
            // System notification
        } else if (data.type === 'interaction_accepted') {
            document.getElementById('currentInteractionContent').innerHTML = `
                <div style="padding: 1rem; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
                    <h3 style="color: #1e40af; margin-bottom: 0.5rem;">Active Call</h3>
                    <p><strong>Interaction ID:</strong> ${data.interaction}</p>
                    <p><strong>Status:</strong> Connected</p>
                    <button class="btn btn-danger" style="margin-top: 1rem;" onclick="alert('Call ended')">End Interaction</button>
                </div>
            `;
        }
    };

    ws.onclose = () => {
        statusIndicator.className = 'status-indicator offline';
        statusText.textContent = ' System Disconnected';
        // Attempt reconnect after 5 seconds
        setTimeout(() => connectWebSocket(token), 5000);
    };
}
