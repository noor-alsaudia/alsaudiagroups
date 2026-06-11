/* ============================================
   AL SAUDIA TRAVEL AGENCY - MAIN JAVASCRIPT
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
    
    // ========== PRELOADER ==========
    const preloader = document.querySelector('.preloader');
    if (preloader) {
        window.addEventListener('load', function() {
            setTimeout(() => {
                preloader.classList.add('fade-out');
                setTimeout(() => {
                    preloader.style.display = 'none';
                }, 500);
            }, 1000);
        });
    }
    
    // ========== INITIALIZE AOS ==========
    AOS.init({
        duration: 1000,
        once: true,
        offset: 100
    });
    
    // ========== MOBILE MENU TOGGLE ==========
    const mobileToggle = document.getElementById('mobileToggle');
    const mainNav = document.getElementById('mainNav');
    
    if (mobileToggle && mainNav) {
        mobileToggle.addEventListener('click', function() {
            mainNav.classList.toggle('active');
            const icon = mobileToggle.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-times');
            }
        });
    }
    
    // ========== DROPDOWN FOR MOBILE ==========
    const dropdowns = document.querySelectorAll('.dropdown');
    dropdowns.forEach(dropdown => {
        const link = dropdown.querySelector('a');
        if (link) {
            link.addEventListener('click', function(e) {
                if (window.innerWidth <= 992) {
                    e.preventDefault();
                    dropdown.classList.toggle('active');
                }
            });
        }
    });
    
    // ========== PASSWORD TOGGLE ==========
    const togglePassword = document.getElementById('togglePassword');
    const passwordField = document.getElementById('password');
    
    if (togglePassword && passwordField) {
        togglePassword.addEventListener('click', function() {
            const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordField.setAttribute('type', type);
            const icon = togglePassword.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-eye-slash');
                icon.classList.toggle('fa-eye');
            }
        });
    }
    
    // ========== COPY DEMO CREDENTIALS ==========
    const copyButtons = document.querySelectorAll('.copy-btn');
    copyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const textToCopy = this.getAttribute('data-copy');
            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showAlert('✓ Copied to clipboard!', 'success', 1500);
                    const originalIcon = this.innerHTML;
                    this.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        this.innerHTML = originalIcon;
                    }, 1000);
                }).catch(() => {
                    showAlert('Failed to copy', 'error');
                });
            }
        });
    });
    
    // ========== ALERT FUNCTION ==========
    function showAlert(message, type = 'info', duration = 3000) {
        const alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) return;
        
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        
        let icon = type === 'success' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>';
        alertDiv.innerHTML = `${icon} ${message}`;
        alertContainer.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.style.opacity = '0';
            setTimeout(() => alertDiv.remove(), 300);
        }, duration);
    }
    
    // ========== EMAIL VALIDATION ==========
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }
    
    // ========== LOGIN FORM HANDLER ==========
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('rememberMe')?.checked || false;
            
            if (!email || !password) {
                showAlert('Please enter both email and password', 'error');
                return;
            }
            
            if (!isValidEmail(email)) {
                showAlert('Please enter a valid email address', 'error');
                return;
            }
            
            if (password.length < 6) {
                showAlert('Password must be at least 6 characters', 'error');
                return;
            }
            
            if (loginBtn) {
                loginBtn.disabled = true;
                const btnText = loginBtn.querySelector('.btn-text');
                const originalText = btnText ? btnText.textContent : 'Login';
                if (btnText) btnText.textContent = 'Logging in...';
                
                // Demo login - Replace with Firebase auth later
                setTimeout(() => {
                    if ((email === 'agent@alsaudia.com' || email === 'demo@alsaudia.com') && password === '12345678') {
                        showAlert('Login successful! Welcome to Al Saudia Travel Dashboard.', 'success');
                        if (rememberMe) localStorage.setItem('rememberedUser', email);
                        
                        Swal.fire({
                            icon: 'success',
                            title: 'Welcome Back!',
                            text: 'Redirecting to dashboard...',
                            timer: 2000,
                            showConfirmButton: false
                        });
                        
                        setTimeout(() => {
                            Swal.fire({
                                icon: 'info',
                                title: 'Dashboard Demo',
                                html: 'This is a demo login. <br>Connect Firebase for full functionality.',
                                confirmButtonColor: '#0a5c7e'
                            });
                        }, 2000);
                    } else {
                        showAlert('Invalid credentials. Use agent@alsaudia.com / 12345678', 'error');
                    }
                    
                    loginBtn.disabled = false;
                    if (btnText) btnText.textContent = originalText;
                }, 1500);
            }
        });
    }
    
    // ========== REMEMBER ME ==========
    const rememberedEmail = localStorage.getItem('rememberedUser');
    if (rememberedEmail) {
        const emailInput = document.getElementById('email');
        const rememberCheckbox = document.getElementById('rememberMe');
        if (emailInput) emailInput.value = rememberedEmail;
        if (rememberCheckbox) rememberCheckbox.checked = true;
    }
    
    // ========== FORGOT PASSWORD ==========
    const forgotPassword = document.getElementById('forgotPassword');
    if (forgotPassword) {
        forgotPassword.addEventListener('click', function(e) {
            e.preventDefault();
            Swal.fire({
                title: 'Reset Password',
                text: 'Enter your email address to receive reset link',
                input: 'email',
                inputPlaceholder: 'agent@alsaudia.com',
                showCancelButton: true,
                confirmButtonColor: '#0a5c7e',
                confirmButtonText: 'Send Reset Link',
                cancelButtonText: 'Cancel'
            }).then((result) => {
                if (result.isConfirmed && result.value) {
                    if (result.value.includes('@')) {
                        Swal.fire('Email Sent!', 'Password reset link has been sent to ' + result.value, 'success');
                    } else {
                        Swal.fire('Error!', 'Please enter a valid email address', 'error');
                    }
                }
            });
        });
    }
    
    // ========== REGISTER HANDLER ==========
    function handleRegister() {
        Swal.fire({
            title: 'Create Agent Account',
            html: `
                <input type="text" id="regName" class="swal2-input" placeholder="Full Name">
                <input type="email" id="regEmail" class="swal2-input" placeholder="Email Address">
                <input type="tel" id="regPhone" class="swal2-input" placeholder="Phone Number">
                <input type="password" id="regPassword" class="swal2-input" placeholder="Password (min 8 chars)">
            `,
            confirmButtonText: 'Register',
            confirmButtonColor: '#0a5c7e',
            showCancelButton: true,
            cancelButtonText: 'Cancel',
            preConfirm: () => {
                const name = document.getElementById('regName')?.value;
                const email = document.getElementById('regEmail')?.value;
                const phone = document.getElementById('regPhone')?.value;
                const password = document.getElementById('regPassword')?.value;
                
                if (!name || !email || !phone || !password) {
                    Swal.showValidationMessage('Please fill all fields');
                    return false;
                }
                if (!isValidEmail(email)) {
                    Swal.showValidationMessage('Please enter valid email');
                    return false;
                }
                if (password.length < 8) {
                    Swal.showValidationMessage('Password must be at least 8 characters');
                    return false;
                }
                return { name, email, phone, password };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire('Registration Submitted!', 'Our team will contact you soon.', 'success');
            }
        });
    }
    
    const registerBtn = document.getElementById('registerBtn');
    const registerNow = document.getElementById('registerNow');
    
    if (registerBtn) registerBtn.addEventListener('click', (e) => { e.preventDefault(); handleRegister(); });
    if (registerNow) registerNow.addEventListener('click', (e) => { e.preventDefault(); handleRegister(); });
    
    // ========== AIRLINE MARQUEE ==========
    const airlines = [
        { name: 'Saudia Airlines', icon: 'fas fa-plane', color: '#0a5c7e' },
        { name: 'Emirates', icon: 'fas fa-plane', color: '#d4a53a' },
        { name: 'Qatar Airways', icon: 'fas fa-plane', color: '#8B1E3F' },
        { name: 'Etihad Airways', icon: 'fas fa-plane', color: '#2B5B2B' },
        { name: 'Turkish Airlines', icon: 'fas fa-plane', color: '#E30A17' },
        { name: 'Fly Dubai', icon: 'fas fa-plane', color: '#FF6600' },
        { name: 'Air Arabia', icon: 'fas fa-plane', color: '#003366' },
        { name: 'Gulf Air', icon: 'fas fa-plane', color: '#C00000' }
    ];
    
    const marqueeContent = document.getElementById('marqueeContent');
    if (marqueeContent) {
        let html = '';
        [...airlines, ...airlines].forEach(airline => {
            html += `<div class="partner-item"><i class="${airline.icon}" style="color: ${airline.color}"></i><span>${airline.name}</span></div>`;
        });
        marqueeContent.innerHTML = html;
    }
    
    // ========== SMOOTH SCROLL ==========
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href !== '#home') {
                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth' });
                    if (mainNav?.classList.contains('active')) {
                        mainNav.classList.remove('active');
                        if (mobileToggle) {
                            const icon = mobileToggle.querySelector('i');
                            if (icon) icon.classList.add('fa-bars');
                            if (icon) icon.classList.remove('fa-times');
                        }
                    }
                }
            }
        });
    });
    
    // ========== HEADER SCROLL EFFECT ==========
    const header = document.querySelector('.main-header');
    window.addEventListener('scroll', () => {
        if (header) {
            header.style.boxShadow = window.scrollY > 50 ? '0 10px 30px rgba(0,0,0,0.1)' : '0 4px 20px rgba(0,0,0,0.08)';
        }
    });
    
    console.log('Al Saudia Travel Agency Portal Loaded Successfully!');
});

// ========== FIREBASE CONFIG (Add Later) ==========
/*
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
// firebase.initializeApp(firebaseConfig);
*/