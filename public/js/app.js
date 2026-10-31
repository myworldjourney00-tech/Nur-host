// টোস্ট বার্তা প্রদর্শক
function showToast(message, isError = false) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.innerText = message;
  toast.style.borderColor = isError ? 'var(--danger)' : 'var(--accent-blue)';
  toast.className = 'show';
  setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000);
}

// থিম টগল হ্যান্ডলার
function initTheme() {
  const current = localStorage.getItem('nur_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', current);
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('nur_theme', newTheme);
}

// ইউজার স্টেট চেক
async function checkAuth(redirectIfNot = false) {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (!data.success && redirectIfNot) {
      window.location.href = '/login.html';
      return null;
    }
    return data.user || null;
  } catch (e) {
    if (redirectIfNot) window.location.href = '/login.html';
    return null;
  }
}

// লগআউট
async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  showToast('লগআউট করা হয়েছে');
  setTimeout(() => { window.location.href = '/login.html'; }, 800);
}

document.addEventListener('DOMContentLoaded', initTheme);
