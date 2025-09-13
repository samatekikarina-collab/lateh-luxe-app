import { supabase } from './supabase.js';
import { checkAuth } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  const userData = await checkAuth();
  if (!userData || userData.role !== 'admin') {
    await Swal.fire({
      title: "Error",
      text: "Access denied. Admins only.",
      icon: "error",
      confirmButtonColor: "#FFD700"
    });
    window.location.href = 'index.html';
    return;
  }
  
  await loadCarts();
  
  document.getElementById('logout').addEventListener('click', async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    localStorage.removeItem('user');
    await Swal.fire({
      title: "Success",
      text: "Logged out successfully.",
      icon: "success",
      confirmButtonColor: "#FFD700"
    });
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
      await Swal.fire({
        title: "Error",
        text: `Error loading carts: ${error.message}`,
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
    
    const cartsList = document.getElementById('carts-list');
    if (!cartsList) {
      console.error('Error: Element with ID "carts-list" not found.');
      await Swal.fire({
        title: "Error",
        text: "Carts list element not found. Please check the HTML structure.",
        icon: "error",
        confirmButtonColor: "#FFD700"
      });
      return;
    }
    
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
                    <div class="cart-actions">
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
                                <button type="submit" class="update-cart">Update Status</button>
                            </div>
                        </form>
                        <button class="delete-cart" data-id="${cart.id}">Delete</button>
                    </div>
                </div>
            `;
    }).join('');
    
    // Add event listeners for update forms
    document.querySelectorAll('.update-cart-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cartId = form.dataset.id;
        const status = form.querySelector('select').value;
        
        try {
          const { error } = await supabase
            .from('cart')
            .update({ status })
            .eq('id', cartId);
          
          if (error) {
            console.error('Error updating cart status:', error.message);
            await Swal.fire({
              title: "Error",
              text: `Error updating cart status: ${error.message}`,
              icon: "error",
              confirmButtonColor: "#FFD700"
            });
          } else {
            await Swal.fire({
              title: "Success",
              text: `Cart ${cartId} status updated to ${status}.`,
              icon: "success",
              confirmButtonColor: "#FFD700"
            });
            await loadCarts();
          }
        } catch (error) {
          console.error('Unexpected error updating cart:', error.message);
          await Swal.fire({
            title: "Error",
            text: `Unexpected error updating cart: ${error.message}`,
            icon: "error",
            confirmButtonColor: "#FFD700"
          });
        }
      });
    });
    
    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-cart').forEach(button => {
      button.addEventListener('click', async () => {
        const cartId = button.dataset.id;
        
        const result = await Swal.fire({
          title: "Are you sure?",
          text: `Do you want to delete cart ${cartId}? This action cannot be undone.`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#FFD700",
          cancelButtonColor: "#d33",
          confirmButtonText: "Yes, delete it",
          cancelButtonText: "Cancel"
        });
        
        if (result.isConfirmed) {
          try {
            const { error } = await supabase
              .from('cart')
              .delete()
              .eq('id', cartId);
            
            if (error) {
              console.error('Error deleting cart:', error.message);
              await Swal.fire({
                title: "Error",
                text: `Error deleting cart: ${error.message}`,
                icon: "error",
                confirmButtonColor: "#FFD700"
              });
              return;
            }
            
            await Swal.fire({
              title: "Deleted",
              text: `Cart ${cartId} has been deleted.`,
              icon: "success",
              confirmButtonColor: "#FFD700"
            });
            await loadCarts();
          } catch (error) {
            console.error('Unexpected error deleting cart:', error.message);
            await Swal.fire({
              title: "Error",
              text: `Unexpected error deleting cart: ${error.message}`,
              icon: "error",
              confirmButtonColor: "#FFD700"
            });
          }
        }
      });
    });
    
  } catch (error) {
    console.error('Unexpected error loading carts:', error.message);
    await Swal.fire({
      title: "Error",
      text: `Unexpected error loading carts: ${error.message}`,
      icon: "error",
      confirmButtonColor: "#FFD700"
    });
  }
}
