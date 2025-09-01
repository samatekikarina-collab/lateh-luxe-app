import { supabase } from './supabase.js';
import { checkAuth } from './auth.js';

let selectedItems = []; // Stores { id: string, quantity: number }
let currentCategoryId = null;
let packageDetails = {};

async function loadCategories() {
    const { data: categories, error } = await supabase
        .from('custom_categories')
        .select('id, name, image')
        .order('name', { ascending: true });
    if (error) {
        console.error('Error loading categories:', error.message);
        alert('Error loading categories: ' + error.message);
        return;
    }
    
    const categoriesGrid = document.getElementById('categories-grid');
    categoriesGrid.innerHTML = categories.map(category => `
        <div class="category" data-id="${category.id}">
            ${category.image ? `<img src="${category.image}" alt="${category.name}">` : ''}
            <h3>${category.name}</h3>
        </div>
    `).join('');
    
    categoriesGrid.querySelectorAll('.category').forEach(category => {
        category.addEventListener('click', () => {
            currentCategoryId = category.dataset.id;
            document.getElementById('category-name').textContent = category.querySelector('h3').textContent;
            const image = category.querySelector('img')?.src || '';
            document.getElementById('category-image').src = image;
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
        .from('items')
        .select('id, name, price, description, image, quantifiable')
        .eq('category_id', categoryId)
        .order('name', { ascending: true });
    if (error) {
        console.error('Error loading items:', error.message);
        alert('Error loading items: ' + error.message);
        return;
    }
    
    console.log('Fetched items for category:', items);
    
    const itemsGrid = document.getElementById('items-grid');
    itemsGrid.innerHTML = items.map(item => `
        <div class="item" data-id="${item.id}">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" class="item-image">` : ''}
            <div class="item-content">
                <h3>${item.name}</h3>
                <p class="item-price">₦${Number(item.price).toFixed(2)}</p>
                <p class="item-description">${item.description || ''}</p>
            </div>
            ${item.quantifiable ? `
                <div class="quantity-selector">
                    <button class="quantity-decrement" data-id="${item.id}">-</button>
                    <span class="quantity-display">${getItemQuantity(item.id)}</span>
                    <button class="quantity-increment" data-id="${item.id}">+</button>
                </div>
            ` : `
                <input type="checkbox" class="item-checkbox" data-id="${item.id}" ${selectedItems.some(si => si.id === item.id) ? 'checked' : ''}>
            `}
        </div>
    `).join('');
    
    itemsGrid.querySelectorAll('.item-image').forEach(image => {
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
    
    itemsGrid.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', async () => {
            const itemId = checkbox.dataset.id;
            if (checkbox.checked) {
                const item = await getItemDetails(itemId);
                if (!item) {
                    checkbox.checked = false;
                    alert('Error fetching item details.');
                    return;
                }
                const canAdd = await checkBudgetBeforeAdd(item, 1);
                if (!canAdd) {
                    checkbox.checked = false;
                    alert(`Adding ${item.name} would exceed your budget of ₦${packageDetails.effectiveBudget.toFixed(2)}!`);
                    return;
                }
                if (!selectedItems.some(si => si.id === itemId)) {
                    selectedItems.push({ id: itemId, quantity: 1 });
                }
            } else {
                selectedItems = selectedItems.filter(si => si.id !== itemId);
            }
            renderSelectedItems();
            await updateTotalPrice();
        });
    });
    
    itemsGrid.querySelectorAll('.quantity-increment').forEach(button => {
        button.addEventListener('click', async () => {
            const itemId = button.dataset.id;
            const item = await getItemDetails(itemId);
            if (!item) {
                alert('Error fetching item details.');
                return;
            }
            const existingItem = selectedItems.find(si => si.id === itemId);
            const newQuantity = existingItem ? existingItem.quantity + 1 : 1;
            const canAdd = await checkBudgetBeforeAdd(item, newQuantity);
            if (!canAdd) {
                alert(`Increasing quantity of ${item.name} would exceed your budget of ₦${packageDetails.effectiveBudget.toFixed(2)}!`);
                return;
            }
            if (existingItem) {
                existingItem.quantity = newQuantity;
            } else {
                selectedItems.push({ id: itemId, quantity: 1 });
            }
            button.parentElement.querySelector('.quantity-display').textContent = getItemQuantity(itemId);
            renderSelectedItems();
            await updateTotalPrice();
        });
    });
    
    itemsGrid.querySelectorAll('.quantity-decrement').forEach(button => {
        button.addEventListener('click', async () => {
            const itemId = button.dataset.id;
            const item = selectedItems.find(si => si.id === itemId);
            if (item && item.quantity > 1) {
                item.quantity -= 1;
            } else {
                selectedItems = selectedItems.filter(si => si.id !== itemId);
            }
            button.parentElement.querySelector('.quantity-display').textContent = getItemQuantity(itemId);
            renderSelectedItems();
            await updateTotalPrice();
        });
    });
}

async function getItemDetails(itemId) {
    const { data: item, error } = await supabase
        .from('items')
        .select('id, name, price')
        .eq('id', itemId)
        .single();
    if (error) {
        console.error('Error fetching item details:', error.message);
        return null;
    }
    return item;
}

async function checkBudgetBeforeAdd(item, quantity) {
    if (!packageDetails.effectiveBudget) return true; // No budget set, allow all
    const currentTotal = await calculateTotalPrice();
    const existingItem = selectedItems.find(si => si.id === item.id);
    const currentContribution = existingItem ? Number(item.price) * existingItem.quantity : 0;
    const newContribution = Number(item.price) * quantity;
    const newTotal = Number((currentTotal - currentContribution + newContribution).toFixed(2));
    console.log('Check Budget: currentTotal=', currentTotal, 'currentContribution=', currentContribution, 'newContribution=', newContribution, 'newTotal=', newTotal, 'effectiveBudget=', packageDetails.effectiveBudget);
    return newTotal <= packageDetails.effectiveBudget;
}

function getItemQuantity(itemId) {
    const item = selectedItems.find(si => si.id === itemId);
    return item ? item.quantity : 0;
}

async function renderSelectedItems() {
    const { data: items, error } = await supabase
        .from('items')
        .select('id, name, price, image, quantifiable')
        .in('id', selectedItems.map(si => String(si.id)));
    if (error) {
        console.error('Error loading selected items:', error.message);
        alert('Error loading selected items: ' + error.message);
        return;
    }
    
    console.log('Selected items:', selectedItems);
    console.log('Fetched items for selected:', items);
    
    const selectedItemsList = document.getElementById('selected-items-list');
    selectedItemsList.innerHTML = items.map(item => {
        const selectedItem = selectedItems.find(si => si.id === String(item.id));
        const quantity = selectedItem ? selectedItem.quantity : 0;
        return `
            <li class="selected-item" data-id="${item.id}">
                ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
                <div>
                    <h3>${item.name} ${item.quantifiable ? `(x${quantity})` : ''}</h3>
                    <p>₦${(Number(item.price) * quantity).toFixed(2)}</p>
                    <button class="remove-item" data-id="${item.id}">Remove</button>
                </div>
            </li>
        `;
    }).join('');
    
    document.querySelectorAll('.remove-item').forEach(button => {
        button.removeEventListener('click', handleRemoveItem); // Prevent duplicate listeners
        button.addEventListener('click', handleRemoveItem);
    });
}

function handleRemoveItem(event) {
    const itemId = event.target.dataset.id;
    selectedItems = selectedItems.filter(si => si.id !== itemId);
    if (currentCategoryId) {
        loadItems(currentCategoryId); // Refresh items grid
    }
    renderSelectedItems();
    updateTotalPrice();
}

async function calculateTotalPrice() {
    if (selectedItems.length === 0) return 0;
    
    const itemIds = selectedItems.map(si => String(si.id));
    console.log('Fetching prices for item IDs:', itemIds);
    const { data: items, error } = await supabase
        .from('items')
        .select('id, price')
        .in('id', itemIds);
    if (error) {
        console.error('Error calculating total price:', error.message);
        alert('Error calculating total price: ' + error.message);
        return 0;
    }
    
    console.log('Fetched items for total:', items);
    
    const total = selectedItems.reduce((sum, si) => {
        const item = items.find(i => String(i.id) === String(si.id));
        const price = item ? Number(item.price) : 0;
        console.log(`Item ID: ${si.id}, Quantity: ${si.quantity}, Price: ${price}, Subtotal: ${price * si.quantity}`);
        return Number((sum + (price * si.quantity)).toFixed(2));
    }, 0);
    
    return total;
}

async function updateTotalPrice() {
    const total = await calculateTotalPrice();
    const totalText = `₦${total.toFixed(2)}`;
    document.getElementById('total-price').textContent = `Total: ${totalText}`;
    document.getElementById('total-shortcut').textContent = totalText;
    adjustTotalShortcutSize(totalText);
    console.log('Total price calculated:', total);
    return total;
}

function adjustTotalShortcutSize(totalText) {
    const shortcut = document.getElementById('total-shortcut');
    const textLength = totalText.length;
    const baseWidth = 80;
    const baseHeight = 40;
    const widthIncrement = 8;
    const maxWidth = 160;
    const newWidth = Math.min(baseWidth + (textLength - 5) * widthIncrement, maxWidth);
    shortcut.style.width = `${newWidth}px`;
    shortcut.style.height = `${baseHeight}px`;
    shortcut.style.fontSize = `${baseHeight / 2.5}px`;
}

async function generateWhatsAppMessage(userData, items, cartItems, subtotal) {
    const itemDetails = cartItems.map(cartItem => {
        const item = items.find(i => String(i.id) === String(cartItem.id));
        if (!item) return '';
        const quantity = cartItem.quantity || 1;
        return `- ${item.name} ${item.quantifiable ? `(x${quantity})` : ''}: ₦${(Number(item.price) * quantity).toFixed(2)}`;
    }).join('\n');

    const finalTotal = subtotal + 10000;
    const message = `New Order from ${userData.email || 'Customer'}\n` +
        `Package Name: ${packageDetails.name || 'Custom Package'}\n` +
        `Items:\n${itemDetails}\n` +
        `Subtotal: ₦${subtotal.toFixed(2)}\n` +
        `Packaging Fee: ₦10000.00\n` +
        `Total: ₦${finalTotal.toFixed(2)}\n` +
        `Budget: ${packageDetails.budget ? `₦${packageDetails.budget.toFixed(2)}` : 'Not specified'}\n` +
        `Please confirm payment details.`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappNumber = '+2349122834983';
    return `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
}

document.getElementById('package-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    packageDetails.name = document.getElementById('package-name').value;
    let enteredBudget = parseFloat(document.getElementById('package-budget').value) || null;
    
    if (enteredBudget) {
        if (enteredBudget < 10000) {
            alert('Budget must be at least ₦10000 to cover the packaging fee.');
            return;
        }
        packageDetails.budget = enteredBudget;
        packageDetails.effectiveBudget = enteredBudget - 10000;
        alert(`₦10,000 has been allocated for standard packaging. Your balance is ₦${packageDetails.effectiveBudget.toFixed(2)}. If a larger box is needed, we’ll confirm with you via WhatsApp. Happy curating!`);
    } else {
        packageDetails.budget = null;
        packageDetails.effectiveBudget = null;
        alert(`A standard packaging fee of ₦10,000 has been added to your total. If a larger box is required, we’ll confirm with you via WhatsApp. Happy curating!`);
    }
    document.getElementById('package-form-section').classList.add('hidden');
    document.getElementById('categories-section').classList.remove('hidden');
    document.getElementById('selected-items').classList.remove('hidden');
    document.getElementById('add-to-cart').classList.remove('hidden');
    document.getElementById('total-shortcut').classList.remove('hidden');
    loadCategories();
});

document.querySelector('.back-button')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('categories-section').classList.remove('hidden');
    document.getElementById('category-header').classList.add('hidden');
    document.getElementById('items-section').classList.add('hidden');
    document.getElementById('selected-items').classList.remove('hidden');
    document.getElementById('add-to-cart').classList.remove('hidden');
    document.getElementById('total-shortcut').classList.remove('hidden');
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
    const finalTotal = totalPrice + 10000; // Include packaging fee
    if (packageDetails.budget && totalPrice > packageDetails.effectiveBudget) {
        alert(`Total price (₦${totalPrice.toFixed(2)}) exceeds your effective budget of ₦${packageDetails.effectiveBudget.toFixed(2)}!`);
        return;
    }
    
    const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, name, price, quantifiable')
        .in('id', selectedItems.map(si => String(si.id)));
    if (itemsError) {
        console.error('Error fetching items for WhatsApp:', itemsError.message);
        alert('Error preparing order: ' + itemsError.message);
        return;
    }
    
    // Insert cart with username
    console.log('Inserting cart for username:', userData.email);
    const { data: cartData, error: cartError } = await supabase.from('cart').insert({
        user_id: userData.id,
        username: userData.email,
        package_name: packageDetails.name,
        budget: packageDetails.budget,
        items: selectedItems,
        curated_items: [],
        total_price: finalTotal,
    }).select('id').single();
    if (cartError) {
        console.error('Error adding to cart:', cartError.message);
        alert('Error adding to cart: ' + cartError.message);
        return;
    }
    
    console.log('Cart inserted with ID:', cartData.id);
    const whatsappUrl = await generateWhatsAppMessage(userData, items, selectedItems, totalPrice);
    window.open(whatsappUrl, '_blank');
    
    alert('Order added to cart! WhatsApp message opened for order confirmation.');
    selectedItems = [];
    packageDetails = {};
    renderSelectedItems();
    await updateTotalPrice();
    document.getElementById('package-form-section').classList.remove('hidden');
    document.getElementById('categories-section').classList.add('hidden');
    document.getElementById('category-header').classList.add('hidden');
    document.getElementById('items-section').classList.add('hidden');
    document.getElementById('selected-items').classList.add('hidden');
    document.getElementById('add-to-cart').classList.add('hidden');
    document.getElementById('total-shortcut').classList.add('hidden');
    document.getElementById('package-form').reset();
});

document.getElementById('total-shortcut')?.addEventListener('click', () => {
    const selectedItemsSection = document.getElementById('selected-items');
    selectedItemsSection.scrollIntoView({ behavior: 'smooth' });
});

document.addEventListener('DOMContentLoaded', async () => {
    const userData = await checkAuth();
    if (!userData) {
        alert('You must be logged in to access this page.');
        window.location.href = 'index.html';
        return;
    }
    
    document.getElementById('category-header').classList.add('hidden');
    document.getElementById('categories-section').classList.add('hidden');
    document.getElementById('items-section').classList.add('hidden');
    document.getElementById('selected-items').classList.add('hidden');
    document.getElementById('add-to-cart').classList.add('hidden');
    document.getElementById('total-shortcut').classList.add('hidden');
    
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);
});
