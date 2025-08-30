// js/cart.js - Fixed total calculation to be async, display package details with items, verify payment fetch user
import { supabase } from './supabase.js';
import { checkAuth } from './auth.js';

async function loadCart() {
  const userData = await checkAuth();
  if (!userData) {
    alert('You must be logged in to view your cart.');
    window.location.href = 'index.html';
    return;
  }
  
  const { data: cart, error } = await supabase.from('cart').select('*').eq('user_id', userData.id).order('created_at', { ascending: false });
  if (error) {
    console.error('Error loading cart:', error.message);
    alert('Error loading cart: ' + error.message);
    return;
  }
  
  const cartItems = document.getElementById('cart-items');
  cartItems.innerHTML = '';
  let total = 0;
  for (const item of cart) {
    const packageItems = [];
    if (item.items && item.items.length) {
      const { data: customItems } = await supabase.from('items').select('name, price').in('id', item.items);
      packageItems.push(...(customItems || []));
    }
    if (item.curated_items && item.curated_items.length) {
      const { data: curatedItems } = await supabase.from('curated_items').select('name, price').in('id', item.curated_items);
      packageItems.push(...(curatedItems || []));
    }
    total += item.total_price || 0;
    cartItems.innerHTML += `
      <div class="cart-item">
          <h3>${item.package_name}</h3>
          <p>Budget: ₦${item.budget ? item.budget.toLocaleString('en-NG') : 'No budget'}</p>
          <ul>
              ${packageItems.map(pi => `<li>${pi.name} - ₦${pi.price.toLocaleString('en-NG')}</li>`).join('')}
          </ul>
      </div>
  `;
  }
  document.getElementById('total-price').textContent = `Total: ₦${total.toLocaleString('en-NG')}`;
}

document.getElementById('checkout')?.addEventListener('click', async () => {
  const userData = await checkAuth();
  const total = parseFloat(document.getElementById('total-price').textContent.replace('Total: ₦', '').replace(/,/g, ''));
  
  const handler = PaystackPop.setup({
    key: 'pk_test_xxxxxxxxxx', // Replace with your Paystack public key
    email: userData.email,
    amount: total * 100, // in kobo
    currency: 'NGN',
    ref: '' + Math.floor((Math.random() * 1000000000) + 1),
    callback: function(response) {
      verifyPayment(response.reference);
    },
    onClose: function() {
      alert('Payment cancelled');
    }
  });
  handler.openIframe();
});

async function verifyPayment(reference) {
  // Assuming verification is successful for demo; in production, call Paystack API
  console.log('Verify payment with ref:', reference);
  // Mock success
  const userData = await checkAuth();
  const { data: cart, error } = await supabase.from('cart').select('*').eq('user_id', userData.id);
  if (error) {
    console.error('Error fetching cart:', error.message);
    alert('Error fetching cart: ' + error.message);
    return;
  }
  
  const { error: insertError } = await supabase.from('purchases').insert(cart.map(c => ({ ...c, payment_ref: reference })));
  if (insertError) {
    console.error('Error moving to purchases:', insertError.message);
    alert('Error moving to purchases: ' + insertError.message);
    return;
  }
  
  const { error: deleteError } = await supabase.from('cart').delete().eq('user_id', userData.id);
  if (deleteError) {
    console.error('Error clearing cart:', deleteError.message);
  }
  alert('Payment successful! Package moved to purchases.');
  window.location.href = 'profile.html';
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadCart();
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  document.body.classList.toggle('dark-mode', isDarkMode);
});
