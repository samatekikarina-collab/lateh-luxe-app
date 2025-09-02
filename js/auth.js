import { supabase } from './supabase.js';

// Utility function to check authentication status
export async function checkAuth() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      console.error('Error checking auth:', error?.message || 'No user found');
      return null;
    }

    const { data, error: userError } = await supabase
      .from('users')
      .select('role, username, phone_number')
      .eq('id', user.id)
      .single();

    if (userError || !data) {
      console.error('Error fetching user data:', userError?.message || 'No user data found');
      return null;
    }

    return { ...user, ...data };
  } catch (err) {
    console.error('Unexpected error in checkAuth:', err.message);
    return null;
  }
}

// Handle DOMContentLoaded to check auth status on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM fully loaded, checking auth status...');
  const userData = await checkAuth();
  if (userData) {
    console.log('User authenticated:', userData);
    document.querySelector('.navigation')?.classList.remove('hidden');
    document.querySelector('.hamburger')?.classList.remove('hidden');
    if (userData.role !== 'admin') {
      document.querySelectorAll('.admin-link').forEach(link => {
        link.style.display = 'none';
      });
    }
  } else {
    console.log('No user authenticated on page load');
  }
});

// Handle login form submission
const loginForm = document.getElementById('login');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Login form submitted');

    const email = document.getElementById('login-email')?.value;
    const password = document.getElementById('login-password')?.value;

    if (!email || !password) {
      console.error('Email or password missing');
      alert('Please enter both email and password.');
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('Login error:', error.message);
        alert(`Login failed: ${error.message}`);
        return;
      }

      console.log('Login successful, fetching user data...');
      const userData = await checkAuth();
      if (!userData) {
        console.error('Failed to fetch user data after login');
        alert('Error fetching user data.');
        return;
      }

      console.log('User data retrieved:', userData);
      document.querySelector('.navigation')?.classList.remove('hidden');
      document.querySelector('.hamburger')?.classList.remove('hidden');
      if (userData.role !== 'admin') {
        document.querySelectorAll('.admin-link').forEach(link => {
          link.style.display = 'none';
        });
      }

      // Redirect based on user role
      const redirectUrl = userData.role === 'admin' ? 'admin.html' : 'customer.html';
      console.log(`Redirecting to ${redirectUrl}`);
      window.location.href = redirectUrl;
    } catch (err) {
      console.error('Unexpected error during login:', err.message);
      alert(`Unexpected error during login: ${err.message}`);
    }
  });
} else {
  console.error('Login form not found in DOM');
}

// Handle signup form submission
const signupForm = document.getElementById('signup');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Signup form submitted');

    const username = document.getElementById('signup-username')?.value;
    const email = document.getElementById('signup-email')?.value;
    const phone_number = document.getElementById('signup-phone')?.value;
    const password = document.getElementById('signup-password')?.value;

    if (!username || !email || !password) {
      console.error('Missing required signup fields');
      alert('Please fill in all required fields.');
      return;
    }

    try {
      // Check for existing email or username
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .or(`email.eq.${email},username.eq.${username}`)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing user:', checkError.message);
        alert(`Error checking user: ${checkError.message}`);
        return;
      }

      if (existingUser) {
        console.error('Email or username already exists');
        alert('Email or username already exists. Please use different ones.');
        return;
      }

      console.log('Attempting signup with email:', email);
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
        alert(`Signup failed: ${error.message}`);
        return;
      }

      if (data.user) {
        console.log('User created with ID:', data.user.id);
        await new Promise(resolve => setTimeout(resolve, 3000));

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
          console.error('Error adding user to database:', insertError.message);
          alert(`Error adding user: ${insertError.message}`);
          return;
        }

        console.log('Signup successful, user added to database');
        alert('Signup successful! Please check your email to confirm.');
        window.location.href = 'index.html';
      } else {
        console.error('No user data returned after signup');
        alert('Signup failed: No user data returned.');
      }
    } catch (err) {
      console.error('Unexpected error during signup:', err.message);
      alert(`Unexpected error during signup: ${err.message}`);
    }
  });
} else {
  console.error('Signup form not found in DOM');
}

// Handle forgot password
const forgotPasswordLink = document.getElementById('forgot-password');
if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    console.log('Forgot password link clicked');

    const email = document.getElementById('login-email')?.value;
    if (!email) {
      console.error('Email not provided for password reset');
      alert('Please enter your email address.');
      return;
    }

    try {
      console.log('Sending password reset for email:', email);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://samatekikarina-collab.github.io/lateh-luxe-app/reset-password.html'
      });

      if (error) {
        console.error('Password reset error:', error.message);
        alert(`Error sending password reset email: ${error.message}`);
        return;
      }

      console.log('Password reset email sent successfully');
      alert('Password reset email sent! Check your inbox.');
    } catch (err) {
      console.error('Unexpected error during password reset:', err.message);
      alert(`Unexpected error during password reset: ${err.message}`);
    }
  });
} else {
  console.error('Forgot password link not found in DOM');
}

// Handle logout
const logoutLink = document.getElementById('logout');
if (logoutLink) {
  logoutLink.addEventListener('click', async (e) => {
    e.preventDefault();
    console.log('Logout link clicked');
    try {
      await supabase.auth.signOut();
      console.log('User signed out successfully');
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Error during logout:', err.message);
      alert(`Error during logout: ${err.message}`);
    }
  });
} else {
  console.error('Logout link not found in DOM');
}
