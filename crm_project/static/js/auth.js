let isLogin = true;

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) {
        window.location.href = '/dashboard';
    }
});

document.getElementById('toggle-mode').addEventListener('click', () => {
    isLogin = !isLogin;
    document.getElementById('form-title').textContent = isLogin ? 'Login to CRM' : 'Register for CRM';
    document.getElementById('btn-text').textContent = isLogin ? 'Sign In' : 'Sign Up';
    document.getElementById('toggle-mode').textContent = isLogin ? 'Need an account? Register' : 'Already have an account? Login';
    document.getElementById('error-msg').classList.add('hidden');
});

document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('error-msg');

    try {
        if (isLogin) {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);
            
            const data = await fetchAPI('/auth/login', {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            localStorage.setItem('token', data.access_token);
            window.location.href = '/dashboard';
        } else {
            await fetchAPI('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);
            const data = await fetchAPI('/auth/login', {
                method: 'POST',
                body: formData,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            localStorage.setItem('token', data.access_token);
            window.location.href = '/dashboard';
        }
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('hidden');
    }
});
