// js/auth.js
import { supabase } from './supabase.js';

export async function checkAuth() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    console.error('Error checking auth:', error?.message);
    return null;
  }
  const { data, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  if (userError || !data) {
    console.error('Error fetching user role:', userError?.message);
    return null;
  }
  return { ...user, role: data.role };
}

document.getElementById('login')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Login error:', error.message);
    alert('Login failed: ' + error.message);
    return;
  }
  
  const userData = await checkAuth();
  if (!userData) {
    alert('Error fetching user data.');
    return;
  }
  
  if (userData.role === 'admin') {
    window.location.href = 'admin.html';
  } else {
    window.location.href = 'customer.html';
  }
});

document.getElementById('signup')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { role: 'user' } // Updated to 'user' to match constraint
    }
  });
  
  if (error) {
    console.error('Signup error:', error.message);
    alert('Signup failed: ' + error.message);
    return;
  }
  
  if (data.user) {
    const { error: insertError } = await supabase.from('users').insert({
      id: data.user.id,
      email,
      role: 'user' // Updated to 'user' to match constraint
    });
    
    if (insertError) {
      console.error('Error saving user:', insertError.message, insertError.details);
      alert('Error saving user: ' + insertError.message);
      return;
    }
    
    alert('Signup successful! Please check your email to confirm.');
    window.location.href = 'index.html';
  } else {
    alert('Signup failed: No user data returned.');
  }
});

document.getElementById('forgot-password')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  if (!email) {
    alert('Please enter your email address.');
    return;
  }
  
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'http://localhost:3000/reset-password.html' // Update with your deployed URL
  });
  
  if (error) {
    console.error('Password reset error:', error.message);
    alert('Error sending password reset email: ' + error.message);
    return;
  }
  
  alert('Password reset email sent! Check your inbox.');
});

document.getElementById('reset-password')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newPassword = document.getElementById('new-password').value;
  
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    console.error('Password update error:', error.message);
    alert('Error resetting password: ' + error.message);
    return;
  }
  
  alert('Password reset successful! Please log in.');
  window.location.href = 'index.html';
});

document.getElementById('logout')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

document.getElementById('logout-mobile')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});
