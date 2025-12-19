import { supabase } from './supabaseClient'

// Checks if any admin exists by calling RPC that inspects auth.users metadata
export async function hasAdmin() {
  const { data, error } = await supabase.rpc('has_admin');
  if (error) {
    // If RPC not deployed yet, fallback to count>0 meaning someone will be first admin
    const fallback = await supabase.rpc('auth_user_count');
    if (!fallback.error) {
      return fallback.data > 0;
    }
    // On error, do not block registration
    return false;
  }
  return data === true;
}

export async function getAdminCount() {
  const { data, error } = await supabase.rpc('admin_count');
  if (error) return 0;
  return Number(data || 0);
}

// Check if super_admin exists
export async function hasSuperAdmin() {
  const { data, error } = await supabase.rpc('has_super_admin');
  if (error) return false;
  return data === true;
}

// Registers a user with role metadata: first becomes super_admin, next 2 become admin, rest are users
export async function registerWithEmail(email, password) {
  const normalizedEmail = String(email || '').trim();
  const normalizedPassword = String(password || '');
  if (!normalizedEmail || normalizedPassword.length < 8) {
    throw new Error('Email required and password must be at least 8 characters');
  }
  
  // First admin becomes super_admin, next 2 become admin, rest are regular users
  const adminCount = await getAdminCount();
  let role = 'user';
  if (adminCount === 0) {
    role = 'super_admin';
  } else if (adminCount < 3) {
    role = 'admin';
  }
  
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: normalizedPassword,
    options: {
      data: { role },
    },
  });
  if (error) throw error;
  // Ensure session exists immediately; if none (e.g., email confirmation setting), sign in now
  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });
    if (signInError) throw signInError;
  }
  return data;
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getCurrentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

export async function isAuthenticated() {
  const session = await getCurrentSession();
  return !!session;
}

export async function isCurrentUserAdmin() {
  const user = await getCurrentUser();
  const role = user?.user_metadata?.role;
  return role === 'admin' || role === 'super_admin';
}

export async function isCurrentUserSuperAdmin() {
  const user = await getCurrentUser();
  const role = user?.user_metadata?.role;
  return role === 'super_admin';
}

export async function getCurrentUserRole() {
  const user = await getCurrentUser();
  return user?.user_metadata?.role || null;
}

// Admin Management Functions (super_admin only)

export async function getAllAdmins() {
  const { data, error } = await supabase.rpc('get_all_admins');
  if (error) throw error;
  return data || [];
}

export async function updateAdminRole(userId, newRole) {
  const { data, error } = await supabase.rpc('update_admin_role', {
    target_user_id: userId,
    new_role: newRole
  });
  if (error) throw error;
  return data;
}

export async function deleteAdminAccount(userId) {
  const { data, error } = await supabase.rpc('delete_admin_account', {
    target_user_id: userId
  });
  if (error) throw error;
  return data;
}

export async function updateAdminEmail(userId, newEmail) {
  const { data, error } = await supabase.rpc('update_admin_email', {
    target_user_id: userId,
    new_email: newEmail
  });
  if (error) throw error;
  return data;
}

// Reset admin password using Supabase admin API (sends password reset email)
export async function resetAdminPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });
  if (error) throw error;
  return data;
}

