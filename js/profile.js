import { supabase } from './supabase.js';
import { checkAuth } from './auth.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

async function loadPurchases() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: purchases, error } = await supabase.from('purchases').select('*').eq('user_id', user.id);
    if (error) {
        await Swal.fire({
            title: "Error",
            text: error.message,
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }
    const list = document.getElementById('purchases-list');
    list.innerHTML = '';
    for (const purchase of purchases) {
        const items = [];
        if (purchase.items && purchase.items.length) {
            const { data: customItems } = await supabase.from('items').select('id, name, price, quantifiable').in('id', purchase.items.map(i => i.id));
            items.push(...customItems.map(ci => ({
                ...ci,
                quantity: purchase.items.find(i => i.id === ci.id).quantity
            })));
        }
        if (purchase.curated_items && purchase.curated_items.length) {
            const { data: curatedItems } = await supabase.from('curated_items').select('id, name, price, quantifiable').in('id', purchase.curated_items.map(i => i.id));
            items.push(...curatedItems.map(ci => ({
                ...ci,
                quantity: purchase.curated_items.find(i => i.id === ci.id).quantity
            })));
        }
        list.innerHTML += `
            <li>
                ${purchase.package_name} (${purchase.budget ? '₦' + purchase.budget.toFixed(2) : 'No budget'})
                <ul>
                    ${items.map(item => `<li>${item.name} ${item.quantifiable ? `(x${item.quantity})` : ''} - ₦${(item.price * item.quantity).toFixed(2)}</li>`).join('')}
                </ul>
            </li>
        `;
    }
}

async function loadUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('users').select('username, email, phone_number').eq('id', user.id).single();
    if (error) {
        await Swal.fire({
            title: "Error",
            text: error.message,
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }
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
        await Swal.fire({
            title: "Error",
            text: `Error updating profile: ${updateError.message}`,
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
    } else {
        if (email !== user.email) {
            const { error: authError } = await supabase.auth.updateUser({ email });
            if (authError) {
                await Swal.fire({
                    title: "Error",
                    text: `Error updating auth email: ${authError.message}`,
                    icon: "error",
                    confirmButtonColor: "#FFD700"
                });
            }
        }
        await Swal.fire({
            title: "Success",
            text: "Profile updated successfully!",
            icon: "success",
            confirmButtonColor: "#FFD700"
        });
        loadUserProfile();
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const userData = await checkAuth();
    if (!userData) {
        await Swal.fire({
            title: "Error",
            text: "You must be logged in to access this page.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        window.location.href = 'login.html'; // Updated redirect
        return;
    }
    loadPurchases();
    loadUserProfile();
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);
});
