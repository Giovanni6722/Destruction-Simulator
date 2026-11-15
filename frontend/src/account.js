const $ = (id) => document.getElementById(id);

const accountButton = $('account-button');
const accountModal = $('account-modal');
const closeButton = $('close-account-modal');

const loginView = $('login-view');
const registerView = $('register-view');
const profileView = $('profile-view');

const modalTitle = $('modal-title');
const accountMessage = $('account-message');

let csrfToken = '';

function showMessage(message, isError = false) {
  accountMessage.textContent = message;
  accountMessage.style.color = isError ? '#ff7777' : '#75d69c';
}

function clearMessage() {
  accountMessage.textContent = '';
}

function showView(view) {
  loginView.hidden = view !== 'login';
  registerView.hidden = view !== 'register';
  profileView.hidden = view !== 'profile';

  modalTitle.textContent = {
    login: 'Welcome Back',
    register: 'Create Account',
    profile: 'Your Account',
  }[view];

  clearMessage();
}

async function getCsrfToken() {
  const response = await fetch('/api/accounts/csrf/', {
    credentials: 'same-origin',
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Could not initialize security token.');
  }

  csrfToken = data.csrfToken;
}

async function apiRequest(endpoint, method = 'GET', body = null) {
  const headers = {};

  if (body !== null) {
    if (!csrfToken) {
      await getCsrfToken();
    }

    headers['Content-Type'] = 'application/json';
    headers['X-CSRFToken'] = csrfToken;
  }

  const response = await fetch(endpoint, {
    method,
    credentials: 'same-origin',
    headers,
    body: body !== null ? JSON.stringify(body) : null,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error ||
      data.message ||
      'Something went wrong. Please try again.'
    );
  }

  return data;
}

function populateProfile(user) {
  $('profile-edit-username').value = user.username || '';
  $('profile-edit-email').value = user.email || '';
}

async function loadProfile() {
  try {
    const data = await apiRequest('/api/accounts/profile/');
    const user = data.user || data;

    populateProfile(user);
    showView('profile');
  } catch (error) {
    showView('login');

    if (error.message !== 'Unauthorized') {
      showMessage(error.message, true);
    }
  }
}

// Open account modal
accountButton.addEventListener('click', async () => {
  accountModal.showModal();
  clearMessage();

  try {
    await getCsrfToken();
    await loadProfile();
  } catch (error) {
    showView('login');
    showMessage(error.message, true);
  }
});

// Close account modal
closeButton.addEventListener('click', () => {
  accountModal.close();
});

accountModal.addEventListener('click', (event) => {
  if (event.target === accountModal) {
    accountModal.close();
  }
});

// Switch to registration
$('show-register').addEventListener('click', () => {
  $('register-form').reset();
  showView('register');
});

// Switch to login
$('show-login').addEventListener('click', () => {
  $('login-form').reset();
  showView('login');
});

// Registration
$('register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();

  const username = $('register-username').value.trim();
  const email = $('register-email').value.trim();
  const password = $('register-password').value;
  const confirmPassword = $('register-confirm-password').value;

  if (password !== confirmPassword) {
    showMessage('Passwords do not match.', true);
    return;
  }

  try {
    const data = await apiRequest('/api/accounts/register/', 'POST', {
      username,
      email,
      password,
    });

    $('login-username').value = username;
    $('login-password').value = '';

    showView('login');
    showMessage(data.message || 'Account created successfully. Please log in.');
  } catch (error) {
    showMessage(error.message, true);
  }
});

// Login
$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();

  const username = $('login-username').value.trim();
  const password = $('login-password').value;

  try {
    const data = await apiRequest('/api/accounts/login/', 'POST', {
      username,
      password,
    });

    // Login rotates the CSRF token.
    await getCsrfToken();

    const user = data.user || data;

    populateProfile(user);
    showView('profile');
    showMessage(data.message || 'You are now logged in.');
  } catch (error) {
    showMessage(error.message, true);
  }
});

// Update profile
$('profile-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  clearMessage();

  const username = $('profile-edit-username').value.trim();
  const email = $('profile-edit-email').value.trim();

  try {
    const data = await apiRequest(
      '/api/accounts/profile/update/',
      'PUT',
      { username, email }
    );

    const user = data.user || data;

    populateProfile(user);
    showMessage(data.message || 'Profile updated successfully.');
  } catch (error) {
    showMessage(error.message, true);
  }
});

// Logout
$('logout-button').addEventListener('click', async () => {
  clearMessage();

  try {
    const data = await apiRequest('/api/accounts/logout/', 'POST', {});

    showView('login');
    $('login-form').reset();

    showMessage(data.message || 'You have been logged out.');
  } catch (error) {
    showMessage(error.message, true);
  }
});