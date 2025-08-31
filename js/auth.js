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
    .select('role, username, phone_number')
    .eq('id', user.id)
    .single();
  if (userError || !data) {
    console.error('Error fetching user data:', userError?.message);
    return null;
  }
  return { ...user, ...data };
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
  const username = document.getElementById('signup-username').value;
  const email = document.getElementById('signup-email').value;
  const phone_number = document.getElementById('signup-phone').value;
  const password = document.getElementById('signup-password').value;
  
  try {
    // Check for existing email or username
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${email},username.eq.${username}`)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking existing user:', checkError.message);
      alert('Error checking user: ' + checkError.message);
      return;
    }
    
    if (existingUser) {
      alert('Email or username already exists. Please use different ones.');
      return;
    }
    
    console.log('Attempting signup with email:', email); // Debug log
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, phone_number, role: 'user' },
        emailRedirectTo: 'https://samatekikarina-collab.github.io/lateh-luxe-app/confirm.html'
      }
    });
    
    if (error) {
      console.error('Signup error:', error.message);
      alert('Signup failed: ' + error.message);
      return;
    }
    
    if (data.user) {
      console.log('User created with ID:', data.user.id); // Debug log
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3s delay
      
      const { error: insertError } = await supabase.from('users').insert([
        {
          id: data.user.id,
          email,
          username,
          phone_number: phone_number || null,
          role: 'user'
        }
      ]);
      
      if (insertError) {
        console.error('Error adding user:', insertError.message, insertError.details);
        alert('Error adding user: ' + insertError.message);
        return;
      }
      
      alert('Signup successful! Please check your email to confirm.');
      window.location.href = 'index.html';
    } else {
      console.error('No user data returned');
      alert('Signup failed: No user data returned.');
    }
  } catch (err) {
    console.error('Unexpected error during signup:', err);
    alert('Unexpected error during signup: ' + err.message);
  }
});

document.getElementById('forgot-password')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  if (!email) {
    alert('Please enter your email address.');
    return;
  }
  
  console.log('Sending password reset for email:', email); // Debug log
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://samatekikarina-collab.github.io/lateh-luxe-app/reset-password.html'
  });
  
  if (error) {
    console.error('Password reset error:', error.message);
    alert('Error sending password reset email: ' + error.message);
    return;
  }
  
  alert('Password reset email sent! Check your inbox.');
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
