import { supabase } from './supabase.js';
import { checkAuth } from './auth.js';

let selectedItems = [];
let currentCategoryId = null;

async function loadCategories() {
  const { data: categories, error } = await supabase
    .from('curated_categories')
    .select('id, name, image')
    .order('name', { ascending: true });
  if (error) {
    console.error('Error loading categories:', error.message);
    alert('Error loading categories: ' + error.message);
    return;
  }
  
  const grid = document.getElementById('curated-categories-grid');
  grid.innerHTML = categories.map(category => `
        <div class="category" data-id="${category.id}">
            ${category.image ? `<img src="${category.image}" alt="${category.name}">` : ''}
            <h3>${category.name}</h3>
        </div>
    `).join('');
  
  grid.querySelectorAll('.category').forEach(category => {
    category.addEventListener('click', () => {
      currentCategoryId = category.dataset.id;
      document.getElementById('category-name').textContent = category.querySelector('h3').textContent;
      const image = category.querySelector('img')?.src || '';
      document.querySelector('#category-image').src = image;
      document.getElementById('category-image').style.display = image ? 'block' : 'none';
      document.getElementById('categories-section').classList.add('hidden');
      document.getElementById('category-header').classList.remove('hidden');
      document.getElementById('items-section').classList.remove('hidden');
      document.getElementById('selected-items').classList.remove('hidden');
      document.getElementById('add-to-cart').classList.remove('hidden');
      document.getElementById('total-shortcut').classList.remove('hidden');
      loadItems(currentCategoryId);
    });
  });
}

async function loadItems(categoryId) {
  const { data: items, error } = await supabase
    .from('curated_items')
    .select('id, name, price, description, image')
    .eq('category_id', categoryId)
    .order('name', { ascending: true });
  if (error) {
    console.error('Error loading items:', error.message);
    alert('Error loading items: ' + error.message);
    return;
  }
  
  const itemsList = document.getElementById('curated-items-list');
  itemsList.innerHTML = items.map(item => `
        <div class="item" data-id="${item.id}">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" class="item-image">` : ''}
            <div class="item-content">
                <h3>${item.name}</h3>
                <p class="item-price">₦${item.price.toFixed(2)}</p>
                <p class="item-description">${item.description || ''}</p>
            </div>
            <input type="checkbox" class="item-checkbox" ${selectedItems.includes(item.id) ? 'checked' : ''}>
        </div>
    `).join('');
  
  itemsList.querySelectorAll('.item-image').forEach(image => {
    image.addEventListener('click', () => {
      const item = image.closest('.item');
      const content = item.querySelector('.item-content');
      const isExpanded = item.classList.contains('image-expanded');
      if (isExpanded) {
        item.classList.remove('image-expanded');
        content.style.display = 'flex';
        image.style.maxHeight = '150px';
        image.style.cursor = 'zoom-in';
      } else {
        item.classList.add('image-expanded');
        content.style.display = 'none';
        image.style.maxHeight = '100%';
        image.style.cursor = 'zoom-out';
      }
    });
  });
  
  itemsList.querySelectorAll('.item-checkbox').forEach((checkbox, index) => {
    checkbox.addEventListener('change', () => {
      const itemId = items[index].id;
      if (checkbox.checked) {
        if (!selectedItems.includes(itemId)) {
          selectedItems.push(itemId);
        }
      } else {
        selectedItems = selectedItems.filter(id => id !== itemId);
      }
      renderSelectedItems();
      updateTotalPrice();
    });
  });
}

async function renderSelectedItems() {
  const { data: items, error } = await supabase
    .from('curated_items')
    .select('id, name, price, image')
    .in('id', selectedItems);
  if (error) {
    console.error('Error loading selected items:', error.message);
    alert('Error loading selected items: ' + error.message);
    return;
  }
  
  const selectedItemsList = document.getElementById('selected-items-list');
  selectedItemsList.innerHTML = items.map(item => `
        <li class="selected-item" data-id="${item.id}">
            ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
            <div>
                <h3>${item.name}</h3>
                <p>₦${item.price.toFixed(2)}</p>
            </div>
        </li>
    `).join('');
}

async function updateTotalPrice() {
  const { data: items, error } = await supabase
    .from('curated_items')
    .select('price')
    .in('id', selectedItems);
  if (error) {
    console.error('Error calculating total price:', error.message);
    alert('Error calculating total price: ' + error.message);
    return;
  }
  
  const total = items.reduce((sum, item) => sum + item.price, 0);
  const totalText = `₦${total.toFixed(2)}`;
  document.getElementById('total-price').textContent = `Total: ${totalText}`;
  document.getElementById('shortcut-total').textContent = totalText;
  adjustTotalShortcutSize(totalText);
  return total;
}

function adjustTotalShortcutSize(totalText) {
  const shortcut = document.getElementById('total-shortcut');
  const textLength = totalText.length;
  const baseWidth = 100;
  const baseHeight = 40;
  const widthIncrement = 8;
  const maxWidth = 160;
  const newWidth = Math.min(baseWidth + (textLength - 5) * widthIncrement, maxWidth);
  shortcut.style.width = `${newWidth}px`;
  shortcut.style.height = `${baseHeight}px`;
  shortcut.style.fontSize = `${baseHeight / 2.5}px`;
}

async function generateWhatsAppMessage(userData, items, totalPrice) {
  const itemDetails = items.map(item => `- ${item.name}: ₦${item.price.toFixed(2)}`).join('\n');
  const message = `New Order from ${userData.email || 'Customer'}\n` +
    `Curated Box Order\n` +
    `Items:\n${itemDetails}\n` +
    `Total: ₦${totalPrice.toFixed(2)}\n` +
    `Please confirm payment details.`;
  const encodedMessage = encodeURIComponent(message);
  const whatsappNumber = '+2349122834983'; // Updated with provided number
  return `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
}

document.querySelector('.back-button')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('categories-section').classList.remove('hidden');
  document.getElementById('category-header').classList.add('hidden');
  document.getElementById('items-section').classList.add('hidden');
  currentCategoryId = null;
});

document.getElementById('add-to-cart')?.addEventListener('click', async () => {
  if (selectedItems.length === 0) {
    alert('No items selected!');
    return;
  }
  
  const userData = await checkAuth();
  if (!userData) {
    alert('You must be logged in to add to cart.');
    window.location.href = 'index.html';
    return;
  }
  
  const totalPrice = await updateTotalPrice();
  
  // Fetch selected items for WhatsApp message
  const { data: items, error: itemsError } = await supabase
    .from('curated_items')
    .select('id, name, price')
    .in('id', selectedItems);
  if (itemsError) {
    console.error('Error fetching items for WhatsApp:', itemsError.message);
    alert('Error preparing order: ' + itemsError.message);
    return;
  }
  
  // Insert into cart
  const { error: cartError } = await supabase.from('cart').insert({
    user_id: userData.id,
    package_name: `Curated Box - ${new Date().toLocaleDateString()}`,
    budget: null,
    items: [],
    curated_items: selectedItems,
    total_price: totalPrice,
  });
  if (cartError) {
    console.error('Error adding to cart:', cartError.message);
    alert('Error adding to cart: ' + cartError.message);
    return;
  }
  
  // Generate and open WhatsApp message
  const whatsappUrl = await generateWhatsAppMessage(userData, items, totalPrice);
  window.open(whatsappUrl, '_blank');
  
  alert('Order added to cart! WhatsApp message opened for order confirmation.');
  selectedItems = [];
  renderSelectedItems();
  updateTotalPrice();
  document.getElementById('categories-section').classList.remove('hidden');
  document.getElementById('category-header').classList.add('hidden');
  document.getElementById('items-section').classList.add('hidden');
  document.getElementById('selected-items').classList.add('hidden');
  document.getElementById('add-to-cart').classList.add('hidden');
  document.getElementById('total-shortcut').classList.add('hidden');
  currentCategoryId = null;
});

document.addEventListener('DOMContentLoaded', async () => {
  const userData = await checkAuth();
  if (!userData) {
    alert('You must be logged in to access this page.');
    window.location.href = 'index.html';
    return;
  }
  
  document.getElementById('category-header').classList.add('hidden');
  document.getElementById('items-section').classList.add('hidden');
  document.getElementById('selected-items').classList.add('hidden');
  document.getElementById('add-to-cart').classList.add('hidden');
  document.getElementById('total-shortcut').classList.add('hidden');
  await loadCategories();
  
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  document.body.classList.toggle('dark-mode', isDarkMode);
});
