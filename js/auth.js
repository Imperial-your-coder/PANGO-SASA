class Auth {
    constructor() {
        this.apiUrl = './API/login/AuthController.php?action=';
        this.storageKey = 'pango_sasa_auth';
        this.initEventListeners();
        this.checkAutoLogin();
    }

    initEventListeners() {
        // Login Form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Logout Button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Password Toggle
        const togglePassword = document.getElementById('togglePassword');
        if (togglePassword) {
            togglePassword.addEventListener('click', () => {
                const passwordInput = document.getElementById('password');
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                togglePassword.innerHTML = type === 'password' ? 
                    '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
            });
        }
    }

    checkAutoLogin() {
        if (window.location.pathname.includes('login.html')) return;
        
        this.checkSession().then(session => {
            if (!session.isLoggedIn) {
                window.location.href = 'login.html';
            }
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me').checked;

        if (!email || !password) {
            this.showError('Veuillez remplir tous les champs');
            return;
        }

        try {
            const response = await this.login(email, password);
            if (response.success) {
                this.saveSession(response.user, rememberMe);
                this.redirectUser(response.user.role);
            } else {
                this.showError(response.message || 'Échec de la connexion');
            }
        } catch (error) {
            this.showError('Erreur de connexion au serveur');
            console.error('Login error:', error);
        }
    }

    redirectUser(role) {
        const protectedRoutes = {
            'admin': './admin.html',
            'agent': './index.html'
        };
        window.location.href = protectedRoutes[role] || 'index.html';
    }

    async login(email, password) {
        const response = await fetch(`${this.apiUrl}login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Erreur serveur');
        }

        return await response.json();
    }

    async logout() {
        try {
            await fetch(`${this.apiUrl}logout`);
            this.clearSession();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout error:', error);
            this.showError('Erreur lors de la déconnexion');
        }
    }

    async checkSession() {
        try {
            const response = await fetch(`${this.apiUrl}check-session`);
            return await response.json();
        } catch (error) {
            console.error('Session check error:', error);
            return { isLoggedIn: false };
        }
    }

    saveSession(user, remember) {
        const sessionData = {
            user,
            timestamp: Date.now(),
            expires: remember ? Date.now() + (30 * 24 * 60 * 60 * 1000) : null
        };
        localStorage.setItem(this.storageKey, JSON.stringify(sessionData));
    }

    getSession() {
        const session = localStorage.getItem(this.storageKey);
        if (!session) return null;

        const data = JSON.parse(session);
        if (data.expires && data.expires < Date.now()) {
            this.clearSession();
            return null;
        }
        return data.user;
    }

    clearSession() {
        localStorage.removeItem(this.storageKey);
    }

    showError(message) {
        const errorElement = document.getElementById('loginError');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
            setTimeout(() => errorElement.classList.add('hidden'), 5000);
        }
    }

    async protectPage(requiredRole) {
        const session = await this.checkSession();
        
        if (!session.isLoggedIn) {
            window.location.href = 'login.html';
            return false;
        }

        if (requiredRole && session.user.role !== requiredRole) {
            window.location.href = 'unauthorized.html';
            return false;
        }

        return true;
    }
}

// Initialisation et protection des pages
document.addEventListener('DOMContentLoaded', () => {
    const auth = new Auth();
    const pageProtection = {
        './admin.html': 'admin',
        './index.html': 'agent',
        './profile.html': null
    };

    const currentPath = window.location.pathname;
    if (pageProtection.hasOwnProperty(currentPath)) {
        auth.protectPage(pageProtection[currentPath]);
    }
});