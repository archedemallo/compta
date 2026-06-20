/* ============================================================
   auth.js — Connexion Google OAuth 2.0
   Arche de Mallo — Comptabilité
   ============================================================ */

// ---- CONFIGURATION ----
// Renseigner ces valeurs après création dans Google Cloud Console
const AUTH_CONFIG = {
  clientId:     '967960997933-ipgtiki5umc757jki8g5j5sclfkb673r.apps.googleusercontent.com', // À remplir
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',       // Lecture/écriture Sheets
    'https://www.googleapis.com/auth/drive.file',         // Accès fichiers Drive créés par l'app
    'https://www.googleapis.com/auth/userinfo.email',     // Email utilisateur
    'https://www.googleapis.com/auth/userinfo.profile',   // Nom/photo utilisateur
  ].join(' '),

  // Comptes autorisés (à remplir avec vos emails Google)
  authorizedUsers: [
    'compta@archedemallo.fr',         // Administrateur (vous) — accès complet
    'jonathan@archedemallo.fr',      // Lecteur — accès limité
  ],

  // Email administrateur (reçoit les alertes de saisie)
  adminEmail: 'compta@archedemallo.fr',
};

// ---- ÉTAT ----
let currentUser = null;
let tokenClient = null;
let gapiLoaded  = false;
let gisLoaded   = false;

// ---- INITIALISATION ----
function initAuth(onReadyCallback) {
  // Charger Google API et Google Identity Services en parallèle
  const gapiScript = document.createElement('script');
  gapiScript.src = 'https://apis.google.com/js/api.js';
  gapiScript.onload = () => {
    gapi.load('client', async () => {
      await gapi.client.init({});
      gapiLoaded = true;
      checkBothLoaded(onReadyCallback);
    });
  };
  document.head.appendChild(gapiScript);

  const gisScript = document.createElement('script');
  gisScript.src = 'https://accounts.google.com/gsi/client';
  gisScript.onload = () => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: AUTH_CONFIG.clientId,
      scope:     AUTH_CONFIG.scopes,
      callback:  handleTokenResponse,
    });
    gisLoaded = true;
    checkBothLoaded(onReadyCallback);
  };
  document.head.appendChild(gisScript);
}

function checkBothLoaded(callback) {
  if (gapiLoaded && gisLoaded) {
    // Vérifier si une session est déjà en cours (token en localStorage)
    const savedToken = localStorage.getItem('arche_token');
    const savedUser  = localStorage.getItem('arche_user');
    if (savedToken && savedUser) {
      try {
        const token    = JSON.parse(savedToken);
        const user     = JSON.parse(savedUser);
        const expiry   = token.expiry || 0;
        if (Date.now() < expiry) {
          gapi.client.setToken(token);
          currentUser = user;
          if (callback) callback(true); // déjà connecté
          return;
        }
      } catch(e) {}
    }
    if (callback) callback(false); // pas connecté
  }
}

// ---- CONNEXION ----
function signIn() {
  if (!tokenClient) { console.error('Auth non initialisée'); return; }
  tokenClient.requestAccessToken({ prompt: 'select_account' });
}

async function handleTokenResponse(response) {
  if (response.error) {
    console.error('Erreur auth:', response.error);
    showAuthError('Erreur de connexion : ' + response.error);
    return;
  }

  // Récupérer infos utilisateur
  try {
    const userResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + response.access_token }
    });
    const userInfo = await userResp.json();

    // Vérifier si l'utilisateur est autorisé
    if (!AUTH_CONFIG.authorizedUsers.includes(userInfo.email)) {
      showAuthError(`Accès refusé. Ce compte (${userInfo.email}) n'est pas autorisé.`);
      google.accounts.oauth2.revoke(response.access_token);
      return;
    }

    // Stocker token et infos utilisateur
    const tokenWithExpiry = {
      ...response,
      expiry: Date.now() + (response.expires_in - 60) * 1000 // -60s de marge
    };
    localStorage.setItem('arche_token', JSON.stringify(tokenWithExpiry));

    currentUser = {
      email:    userInfo.email,
      name:     userInfo.name,
      picture:  userInfo.picture,
      isAdmin:  userInfo.email === AUTH_CONFIG.adminEmail,
    };
    localStorage.setItem('arche_user', JSON.stringify(currentUser));

    gapi.client.setToken(response);

    // Rediriger ou recharger
    const redirectTo = sessionStorage.getItem('arche_redirect') || 'index.html';
    sessionStorage.removeItem('arche_redirect');
    window.location.href = redirectTo;

  } catch(e) {
    console.error('Erreur récupération profil:', e);
    showAuthError('Impossible de récupérer le profil Google.');
  }
}

// ---- DÉCONNEXION ----
function signOut() {
  const token = gapi.client.getToken();
  if (token) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken(null);
  }
  currentUser = null;
  localStorage.removeItem('arche_token');
  localStorage.removeItem('arche_user');
  window.location.href = 'login.html';
}

// ---- VÉRIFICATION SESSION ----
// Appeler en haut de chaque page protégée
function requireAuth(callback) {
  initAuth((isLoggedIn) => {
    if (!isLoggedIn || !currentUser) {
      sessionStorage.setItem('arche_redirect', window.location.href);
      window.location.href = 'login.html';
      return;
    }
    // Mettre à jour l'UI avec infos utilisateur
    updateUserUI();
    if (callback) callback(currentUser);
  });
}

// ---- DROITS ----
function isAdmin() {
  return currentUser && currentUser.isAdmin;
}

function canWrite() {
  return currentUser !== null; // tous les utilisateurs autorisés peuvent saisir
}

// ---- UI UTILISATEUR ----
function updateUserUI() {
  if (!currentUser) return;

  // Initiales pour l'avatar
  const initials = currentUser.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const avatarEl   = document.getElementById('sidebar-avatar');
  const usernameEl = document.getElementById('sidebar-username');
  const logoutEl   = document.getElementById('sidebar-logout');

  if (avatarEl)   avatarEl.textContent  = initials;
  if (usernameEl) usernameEl.textContent = currentUser.name.split(' ')[0];
  if (logoutEl)   logoutEl.onclick      = signOut;

  // Masquer les éléments admin si non-admin
  if (!isAdmin()) {
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
  }
}

// ---- ERREUR AUTH ----
function showAuthError(message) {
  const errEl = document.getElementById('auth-error');
  if (errEl) {
    errEl.textContent = message;
    errEl.classList.remove('hidden');
  } else {
    alert(message);
  }
}

// ---- EXPORT ----
window.Auth = {
  init:        initAuth,
  signIn,
  signOut,
  requireAuth,
  isAdmin,
  canWrite,
  getUser:     () => currentUser,
  adminEmail:  AUTH_CONFIG.adminEmail,
  updateSidebarUser,
};
