document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');
    const loginCard = document.querySelector('.auth-card:not(#register-card)');
    const registerCard = document.getElementById('register-card');
    const loginError = document.getElementById('auth-error');
    const regError = document.getElementById('reg-error');

    // Check if already logged in
    if (localStorage.getItem('crm_token')) {
        window.location.href = '/dashboard';
    }

    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginCard.classList.add('hidden');
        registerCard.classList.remove('hidden');
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        registerCard.classList.add('hidden');
        loginCard.classList.remove('hidden');
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = document.getElementById('login-btn');
        
        setLoading(btn, true);
        loginError.classList.add('hidden');

        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('crm_token', data.access_token);
                window.location.href = '/dashboard';
            } else {
                showError(loginError, data.detail || 'Login failed');
            }
        } catch (error) {
            showError(loginError, 'Network error occurred');
        } finally {
            setLoading(btn, false);
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;
        const btn = document.getElementById('reg-btn');

        setLoading(btn, true);
        regError.classList.add('hidden');

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    full_name: name,
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Auto login after register
                document.getElementById('email').value = email;
                document.getElementById('password').value = password;
                showLoginBtn.click();
                loginForm.dispatchEvent(new Event('submit'));
            } else {
                showError(regError, data.detail || 'Registration failed');
            }
        } catch (error) {
            showError(regError, 'Network error occurred');
        } finally {
            setLoading(btn, false);
        }
    });

    function setLoading(btn, isLoading) {
        const text = btn.querySelector('.btn-text');
        const spinner = btn.querySelector('.spinner');
        if (isLoading) {
            text.classList.add('hidden');
            spinner.classList.remove('hidden');
            btn.disabled = true;
        } else {
            text.classList.remove('hidden');
            spinner.classList.add('hidden');
            btn.disabled = false;
        }
    }

    function showError(element, message) {
        element.textContent = message;
        element.classList.remove('hidden');
    }
});
