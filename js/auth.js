import { supabase } from './supabase.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

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
      await Swal.fire({
        title: "Error",
        text: "Please enter both email and password.",
        icon: "error",
        confirmButtonColor: "#FFD700"
      });
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('Login error:', error.message);
        await Swal.fire({
          title: "Error",
          text: `Login failed: ${error.message}`,
          icon: "error",
          confirmButtonColor: "#FFD700"
        });
        return;
      }

      console.log('Login successful, fetching user data...');
      const userData = await checkAuth();
      if (!userData) {
        console.error('Failed to fetch user data after login');
        await Swal.fire({
          title: "Error",
          text: "Error fetching user data.",
          icon: "error",
          confirmButtonColor: "#FFD700"
        });
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

      const redirectUrl = userData.role === 'admin' ? 'admin.html' : 'customer.html';
      console.log(`Redirecting to ${redirectUrl}`);
      window.location.href = redirectUrl;
    } catch (err) {
      console.error('Unexpected error during login:', err.message);
      await Swal.fire({
        title: "Error",
        text: `Unexpected error during login: ${err.message}`,
        icon: "error",
        confirmButtonColor: "#FFD700"
      });
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
      await Swal.fire({
        title: "Error",
        text: "Please fill in all required fields.",
        icon: "error",
        confirmButtonColor: "#FFD700"
      });
      return;
    }

    try {
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .or(`email.eq.${email},username.eq.${username}`)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing user:', checkError.message);
        await Swal.fire({
          title: "Error",
          text: `Error checking user: ${checkError.message}`,
          icon: "error",
          confirmButtonColor: "#FFD700"
        });
        return;
      }

      if (existingUser) {
        console.error('Email or username already exists');
        await Swal.fire({
          title: "Error",
          text: "Email or username already exists. Please use different ones.",
          icon: "error",
          confirmButtonColor: "#FFD700"
        });
        return;
      }

      console.log('Attempting signup with email:', email);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, phone_number, role: 'user' },
          emailRedirectTo: 'https://samatekikarina-collab.github.io/lateh-luxe-app/confirm-email.html'
        }
      });

      if (error) {
        console.error('Signup error:', error.message);
        await Swal.fire({
          title: "Error",
          text: `Signup failed: ${error.message}`,
          icon: "error",
          confirmButtonColor: "#FFD700"
        });
        return;
      }

      if (data.user) {
        console.log('User created with ID:', data.user.id);
        const { data: existingId, error: idCheckError } = await supabase
          .from('users')
          .select('id')
          .eq('id', data.user.id)
          .maybeSingle();

        if (idCheckError) {
          console.error('Error checking existing ID:', idCheckError.message);
          await Swal.fire({
            title: "Error",
            text: `Error checking ID: ${idCheckError.message}`,
            icon: "error",
            confirmButtonColor: "#FFD700"
          });
          return;
        }

        if (!existingId) {
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
            await Swal.fire({
              title: "Error",
              text: `Error adding user: ${insertError.message}`,
              icon: "error",
              confirmButtonColor: "#FFD700"
            });
            return;
          }
        } else {
          console.log('User with this ID already exists, skipping insert');
        }

        console.log('Signup successful');
        await Swal.fire({
          title: "Success",
          text: "Signup successful! Please check your email to confirm.",
          icon: "success",
          confirmButtonColor: "#FFD700"
        });
        window.location.href = 'login.html';
      } else {
        console.error('No user data returned after signup');
        await Swal.fire({
          title: "Error",
          text: "Signup failed: No user data returned.",
          icon: "error",
          confirmButtonColor: "#FFD700"
        });
      }
    } catch (err) {
      console.error('Unexpected error during signup:', err.message);
      await Swal.fire({
        title: "Error",
        text: `Unexpected error during signup: ${err.message}`,
        icon: "error",
        confirmButtonColor: "#FFD700"
      });
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
      await Swal.fire({
        title: "Error",
        text: "Please enter your email address.",
        icon: "error",
        confirmButtonColor: "#FFD700"
      });
      return;
    }

    try {
      console.log('Sending password reset for email:', email);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://samatekikarina-collab.github.io/lateh-luxe-app/reset-password.html'
      });

      if (error) {
        console.error('Password reset error:', error.message);
        await Swal.fire({
          title: "Error",
          text: `Error sending password reset email: ${error.message}`,
          icon: "error",
          confirmButtonColor: "#FFD700"
        });
        return;
      }

      console.log('Password reset email sent successfully');
      await Swal.fire({
        title: "Success",
        text: "Password reset email sent! Check your inbox.",
        icon: "success",
        confirmButtonColor: "#FFD700"
      });
    } catch (err) {
      console.error('Unexpected error during password reset:', err.message);
      await Swal.fire({
        title: "Error",
        text: `Unexpected error during password reset: ${err.message}`,
        icon: "error",
        confirmButtonColor: "#FFD700"
      });
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
      await Swal.fire({
        title: "Success",
        text: "Logged out successfully.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        confirmButtonColor: "#FFD700"
      });
      window.location.href = 'login.html'; // Updated redirect
    } catch (err) {
      console.error('Error during logout:', err.message);
      await Swal.fire({
        title: "Error",
        text: `Error during logout: ${err.message}`,
        icon: "error",
        confirmButtonColor: "#FFD700"
      });
    }
  });
} else {
  console.error('Logout link not found in DOM');
}
