// js/customer.js - Added role check
import { supabase } from './supabase.js';
import { checkAuth } from './auth.js';

async function loadUserInfo() {
    const userData = await checkAuth();
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    if (userData.role !== 'customer') {
        alert('Access denied.');
        window.location.href = 'index.html';
        return;
    }
    
    let attempts = 0;
    const maxAttempts = 3;
    let username = null;
    let error = null;
    
    while (attempts < maxAttempts) {
        const { data, error: fetchError } = await supabase
            .from('users')
            .select('username')
            .eq('id', userData.id)
            .single();
        if (fetchError) {
            error = fetchError;
            console.error(`Attempt ${attempts + 1} failed: ${fetchError.message}`);
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
        }
        username = data.username;
        break;
    }
    
    if (error && !username) {
        console.error('Error fetching username:', error.message);
        document.getElementById('welcome-message').textContent = 'Hello, User';
    } else {
        document.getElementById('welcome-message').textContent = `Hello, ${username || 'User'}`;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadUserInfo();
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);
    
    const userData = await checkAuth();
    if (userData) {
        supabase
            .channel('users')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'users',
                    filter: `id=eq.${userData.id}`
                },
                payload => {
                    const newUsername = payload.new.username || 'User';
                    document.getElementById('welcome-message').textContent = `Hello, ${newUsername}`;
                    console.log('Username updated:', newUsername);
                }
            )
            .subscribe();
    }
});

supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || session) {
        await loadUserInfo();
    }
});
