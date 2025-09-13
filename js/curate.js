import { supabase } from './supabase.js';
import { checkAuth } from './auth.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

let selectedItems = [];
let currentCategoryId = null;
let packageDetails = {};
let isEditing = false;
let editingCurationId = null;

async function loadCategories() {
    const categoriesList = document.getElementById('categories-grid');
    if (!categoriesList) {
        console.error('Error: Element with ID "categories-grid" not found.');
        await Swal.fire({
            title: "Error",
            text: "Categories grid element not found. Please check the HTML structure.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    const { data: categories, error } = await supabase
        .from('custom_categories')
        .select('id, name, image')
        .order('name', { ascending: true });
    
    if (error) {
        console.error('Error loading custom categories:', error.message);
        await Swal.fire({
            title: "Error",
            text: `Error loading categories: ${error.message}`,
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        categoriesList.innerHTML = '<p>Failed to load categories. Please try again later.</p>';
        return;
    }

    console.log('Fetched custom categories:', categories);

    if (categories.length === 0) {
        categoriesList.innerHTML = '<p>No categories available.</p>';
        console.warn('No custom categories found in the database.');
        return;
    }

    categoriesList.innerHTML = categories.map(category => `
        <div class="category" data-id="${category.id}">
            ${category.image ? `<img src="${category.image}" alt="${category.name}" loading="lazy">` : '<p>No image</p>'}
            <h3>${category.name}</h3>
        </div>
    `).join('');

    document.querySelectorAll('.category').forEach(category => {
        category.addEventListener('click', () => {
            currentCategoryId = category.dataset.id;
            loadItems(category.dataset.id);
            showSection('items-section');
            const categoryName = category.querySelector('h3').textContent;
            const categoryImage = category.querySelector('img')?.src || '';
            document.getElementById('category-name').textContent = categoryName;
            document.getElementById('category-image').src = categoryImage;
            document.getElementById('category-image').style.display = categoryImage ? 'block' : 'none';
            document.getElementById('category-header').classList.remove('hidden');
            document.getElementById('selected-items').classList.remove('hidden');
        });
    });
}

async function loadItems(categoryId) {
    const itemsList = document.getElementById('items-grid');
    if (!itemsList) {
        console.error('Error: Element with ID "items-grid" not found.');
        await Swal.fire({
            title: "Error",
            text: "Items grid element not found.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    const { data: items, error } = await supabase
        .from('items')
        .select('id, name, price, description, image, quantifiable')
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

    console.log('Fetched items for category', categoryId, ':', items);

    if (items.length === 0) {
        itemsList.innerHTML = '<p>No items available in this category.</p>';
        console.warn('No items found for category:', categoryId);
        return;
    }

    itemsList.innerHTML = items.map(item => `
        <div class="item" data-id="${item.id}">
            ${item.image ? `<img src="${item.image}" alt="${item.name}" class="item-image" loading="lazy">` : '<p>No image</p>'}
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
                <input type="checkbox" class="item-checkbox" data-id="${item.id}" ${selectedItems.some(si => String(si.id) === String(item.id)) ? 'checked' : ''}>
            `}
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

    itemsList.querySelectorAll('.item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', async () => {
            const itemId = checkbox.dataset.id;
            const item = await getItemDetails(itemId);
            if (!item) {
                checkbox.checked = false;
                await Swal.fire({
                    title: "Error",
                    text: "Error fetching item details.",
                    icon: "error",
                    confirmButtonColor: "#FFD700"
                });
                return;
            }
            if (checkbox.checked) {
                const canAdd = await checkBudgetBeforeAdd(item, 1);
                if (!canAdd) {
                    checkbox.checked = false;
                    await Swal.fire({
                        title: "Budget Exceeded",
                        text: `Adding ${item.name} would exceed your budget of ₦${packageDetails.effectiveBudget.toFixed(2)}!`,
                        icon: "warning",
                        confirmButtonColor: "#FFD700"
                    });
                    return;
                }
                if (!selectedItems.some(si => String(si.id) === String(itemId))) {
                    selectedItems.push({ id: itemId, quantity: 1 });
                }
            } else {
                selectedItems = selectedItems.filter(si => String(si.id) !== String(itemId));
            }
            localStorage.setItem('selectedItems', JSON.stringify(selectedItems));
            await renderSelectedItems();
            await updateTotalPrice();
        });
    });

    itemsList.querySelectorAll('.quantity-increment').forEach(button => {
        button.addEventListener('click', async () => {
            const itemId = button.dataset.id;
            const item = await getItemDetails(itemId);
            if (!item) {
                await Swal.fire({
                    title: "Error",
                    text: "Error fetching item details.",
                    icon: "error",
                    confirmButtonColor: "#FFD700"
                });
                return;
            }
            const existingItem = selectedItems.find(si => String(si.id) === String(itemId));
            const newQuantity = existingItem ? existingItem.quantity + 1 : 1;
            const canAdd = await checkBudgetBeforeAdd(item, newQuantity);
            if (!canAdd) {
                await Swal.fire({
                    title: "Budget Exceeded",
                    text: `Increasing quantity of ${item.name} would exceed your budget of ₦${packageDetails.effectiveBudget.toFixed(2)}!`,
                    icon: "warning",
                    confirmButtonColor: "#FFD700"
                });
                return;
            }
            if (existingItem) {
                existingItem.quantity = newQuantity;
            } else {
                selectedItems.push({ id: itemId, quantity: 1 });
            }
            localStorage.setItem('selectedItems', JSON.stringify(selectedItems));
            button.parentElement.querySelector('.quantity-display').textContent = getItemQuantity(itemId);
            await renderSelectedItems();
            await updateTotalPrice();
        });
    });

    itemsList.querySelectorAll('.quantity-decrement').forEach(button => {
        button.addEventListener('click', async () => {
            const itemId = button.dataset.id;
            const item = selectedItems.find(si => String(si.id) === String(itemId));
            if (item && item.quantity > 1) {
                item.quantity -= 1;
            } else {
                selectedItems = selectedItems.filter(si => String(si.id) !== String(itemId));
            }
            localStorage.setItem('selectedItems', JSON.stringify(selectedItems));
            button.parentElement.querySelector('.quantity-display').textContent = getItemQuantity(itemId);
            await renderSelectedItems();
            await updateTotalPrice();
        });
    });

    await renderSelectedItems();
    await updateTotalPrice();
}

async function getItemDetails(itemId) {
    const { data: item, error } = await supabase
        .from('items')
        .select('id, name, price, quantifiable, description, image')
        .eq('id', itemId)
        .single();
    
    if (error) {
        console.error('Error fetching item details:', error.message);
        return null;
    }
    return item;
}

async function checkBudgetBeforeAdd(item, quantity) {
    if (!packageDetails.effectiveBudget) return true;
    const currentTotal = await calculateTotalPrice();
    const existingItem = selectedItems.find(si => String(si.id) === String(item.id));
    const currentContribution = existingItem ? Number(item.price) * existingItem.quantity : 0;
    const newContribution = Number(item.price) * quantity;
    const newTotal = Number((currentTotal - currentContribution + newContribution).toFixed(2));
    console.log('Check Budget: currentTotal=', currentTotal, 'currentContribution=', currentContribution, 'newContribution=', newContribution, 'newTotal=', newTotal, 'effectiveBudget=', packageDetails.effectiveBudget);
    return newTotal <= packageDetails.effectiveBudget;
}

function getItemQuantity(itemId) {
    const item = selectedItems.find(si => String(si.id) === String(itemId));
    return item ? item.quantity : 0;
}

async function renderSelectedItems() {
    const selectedItemsList = document.getElementById('selected-items-list');
    if (!selectedItemsList) {
        console.error('Error: Element with ID "selected-items-list" not found.');
        await Swal.fire({
            title: "Error",
            text: "Selected items list element not found.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    if (selectedItems.length === 0) {
        selectedItemsList.innerHTML = '<li>No items selected.</li>';
        document.getElementById('save-curation').classList.add('hidden');
        document.getElementById('add-to-cart').classList.add('hidden');
        return;
    }

    const { data: items, error } = await supabase
        .from('items')
        .select('id, name, price, image, quantifiable')
        .in('id', selectedItems.map(si => String(si.id)));
    if (error) {
        console.error('Error loading selected items:', error.message);
        await Swal.fire({
            title: "Error",
            text: `Error loading selected items: ${error.message}`,
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    console.log('Selected items:', selectedItems, 'Fetched items:', items);

    selectedItemsList.innerHTML = items.map(item => {
        const selectedItem = selectedItems.find(si => String(si.id) === String(item.id));
        const quantity = selectedItem ? selectedItem.quantity : 0;
        return `
            <li class="selected-item" data-id="${item.id}">
                ${item.image ? `<img src="${item.image}" alt="${item.name}">` : '<p>No image</p>'}
                <div>
                    <h3>${item.name} ${item.quantifiable ? `(x${quantity})` : ''}</h3>
                    <p>₦${(Number(item.price) * quantity).toFixed(2)}</p>
                    <button class="remove-item" data-id="${item.id}">Remove</button>
                </div>
            </li>
        `;
    }).join('');

    document.getElementById('save-curation').classList.remove('hidden');
    document.getElementById('add-to-cart').classList.remove('hidden');

    document.querySelectorAll('.remove-item').forEach(button => {
        button.removeEventListener('click', handleRemoveItem);
        button.addEventListener('click', handleRemoveItem);
    });
}

function handleRemoveItem(event) {
    const itemId = event.target.dataset.id;
    selectedItems = selectedItems.filter(si => String(si.id) !== String(itemId));
    localStorage.setItem('selectedItems', JSON.stringify(selectedItems));
    if (currentCategoryId) {
        loadItems(currentCategoryId);
    }
    renderSelectedItems();
    updateTotalPrice();
}

async function calculateTotalPrice() {
    if (selectedItems.length === 0) return 0;

    const { data: items, error } = await supabase
        .from('items')
        .select('id, price')
        .in('id', selectedItems.map(si => String(si.id)));
    if (error) {
        console.error('Error calculating total price:', error.message);
        await Swal.fire({
            title: "Error",
            text: `Error calculating total price: ${error.message}`,
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return 0;
    }

    const total = selectedItems.reduce((sum, si) => {
        const item = items.find(i => String(i.id) === String(si.id));
        const price = item ? Number(item.price) : 0;
        return Number((sum + (price * si.quantity)).toFixed(2));
    }, 0);

    return total;
}

async function updateTotalPrice() {
    const totalPrice = await calculateTotalPrice();
    const totalPriceElement = document.getElementById('total-price');
    const totalShortcut = document.getElementById('shortcut-total');
    if (totalPriceElement && totalShortcut) {
        const finalTotal = totalPrice + 10000;
        const totalText = `₦${finalTotal.toFixed(2)}`;
        totalPriceElement.textContent = `Total: ${totalText}`;
        totalShortcut.textContent = totalText;
        adjustTotalShortcutSize(totalText);
    }
    return totalPrice;
}

function adjustTotalShortcutSize(totalText) {
    const totalShortcut = document.getElementById('total-shortcut');
    if (!totalShortcut) return;
    const textLength = totalText.length;
    const baseWidth = 100;
    const baseHeight = 40;
    const widthIncrement = 8;
    const maxWidth = 160;
    const newWidth = Math.min(baseWidth + (textLength - 5) * widthIncrement, maxWidth);
    totalShortcut.style.width = `${newWidth}px`;
    totalShortcut.style.height = `${baseHeight}px`;
    totalShortcut.style.fontSize = `${baseHeight / 2.5}px`;
}

async function generateWhatsAppMessage(userData, items, cartItems, subtotal, referralCode) {
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
        `${referralCode ? `Referral Code: ${referralCode}\n` : ''}` +
        `Please confirm payment details.`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappNumber = '+2349122834983';
    return `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
}

async function saveCuration() {
    if (!packageDetails.name || selectedItems.length === 0) {
        console.warn('Cannot save curation: Missing package name or no items selected.');
        await Swal.fire({
            title: "Error",
            text: "Please provide a package name and select at least one item.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    const curations = JSON.parse(localStorage.getItem('curations') || '[]');
    const existingCurationIndex = curations.findIndex(c => c.packageDetails.name === packageDetails.name);
    
    const curation = {
        id: isEditing && editingCurationId ? editingCurationId : (existingCurationIndex !== -1 ? curations[existingCurationIndex].id : `curation-${Date.now()}`),
        packageDetails,
        selectedItems,
        createdAt: new Date().toISOString()
    };

    if (existingCurationIndex !== -1) {
        curations[existingCurationIndex] = curation;
        console.log(`Updated curation for package: ${packageDetails.name}`);
    } else {
        curations.push(curation);
        console.log(`Created new curation for package: ${packageDetails.name}`);
    }

    localStorage.setItem('curations', JSON.stringify(curations));
    localStorage.removeItem('selectedItems');
}

function resetCuration() {
    selectedItems = [];
    packageDetails = {};
    isEditing = false;
    editingCurationId = null;
    document.getElementById('package-form')?.reset();
    document.getElementById('selected-items-list').innerHTML = '';
    document.getElementById('total-price').textContent = 'Total: ₦0.00';
    document.getElementById('shortcut-total').textContent = '₦0.00';
    const referralInput = document.getElementById('referral-code-selected');
    if (referralInput) referralInput.value = '';
    localStorage.removeItem('selectedItems');
}

async function addToCart() {
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
        window.location.href = 'login.html';
        return;
    }

    const totalPrice = await updateTotalPrice();
    const finalTotal = totalPrice + 10000;
    if (packageDetails.budget && totalPrice > packageDetails.effectiveBudget) {
        await Swal.fire({
            title: "Budget Exceeded",
            text: `Total price (₦${totalPrice.toFixed(2)}) exceeds your effective budget of ₦${packageDetails.effectiveBudget.toFixed(2)}!`,
            icon: "warning",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    await saveCuration();

    const urlParams = new URLSearchParams(window.location.search);
    let referralCode = urlParams.get('ref') || document.getElementById('referral-code-selected')?.value?.trim() || document.getElementById('referral-code')?.value?.trim();
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
        .from('items')
        .select('id, name, price, quantifiable')
        .in('id', selectedItems.map(si => String(si.id)));
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
        username: userData.email,
        package_name: packageDetails.name,
        budget: packageDetails.budget,
        items: selectedItems,
        curated_items: [],
        total_price: finalTotal,
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
        const commission = finalTotal * 0.1;
        const { error: referralError } = await supabase.from('referrals').insert({
            affiliate_id: affiliateId,
            customer_email: userData.email,
            purchase_id: cartData.id,
            referral_code,
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

    const whatsappUrl = await generateWhatsAppMessage(userData, items, selectedItems, totalPrice, referralCode);
    window.open(whatsappUrl, '_blank');

    await Swal.fire({
        title: "Success",
        text: "Order added to cart! WhatsApp message opened for order confirmation.",
        icon: "success",
        confirmButtonColor: "#FFD700"
    });

    if (isEditing) {
        const curations = JSON.parse(localStorage.getItem('curations') || '[]');
        const updatedCurations = curations.filter(c => c.id !== editingCurationId);
        localStorage.setItem('curations', JSON.stringify(updatedCurations));
    }

    resetCuration();
    showSection('package-form-section');
}

function showSection(sectionId) {
    const sections = ['package-form-section', 'categories-section', 'items-section', 'category-header', 'selected-items'];
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (section) {
            section.classList.add('hidden');
            console.log(`Hiding section: ${id}`);
        }
    });
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        console.log(`Showing section: ${sectionId}`);
    } else {
        console.error(`Error: Section with ID "${sectionId}" not found.`);
        Swal.fire({
            title: "Error",
            text: `Section "${sectionId}" not found in the page.`,
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
    }

    const saveCurationButton = document.getElementById('save-curation');
    const addToCartButton = document.getElementById('add-to-cart');
    const totalShortcut = document.getElementById('total-shortcut');

    if (sectionId === 'categories-section' || sectionId === 'items-section') {
        document.getElementById('selected-items').classList.remove('hidden');
        saveCurationButton?.classList.remove('hidden');
        addToCartButton?.classList.remove('hidden');
        totalShortcut?.classList.remove('hidden');
    } else {
        document.getElementById('selected-items').classList.add('hidden');
        saveCurationButton?.classList.add('hidden');
        addToCartButton?.classList.add('hidden');
        totalShortcut?.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const userData = await checkAuth();
    if (!userData) {
        await Swal.fire({
            title: "Error",
            text: "You must be logged in to access this page.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        window.location.href = 'login.html';
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
                window.location.href = 'login.html';
            });
        }
    });

    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    const curationId = urlParams.get('curationId');
    if (referralCode) {
        const referralInput = document.getElementById('referral-code');
        const referralInputSelected = document.getElementById('referral-code-selected');
        if (referralInput) {
            referralInput.value = referralCode;
        }
        if (referralInputSelected) {
            referralInputSelected.value = referralCode;
        }
        console.log('Applied referral code from URL:', referralCode);
    }

    if (curationId) {
        const curations = JSON.parse(localStorage.getItem('curations') || '[]');
        const curation = curations.find(c => c.id === curationId);
        if (curation) {
            isEditing = true;
            editingCurationId = curationId;
            packageDetails = { ...curation.packageDetails };
            selectedItems = [...curation.selectedItems];
            document.getElementById('package-name').value = packageDetails.name || '';
            document.getElementById('package-budget').value = packageDetails.budget || '';
            if (packageDetails.referralCode) {
                document.getElementById('referral-code').value = packageDetails.referralCode;
                document.getElementById('referral-code-selected').value = packageDetails.referralCode;
            }
            localStorage.setItem('selectedItems', JSON.stringify(selectedItems));
            showSection('categories-section');
            await renderSelectedItems();
            await updateTotalPrice();
            await loadCategories();
        } else {
            await Swal.fire({
                title: "Error",
                text: "Curation not found.",
                icon: "error",
                confirmButtonColor: "#FFD700"
            });
            window.location.href = 'customer.html';
        }
    } else {
        showSection('package-form-section');
    }

    // Handle package form submission
    document.getElementById('package-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('package-name')?.value;
        const budget = parseFloat(document.getElementById('package-budget')?.value) || null;
        const referralCode = document.getElementById('referral-code')?.value?.trim();
        if (budget && budget < 10000) {
            await Swal.fire({
                title: "Error",
                text: "Budget must be at least ₦10000 to cover the packaging fee.",
                icon: "error",
                confirmButtonColor: "#FFD700"
            });
            return;
        }
        packageDetails = { name, budget, effectiveBudget: budget ? budget - 10000 : null, referralCode };
        if (referralCode) {
            const referralInput = document.getElementById('referral-code-selected');
            if (referralInput) {
                referralInput.value = referralCode;
            }
        }
        await Swal.fire({
            title: "Success",
            text: budget
                ? `₦10,000 has been allocated for standard packaging. Your balance is ₦${packageDetails.effectiveBudget.toFixed(2)}. If a larger box is needed, we’ll confirm with you via WhatsApp. Happy curating!`
                : `A standard packaging fee of ₦10,000 has been added to your total. If a larger box is required, we’ll confirm with you via WhatsApp. Happy curating!`,
            icon: "success",
            confirmButtonColor: "#FFD700"
        });
        console.log('Package form submitted:', packageDetails);
        showSection('categories-section');
        await loadCategories();
    });

    // Handle back buttons
    document.querySelectorAll('.back-button')?.forEach(button => {
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('Back button clicked:', button.dataset.action, button.textContent);
            if (button.dataset.action === 'dashboard' || button.textContent.includes('Dashboard')) {
                if (!document.getElementById('items-section').classList.contains('hidden') && selectedItems.length > 0) {
                    await saveCuration();
                }
                window.location.href = 'customer.html';
            } else if (button.dataset.action === 'package-form' || button.textContent.includes('Package Form')) {
                if (!document.getElementById('items-section').classList.contains('hidden') && selectedItems.length > 0) {
                    await saveCuration();
                }
                showSection('package-form-section');
            } else if (button.dataset.action === 'categories' || button.textContent.includes('Categories')) {
                if (!document.getElementById('items-section').classList.contains('hidden') && selectedItems.length > 0) {
                    await saveCuration();
                }
                showSection('categories-section');
                const itemsSection = document.getElementById('items-section');
                const categoryHeader = document.getElementById('category-header');
                const selectedItemsSection = document.getElementById('selected-items');
                if (itemsSection) itemsSection.classList.add('hidden');
                if (categoryHeader) categoryHeader.classList.add('hidden');
                if (selectedItemsSection) selectedItemsSection.classList.remove('hidden');
            } else {
                console.warn('Unknown back button action:', button.dataset.action, button.textContent);
            }
        });
    });

    // Save on leaving items-section via page exit
    window.addEventListener('beforeunload', async (event) => {
        if (!document.getElementById('items-section').classList.contains('hidden') && selectedItems.length > 0) {
            await saveCuration();
        }
    });

    // Handle save curation
    document.getElementById('save-curation')?.addEventListener('click', async () => {
        await saveCuration();
        await Swal.fire({
            title: "Success",
            text: "Curation saved successfully! Returning to dashboard.",
            icon: "success",
            confirmButtonColor: "#FFD700"
        });
        resetCuration();
        window.location.href = 'customer.html';
    });

    // Handle add to cart
    document.getElementById('add-to-cart')?.addEventListener('click', async () => {
        await addToCart();
    });

    // Handle total shortcut click
    document.getElementById('total-shortcut')?.addEventListener('click', () => {
        if (!currentCategoryId) return;
        loadItems(currentCategoryId);
        showSection('items-section');
        document.getElementById('category-header').classList.remove('hidden');
        document.getElementById('selected-items').classList.remove('hidden');
    });
});
