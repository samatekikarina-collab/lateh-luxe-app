import { supabase } from './supabase.js';
import { checkAuth } from './auth.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

let selectedItems = [];
let currentCategoryId = null;

async function loadCategories() {
    const grid = document.getElementById('curated-categories-grid');
    if (!grid) {
        console.error('Error: Element with ID "curated-categories-grid" not found.');
        await Swal.fire({
            title: "Error",
            text: "Categories grid element not found. Please check the HTML structure.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    const { data: categories, error } = await supabase
        .from('curated_categories')
        .select('id, name, image')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error loading categories:', error.message);
        await Swal.fire({
            title: "Error",
            text: `Error loading categories: ${error.message}`,
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        grid.innerHTML = '<p>Failed to load categories. Please try again later.</p>';
        return;
    }

    console.log('Fetched curated categories:', categories);

    if (!categories || categories.length === 0) {
        grid.innerHTML = '<p>No curated categories available.</p>';
        console.warn('No curated categories found in the database.');
        return;
    }

    grid.innerHTML = categories.map(category => `
        <div class="category" data-id="${category.id}">
            ${category.image ? `<img src="${category.image}" alt="${category.name}" loading="lazy">` : '<p>No image</p>'}
            <h3>${category.name}</h3>
        </div>
    `).join('');

    grid.querySelectorAll('.category').forEach(category => {
        category.addEventListener('click', () => {
            currentCategoryId = category.dataset.id;
            const categoryName = category.querySelector('h3').textContent;
            const image = category.querySelector('img')?.src || '';
            const categoryImage = document.getElementById('category-image');
            const categoryHeader = document.getElementById('category-header');
            document.getElementById('category-name').textContent = categoryName;
            categoryImage.src = image;
            categoryImage.style.display = image ? 'block' : 'none';
            document.getElementById('categories-section').classList.add('hidden');
            categoryHeader.classList.remove('hidden');
            document.getElementById('items-section').classList.remove('hidden');
            document.getElementById('selected-items').classList.remove('hidden');
            document.getElementById('add-to-cart').classList.remove('hidden');
            document.getElementById('total-shortcut').classList.remove('hidden');
            loadItems(currentCategoryId);
        });
    });
}

async function loadItems(categoryId) {
    const itemsList = document.getElementById('curated-items-list');
    if (!itemsList) {
        console.error('Error: Element with ID "curated-items-list" not found.');
        await Swal.fire({
            title: "Error",
            text: "Items list element not found.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    const { data: items, error } = await supabase
        .from('curated_items')
        .select('id, name, price, description, image')
        .eq('category_id', categoryId)
        .order('name', { ascending: true });

    if (error) {
        console.error('Error loading items:', error.message);
        await Swal.fire({
            title: "Error",
            text: `Error loading items: ${error.message}`,
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        itemsList.innerHTML = '<p>Failed to load items. Please try again later.</p>';
        return;
    }

    console.log('Fetched curated items for category', categoryId, ':', items);

    if (!items || items.length === 0) {
        itemsList.innerHTML = '<p>No items available in this category.</p>';
        console.warn('No items found for category:', categoryId);
        return;
    }

    itemsList.innerHTML = items.map(item => `
        <div class="item" data-id="${item.id}">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" class="item-image" loading="lazy">` : '<p>No image</p>'}
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
    const selectedItemsList = document.getElementById('selected-items-list');
    if (!selectedItemsList) {
        console.error('Error: Element with ID "selected-items-list" not found.');
        return;
    }

    const { data: items, error } = await supabase
        .from('curated_items')
        .select('id, name, price, image')
        .in('id', selectedItems);

    if (error) {
        console.error('Error loading selected items:', error.message);
        await Swal.fire({
            title: "Error",
            text: `Error loading selected items: ${error.message}`,
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        selectedItemsList.innerHTML = '<p>Failed to load selected items.</p>';
        return;
    }

    console.log('Fetched selected items:', items);

    selectedItemsList.innerHTML = items.map(item => `
        <li class="selected-item" data-id="${item.id}">
            ${item.image ? `<img src="${item.image}" alt="${item.name}">` : '<p>No image</p>'}
            <div>
                <h3>${item.name}</h3>
                <p>₦${item.price.toFixed(2)}</p>
            </div>
        </li>
    `).join('');
}

async function updateTotalPrice() {
    const totalPriceElement = document.getElementById('total-price');
    const shortcutTotalElement = document.getElementById('shortcut-total');
    if (!totalPriceElement || !shortcutTotalElement) {
        console.error('Error: Total price or shortcut total element not found.');
        return 0;
    }

    const { data: items, error } = await supabase
        .from('curated_items')
        .select('price')
        .in('id', selectedItems);

    if (error) {
        console.error('Error calculating total price:', error.message);
        await Swal.fire({
            title: "Error",
            text: `Error calculating total price: ${error.message}`,
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        totalPriceElement.textContent = 'Total: ₦0.00';
        shortcutTotalElement.textContent = '₦0.00';
        return 0;
    }

    const total = items.reduce((sum, item) => sum + item.price, 0);
    const totalText = `₦${total.toFixed(2)}`;
    totalPriceElement.textContent = `Total: ${totalText}`;
    shortcutTotalElement.textContent = totalText;
    adjustTotalShortcutSize(totalText);
    return total;
}

function adjustTotalShortcutSize(totalText) {
    const shortcut = document.getElementById('total-shortcut');
    if (!shortcut) {
        console.error('Error: Total shortcut element not found.');
        return;
    }
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

async function generateWhatsAppMessage(userData, items, totalPrice, referralCode) {
    const itemDetails = items.map(item => `- ${item.name}: ₦${item.price.toFixed(2)}`).join('\n');
    const message = `New Order from ${userData.email || 'Customer'}\n` +
        `Curated Box Order\n` +
        `Items:\n${itemDetails}\n` +
        `Total: ₦${totalPrice.toFixed(2)}\n` +
        `${referralCode ? `Referral Code: ${referralCode}\n` : ''}` +
        `Please confirm payment details.`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappNumber = '+2349122834983';
    return `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
}

document.querySelector('.back-button')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('categories-section').classList.remove('hidden');
    document.getElementById('category-header').classList.add('hidden');
    document.getElementById('items-section').classList.add('hidden');
    document.getElementById('selected-items').classList.add('hidden');
    document.getElementById('add-to-cart').classList.add('hidden');
    document.getElementById('total-shortcut').classList.add('hidden');
    currentCategoryId = null;
});

document.getElementById('add-to-cart')?.addEventListener('click', async () => {
    if (selectedItems.length === 0) {
        await Swal.fire({
            title: "Error",
            text: "No items selected!",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    const userData = await checkAuth();
    if (!userData) {
        await Swal.fire({
            title: "Error",
            text: "You must be logged in to add to cart.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        window.location.href = 'login.html'; // Updated redirect
        return;
    }

    const totalPrice = await updateTotalPrice();
    const urlParams = new URLSearchParams(window.location.search);
    let referralCode = urlParams.get('ref') || document.getElementById('referral-code')?.value?.trim();
    let affiliateId = null;

    if (referralCode) {
        const { data: affiliate, error } = await supabase
            .from('affiliates')
            .select('id')
            .eq('referral_code', referralCode)
            .single();
        if (error || !affiliate) {
            console.error('Invalid referral code:', referralCode);
            await Swal.fire({
                title: "Warning",
                text: "Invalid referral code. Proceeding without it.",
                icon: "warning",
                confirmButtonColor: "#FFD700"
            });
            referralCode = null;
        } else {
            affiliateId = affiliate.id;
        }
    }

    const { data: items, error: itemsError } = await supabase
        .from('curated_items')
        .select('id, name, price')
        .in('id', selectedItems);
    if (itemsError) {
        console.error('Error fetching items for WhatsApp:', itemsError.message);
        await Swal.fire({
            title: "Error",
            text: `Error preparing order: ${itemsError.message}`,
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    const { data: cartData, error: cartError } = await supabase.from('cart').insert({
        user_id: userData.id,
        package_name: `Curated Box - ${new Date().toLocaleDateString()}`,
        budget: null,
        items: [],
        curated_items: selectedItems,
        total_price: totalPrice,
        status: 'pending',
        referral_code: referralCode || null
    }).select('id').single();
    if (cartError) {
        console.error('Error adding to cart:', cartError.message);
        await Swal.fire({
            title: "Error",
            text: `Error adding to cart: ${cartError.message}`,
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    if (affiliateId && referralCode) {
        const commission = totalPrice * 0.1;
        const { error: referralError } = await supabase.from('referrals').insert({
            affiliate_id: affiliateId,
            customer_email: userData.email,
            purchase_id: cartData.id,
            referral_code: referralCode,
            commission_earned: commission,
            status: 'pending'
        });
        if (referralError) {
            console.error('Error recording referral:', referralError.message);
            await Swal.fire({
                title: "Error",
                text: "Error recording referral, but order was placed.",
                icon: "error",
                confirmButtonColor: "#FFD700"
            });
        }
    }

    const whatsappUrl = await generateWhatsAppMessage(userData, items, totalPrice, referralCode);
    window.open(whatsappUrl, '_blank');

    await Swal.fire({
        title: "Success",
        text: "Order added to cart! WhatsApp message opened for order confirmation.",
        icon: "success",
        confirmButtonColor: "#FFD700"
    });

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
        await Swal.fire({
            title: "Error",
            text: "You must be logged in to access this page.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        window.location.href = 'login.html'; // Updated redirect
        return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
            Swal.fire({
                title: "Error",
                text: "Session expired. Please log in again.",
                icon: "error",
                confirmButtonColor: "#FFD700"
            }).then(() => {
                window.location.href = 'login.html'; // Updated redirect
            });
        }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    if (referralCode) {
        const referralInput = document.getElementById('referral-code');
        if (referralInput) {
            referralInput.setAttribute('value', referralCode);
            console.log('Applied referral code from URL:', referralCode);
        }
    }

    document.getElementById('category-header').classList.add('hidden');
    document.getElementById('items-section').classList.add('hidden');
    document.getElementById('selected-items').classList.add('hidden');
    document.getElementById('add-to-cart').classList.add('hidden');
    document.getElementById('total-shortcut').classList.add('hidden');
    await loadCategories();
});
