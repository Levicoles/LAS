// Minimal client-side auth for admin using localStorage with salted SHA-256 hashing
// Note: For production, use a proper backend. This is a local-only stopgap.

const ADMIN_STORAGE_KEY = 'adminUser';
const SESSION_STORAGE_KEY = 'adminSession';

function getStoredAdmin() {
  try {
    const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function isAdminRegistered() {
  return !!getStoredAdmin();
}

export async function registerAdmin(username, password) {
  if (isAdminRegistered()) {
    throw new Error('Admin already registered');
  }
  const normalizedUsername = String(username || '').trim();
  const normalizedPassword = String(password || '');
  if (!normalizedUsername || normalizedPassword.length < 8) {
    throw new Error('Username required and password must be at least 8 characters');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordHash = await hashPassword(normalizedPassword, salt);
  const adminRecord = {
    username: normalizedUsername,
    salt: Array.from(salt),
    passwordHash
  };
  localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(adminRecord));
  // Create session immediately after registration
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ loggedIn: true, at: Date.now() }));
  return { username: normalizedUsername };
}

export function getAdmin() {
  const admin = getStoredAdmin();
  return admin ? { username: admin.username } : null;
}

export async function login(username, password) {
  const admin = getStoredAdmin();
  if (!admin) {
    throw new Error('No admin registered');
  }
  const suppliedPasswordHash = await hashPassword(String(password || ''), new Uint8Array(admin.salt));
  if (String(username).trim() === admin.username && suppliedPasswordHash === admin.passwordHash) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ loggedIn: true, at: Date.now() }));
    return { ok: true };
  }
  throw new Error('Invalid credentials');
}

export function logout() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function isAuthenticated() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    const sess = raw ? JSON.parse(raw) : null;
    return !!(sess && sess.loggedIn === true);
  } catch (_) {
    return false;
  }
}

export async function hashPassword(password, saltUint8) {
  const enc = new TextEncoder();
  const passwordBytes = enc.encode(password);
  const salted = new Uint8Array(saltUint8.length + passwordBytes.length);
  salted.set(saltUint8, 0);
  salted.set(passwordBytes, saltUint8.length);
  const digest = await crypto.subtle.digest('SHA-256', salted);
  return bufferToHex(digest);
}

function bufferToHex(buf) {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16).padStart(2, '0');
    hex += h;
  }
  return hex;
}


