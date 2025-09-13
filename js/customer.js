import { supabase } from './supabase.js';
import { checkAuth } from './auth.js';
import Swal from 'https://cdn.jsdelivr.net/npm/sweetalert2@11/+esm';

// Typing animation function
function typeWelcomeMessage(element, text, speed = 100) {
    element.textContent = '';
    element.classList.add('typing');
    let i = 0;
    const typing = setInterval(() => {
        if (i < text.length) {
            element.textContent += text[i];
            i++;
        } else {
            clearInterval(typing);
            element.classList.remove('typing');
            element.classList.add('typing-complete');
        }
    }, speed);
}

async function loadUserInfo() {
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
    if (userData.role !== 'user') {
        await Swal.fire({
            title: "Access Denied",
            text: "This page is for users only.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        window.location.href = 'login.html'; // Updated redirect
        return;
    }
    
    let attempts = 0;
    const maxAttempts = 3;
    let username = null;
    let error = null;
    
    while (attempts < maxAttempts) {
        const { data, error: fetchError } = await supabase
            .from('users')
            .select('username')
            .eq('id', userData.id)
            .single();
        if (fetchError) {
            error = fetchError;
            console.error(`Attempt ${attempts + 1} failed: ${fetchError.message}`);
            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
        }
        username = data.username;
        break;
    }
    
    const welcomeMessage = document.getElementById('welcome-message');
    if (error && !username) {
        console.error('Error fetching username:', error.message);
        typeWelcomeMessage(welcomeMessage, 'Hello, User');
    } else {
        typeWelcomeMessage(welcomeMessage, `Hello, ${username || 'User'}`);
    }

    await loadPackagesInProgress();
}

async function loadPackagesInProgress() {
    const packagesList = document.getElementById('packages-in-progress-list');
    if (!packagesList) {
        console.error('Error: Element with ID "packages-in-progress-list" not found in DOM.');
        await Swal.fire({
            title: "Error",
            text: "Packages list element not found.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    const curationsRaw = localStorage.getItem('curations');
    console.log('Raw curations from localStorage:', curationsRaw);
    let curations = [];
    try {
        curations = curationsRaw ? JSON.parse(curationsRaw) : [];
        console.log('Parsed curations:', curations);
    } catch (e) {
        console.error('Error parsing curations from localStorage:', e.message);
        packagesList.innerHTML = '<p class="error-message">Error loading packages. Please try again.</p>';
        await Swal.fire({
            title: "Error",
            text: "Error parsing package data.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    if (!Array.isArray(curations) || curations.length === 0) {
        console.log('No curations found or curations is not an array.');
        packagesList.innerHTML = '<p class="no-packages">No packages in progress.</p>';
        return;
    }

    try {
        packagesList.innerHTML = await Promise.all(curations.map(async (curation, index) => {
            console.log(`Processing curation ${index}:`, curation);
            if (!curation || !curation.selectedItems || !curation.packageDetails || !curation.createdAt) {
                console.warn(`Invalid curation at index ${index}:`, curation);
                return '';
            }

            const items = await Promise.all(curation.selectedItems.map(async (si, itemIndex) => {
                console.log(`Fetching item ${itemIndex} with ID ${si.id}`);
                const { data: item, error } = await supabase
                    .from('items')
                    .select('id, name, price, quantifiable')
                    .eq('id', si.id)
                    .single();
                if (error) {
                    console.error(`Error fetching item ${si.id}:`, error.message);
                    return null;
                }
                return { ...item, quantity: si.quantity || 1 };
            })).then(items => items.filter(item => item !== null));

            console.log(`Items for curation ${index}:`, items);

            const totalPrice = items.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0) + 10000;
            const itemList = items.map(item => `<li>${item.name} ${item.quantifiable ? `(x${item.quantity})` : ''}</li>`).join('');

            return `
                <div class="curation" data-id="${curation.id}" style="animation-delay: ${index * 0.2}s">
                    <h3>${curation.packageDetails.name || 'Unnamed Package'}</h3>
                    <div class="curation-items">
                        <span>Items:</span>
                        <ul>${itemList || '<li>No items</li>'}</ul>
                    </div>
                    <p class="curation-total">Total: ₦${totalPrice.toFixed(2)}</p>
                    <p class="curation-created">Created: ${new Date(curation.createdAt).toLocaleDateString()}</p>
                    <div class="curation-actions">
                        <button class="edit-curation" data-id="${curation.id}">Edit</button>
                        <button class="add-to-cart-curation" data-id="${curation.id}">Add to Cart</button>
                        <button class="delete-curation" data-id="${curation.id}">Delete</button>
                    </div>
                </div>
            `;
        })).then(htmlArray => htmlArray.filter(html => html !== '').join(''));

        if (!packagesList.innerHTML) {
            console.log('No valid curations to display after processing.');
            packagesList.innerHTML = '<p class="no-packages">No valid packages in progress.</p>';
        }

        // Attach event listeners
        document.querySelectorAll('.edit-curation').forEach(button => {
            button.addEventListener('click', () => {
                console.log(`Edit button clicked for curation ID: ${button.dataset.id}`);
                window.location.href = `curate.html?curationId=${button.dataset.id}`;
            });
        });

        document.querySelectorAll('.add-to-cart-curation').forEach(button => {
            button.addEventListener('click', () => {
                console.log(`Add to cart button clicked for curation ID: ${button.dataset.id}`);
                addCurationToCart(button.dataset.id);
            });
        });

        document.querySelectorAll('.delete-curation').forEach(button => {
            button.addEventListener('click', () => {
                console.log(`Delete button clicked for curation ID: ${button.dataset.id}`);
                deleteCuration(button.dataset.id);
            });
        });
    } catch (error) {
        console.error('Error in loadPackagesInProgress:', error.message);
        packagesList.innerHTML = '<p class="error-message">Error loading packages. Please try again.</p>';
        await Swal.fire({
            title: "Error",
            text: `Error loading packages: ${error.message}`,
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
    }
}

async function addCurationToCart(curationId) {
    const curations = JSON.parse(localStorage.getItem('curations') || '[]');
    const curation = curations.find(c => c.id === curationId);
    if (!curation) {
        console.error('Curation not found:', curationId);
        await Swal.fire({
            title: "Error",
            text: "Curation not found.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    const userData = await checkAuth();
    if (!userData) {
        console.error('No user data for adding to cart.');
        await Swal.fire({
            title: "Error",
            text: "You must be logged in to add to cart.",
            icon: "error",
            confirmButtonColor: "#FFD700"
        });
        window.location.href = 'login.html'; // Updated redirect
        return;
    }

    const totalPrice = await Promise.all(curation.selectedItems.map(async si => {
        const item = await getItemDetails(si.id);
        return item ? item.price * (si.quantity || 1) : 0;
    })).then(prices => prices.reduce((sum, price) => sum + price, 0));
    const finalTotal = totalPrice + 10000;

    if (curation.packageDetails.budget && totalPrice > (curation.packageDetails.effectiveBudget || curation.packageDetails.budget - 10000)) {
        console.warn('Budget exceeded for curation:', curationId);
        await Swal.fire({
            title: "Budget Exceeded",
            text: `Total price (₦${totalPrice.toFixed(2)}) exceeds your effective budget of ₦${(curation.packageDetails.effectiveBudget || curation.packageDetails.budget - 10000).toFixed(2)}!`,
            icon: "warning",
            confirmButtonColor: "#FFD700"
        });
        return;
    }

    const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('id, name, price, quantifiable')
        .in('id', curation.selectedItems.map(si => String(si.id)));
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

    let referralCode = curation.packageDetails.referralCode || null;
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

    const { data: cartData, error: cartError } = await supabase.from('cart').insert({
        user_id: userData.id,
        username: userData.email,
        package_name: curation.packageDetails.name,
        budget: curation.packageDetails.budget,
        items: curation.selectedItems,
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

    const whatsappUrl = await generateWhatsAppMessage(userData, items, curation.selectedItems, totalPrice, referralCode);
    window.open(whatsappUrl, '_blank');

    const result = await Swal.fire({
        title: "Success",
        text: "Order added to cart! WhatsApp message opened for order confirmation. Remove this package from Packages in Progress?",
        icon: "success",
        showCancelButton: true,
        confirmButtonColor: "#FFD700",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, remove it"
    });

    if (result.isConfirmed) {
        const updatedCurations = curations.filter(c => c.id !== curationId);
        localStorage.setItem('curations', JSON.stringify(updatedCurations));
        await loadPackagesInProgress();
    }
}

async function deleteCuration(curationId) {
    const result = await Swal.fire({
        title: "Are you sure?",
        text: "Do you want to delete this package?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#FFD700",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, delete it!"
    });

    if (!result.isConfirmed) return;

    const curations = JSON.parse(localStorage.getItem('curations') || '[]');
    const updatedCurations = curations.filter(c => c.id !== curationId);
    localStorage.setItem('curations', JSON.stringify(updatedCurations));
    await Swal.fire({
        title: "Success",
        text: "Package deleted successfully!",
        icon: "success",
        confirmButtonColor: "#FFD700"
    });
    await loadPackagesInProgress();
}

async function getItemDetails(itemId) {
    const { data: item, error } = await supabase
        .from('items')
        .select('id, name, price, quantifiable')
        .eq('id', itemId)
        .single();
    
    if (error) {
        console.error('Error fetching item details:', error.message);
        return null;
    }
    return item;
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
        `Package Name: ${cartItems[0]?.packageDetails?.name || 'Custom Package'}\n` +
        `Items:\n${itemDetails}\n` +
        `Subtotal: ₦${subtotal.toFixed(2)}\n` +
        `Packaging Fee: ₦10000.00\n` +
        `Total: ₦${finalTotal.toFixed(2)}\n` +
        `Budget: ${cartItems[0]?.packageDetails?.budget ? `₦${cartItems[0].packageDetails.budget.toFixed(2)}` : 'Not specified'}\n` +
        `${referralCode ? `Referral Code: ${referralCode}\n` : ''}` +
        `Please confirm payment details.`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappNumber = '+2349122834983';
    return `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
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

    supabase
        .channel('users')
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'users',
                filter: `id=eq.${userData.id}`
            },
            payload => {
                const newUsername = payload.new.username || 'User';
                const welcomeMessage = document.getElementById('welcome-message');
                typeWelcomeMessage(welcomeMessage, `Hello, ${newUsername}`);
                console.log('Username updated:', newUsername);
            }
        )
        .subscribe();

    await loadUserInfo();
});
