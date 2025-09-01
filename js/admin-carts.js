import { supabase } from './supabase.js';
import { checkAuth } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  const userData = await checkAuth();
  if (!userData || userData.role !== 'admin') {
    alert('Access denied. Admins only.');
    window.location.href = 'index.html';
    return;
  }
  
  await loadCarts();
  
  document.getElementById('logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('user');
    window.location.href = 'index.html';
  });
});

async function loadCarts() {
  try {
    const { data: carts, error } = await supabase
      .from('cart')
      .select('id, user_id, username, package_name, budget, items, total_price, status')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading carts:', error.message);
      alert('Error loading carts: ' + error.message);
      return;
    }
    
    const itemIds = [...new Set(carts.flatMap(cart => cart.items.map(item => String(item.id))))];
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('id, name, price, quantifiable')
      .in('id', itemIds);
    
    if (itemsError) {
      console.error('Error fetching item details:', itemsError.message);
      alert('Error fetching item details: ' + itemsError.message);
      return;
    }
    
    const cartsList = document.getElementById('carts-list');
    cartsList.innerHTML = carts.map(cart => {
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
      
      return `
                <div class="admin-cart" data-id="${cart.id}">
                    <h3>${cart.package_name || 'Custom Package'} (User: ${cart.username})</h3>
                    <p>Budget: ${cart.budget ? `₦${cart.budget.toFixed(2)}` : 'Not specified'}</p>
                    <p>Subtotal: ₦${(cart.total_price - 10000).toFixed(2)}</p>
                    <p>Packaging Fee: ₦10000.00</p>
                    <p>Total: ₦${cart.total_price.toFixed(2)}</p>
                    <p>Status: ${cart.status}</p>
                    <ul>${cartItems}</ul>
                    <form class="update-cart-form" data-id="${cart.id}">
                        <div class="form-group">
                            <label for="cart-status-${cart.id}">Update Status</label>
                            <select id="cart-status-${cart.id}" required>
                                <option value="pending" ${cart.status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="delivered" ${cart.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                                <option value="cancelled" ${cart.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <button type="submit">Update Status</button>
                        </div>
                    </form>
                </div>
            `;
    }).join('');
    
    document.querySelectorAll('.update-cart-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cartId = form.dataset.id;
        const status = form.querySelector('select').value;
        
        const { error } = await supabase
          .from('cart')
          .update({ status })
          .eq('id', cartId);
        
        if (error) {
          console.error('Error updating cart status:', error.message);
          alert('Error updating cart status: ' + error.message);
        } else {
          alert('Cart status updated successfully!');
          loadCarts();
        }
      });
    });
  } catch (error) {
    console.error('Unexpected error loading carts:', error.message);
    alert('Unexpected error loading carts: ' + error.message);
  }
}
