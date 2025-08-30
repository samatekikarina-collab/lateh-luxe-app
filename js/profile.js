// js/profile.js - Fixed loadPurchases to fetch related items separately
import { supabase } from './supabase.js';
import { checkAuth } from './auth.js';

async function loadPurchases() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: purchases, error } = await supabase.from('purchases').select('*').eq('user_id', user.id);
    if (error) return alert(error.message);
    const list = document.getElementById('purchases-list');
    list.innerHTML = '';
    for (const purchase of purchases) {
        const items = [];
        if (purchase.items && purchase.items.length) {
            const { data: customItems } = await supabase.from('items').select('name, price').in('id', purchase.items);
            items.push(...(customItems || []));
        }
        if (purchase.curated_items && purchase.curated_items.length) {
            const { data: curatedItems } = await supabase.from('curated_items').select('name, price').in('id', purchase.curated_items);
            items.push(...(curatedItems || []));
        }
        list.innerHTML += `
            <li>
                ${purchase.package_name} (${purchase.budget ? '₦' + purchase.budget.toFixed(2) : 'No budget'})
                <ul>
                    ${items.map(item => `<li>${item.name} - ₦${item.price.toFixed(2)}</li>`).join('')}
                </ul>
            </li>
        `;
    }
}

async function loadUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('users').select('username, email, phone_number').eq('id', user.id).single();
    if (error) return alert(error.message);
    document.getElementById('edit-username').value = data.username || '';
    document.getElementById('edit-email').value = data.email;
    document.getElementById('edit-phone-number').value = data.phone_number || '';
}

document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('edit-username').value;
    const email = document.getElementById('edit-email').value;
    const phone_number = document.getElementById('edit-phone-number').value;
    const { data: { user } } = await supabase.auth.getUser();
    const { error: updateError } = await supabase.from('users').update({
        username,
        email,
        phone_number
    }).eq('id', user.id);
    if (updateError) {
        alert('Error updating profile: ' + updateError.message);
    } else {
        // Update email in auth.users if changed
        if (email !== user.email) {
            const { error: authError } = await supabase.auth.updateUser({ email });
            if (authError) alert('Error updating auth email: ' + authError.message);
        }
        alert('Profile updated successfully!');
        loadUserProfile();
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const userData = await checkAuth();
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }
    loadPurchases();
    loadUserProfile();
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);
});
