import { supabase } from './supabase.js';
import { checkAuth } from './auth.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

document.addEventListener('DOMContentLoaded', async () => {
  const userData = await checkAuth();
  if (!userData) {
    await Swal.fire({
      title: "Error",
      text: "You must be logged in to view your cart.",
      icon: "error",
      confirmButtonColor: "#FFD700"
    });
    window.location.href = 'login.html'; // Updated redirect
    return;
  }
  
  await loadCartItems(userData);
  
  document.getElementById('logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user');
    await Swal.fire({
      title: "Success",
      text: "Logged out successfully.",
      icon: "success",
      timer: 1500,
      showConfirmButton: false,
      confirmButtonColor: "#FFD700"
    });
    window.location.href = 'login.html'; // Updated redirect
  });
});

async function loadCartItems(userData) {
  try {
    const { data: carts, error } = await supabase
      .from('cart')
      .select('id, package_name, budget, items, total_price, status, created_at')
      .eq('user_id', userData.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading cart items:', error.message);
      await Swal.fire({
        title: "Error",
        text: `Error loading cart items: ${error.message}`,
        icon: "error",
        confirmButtonColor: "#FFD700"
      });
      return;
    }
    
    const itemIds = [...new Set(carts.flatMap(cart => cart.items.map(item => String(item.id))))];
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, name, price, quantifiable')
      .in('id', itemIds);
    
    if (itemsError) {
      console.error('Error fetching item details:', itemsError.message);
      await Swal.fire({
        title: "Error",
        text: `Error fetching item details: ${itemsError.message}`,
        icon: "error",
        confirmButtonColor: "#FFD700"
      });
      return;
    }
    
    const cartItemsContainer = document.getElementById('cart-items');
    cartItemsContainer.innerHTML = '';
    
    carts.forEach(cart => {
      const cartItems = cart.items.map(cartItem => {
        const item = items.find(i => String(i.id) === String(cartItem.id));
        if (!item) return '';
        const quantity = cartItem.quantity || 1;
        return `
                    <li>
                        ${item.name} ${item.quantifiable ? `(x${quantity})` : ''}: ₦${(Number(item.price) * quantity).toFixed(2)}
                    </li>
                `;
      }).join('');
      
      const isPending = cart.status === 'pending';
      const cartElement = document.createElement('div');
      cartElement.classList.add('cart-item');
      cartElement.innerHTML = `
                <h3>${cart.package_name || 'Custom Package'}</h3>
                <p>Budget: ${cart.budget ? `₦${cart.budget.toFixed(2)}` : 'Not specified'}</p>
                <p>Subtotal: ₦${(cart.total_price - 10000).toFixed(2)}</p>
                <p>Packaging Fee: ₦10000.00</p>
                <p>Total: ₦${cart.total_price.toFixed(2)}</p>
                <p>Status: ${cart.status}</p>
                <ul>${cartItems}</ul>
                <button class="send-reminder" data-cart-id="${cart.id}" ${!isPending ? 'disabled' : ''}>Send a Reminder</button>
            `;
      cartItemsContainer.appendChild(cartElement);
    });
    
    document.querySelectorAll('.send-reminder').forEach(button => {
      button.addEventListener('click', async () => {
        if (button.disabled) return;
        
        const cartId = button.dataset.cartId;
        const cart = carts.find(c => c.id === cartId);
        if (!cart) {
          await Swal.fire({
            title: "Error",
            text: "Cart not found.",
            icon: "error",
            confirmButtonColor: "#FFD700"
          });
          return;
        }
        
        try {
          const { data: itemsData, error: itemsError } = await supabase
            .from('items')
            .select('id, name, price, quantifiable')
            .in('id', cart.items.map(item => String(item.id)));
          
          if (itemsError) {
            console.error('Error fetching items for reminder:', itemsError.message);
            await Swal.fire({
              title: "Error",
              text: `Error fetching items for reminder: ${itemsError.message}`,
              icon: "error",
              confirmButtonColor: "#FFD700"
            });
            return;
          }
          
          const message = generateWhatsAppMessage(cart, itemsData, userData.email);
          const encodedMessage = encodeURIComponent(message);
          const phoneNumber = '+2349122834983';
          const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
          window.open(whatsappUrl, '_blank');
        } catch (error) {
          console.error('Error generating WhatsApp message:', error.message);
          await Swal.fire({
            title: "Error",
            text: `Error generating WhatsApp message: ${error.message}`,
            icon: "error",
            confirmButtonColor: "#FFD700"
          });
        }
      });
    });
  } catch (error) {
    console.error('Unexpected error loading cart:', error.message);
    await Swal.fire({
      title: "Error",
      text: `Unexpected error loading cart: ${error.message}`,
      icon: "error",
      confirmButtonColor: "#FFD700"
    });
  }
}

function generateWhatsAppMessage(cart, items, username) {
  const itemsList = cart.items.map(cartItem => {
    const item = items.find(i => String(i.id) === String(cartItem.id));
    if (!item) return '';
    const quantity = cartItem.quantity || 1;
    return `- ${item.name} ${item.quantifiable ? `(x${quantity})` : ''}: ₦${(Number(item.price) * quantity).toFixed(2)}`;
  }).filter(item => item).join('\n');
  
  return `Reminder: Order from ${username}
Package Name: ${cart.package_name || 'Custom Package'}
Items:
${itemsList}
Subtotal: ₦${(cart.total_price - 10000).toFixed(2)}
Packaging Fee: ₦10000.00
Total: ₦${cart.total_price.toFixed(2)}
Status: ${cart.status}
Budget: ${cart.budget ? `₦${cart.budget.toFixed(2)}` : 'Not specified'}
Please confirm payment details.`;
}
