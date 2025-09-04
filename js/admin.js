import { supabase } from './supabase.js';
import { checkAuth } from './auth.js';

let cropper;
let currentFileInput;
let croppedFile;

async function uploadImage(file) {
    if (!file) {
        console.log('No file provided for upload');
        return null;
    }
    const fileExt = file.name.split('.').pop().toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif'];
    if (!validExtensions.includes(fileExt)) {
        console.error('Invalid file type:', fileExt);
        alert('Please upload a valid image file (jpg, jpeg, png, gif).');
        return null;
    }
    const fileName = `item-images/${Date.now()}.${fileExt}`;
    console.log('Uploading file:', fileName);
    const { error } = await supabase.storage.from('item-images').upload(fileName, file);
    if (error) {
        console.error('Error uploading image:', error.message);
        alert('Error uploading image: ' + error.message);
        return null;
    }
    const { data } = supabase.storage.from('item-images').getPublicUrl(fileName);
    console.log('Uploaded image URL:', data.publicUrl);
    return data.publicUrl;
}

function initCropper(file, inputId) {
    if (!file) {
        console.error('No file selected for cropping');
        alert('Please select an image to crop.');
        return;
    }
    const modal = document.getElementById('cropper-modal');
    const image = document.getElementById('cropper-image');
    if (!modal || !image) {
        console.error('Cropper modal or image element not found');
        alert('Error: Cropper interface not loaded properly.');
        return;
    }
    const aspectRatio = inputId.includes('category') ? 1 : 4 / 3;
    currentFileInput = inputId;

    const reader = new FileReader();
    reader.onload = (e) => {
        image.src = e.target.result;
        modal.classList.add('active');
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        try {
            cropper = new Cropper(image, {
                aspectRatio,
                viewMode: 1,
                autoCropArea: 0.8,
                responsive: true,
                crop(event) {
                    console.log('Cropper coordinates:', event.detail);
                },
            });
            console.log('Cropper initialized for:', inputId);
        } catch (err) {
            console.error('Error initializing Cropper:', err);
            alert('Error initializing image cropper.');
            modal.classList.remove('active');
        }
    };
    reader.onerror = (err) => {
        console.error('Error reading file:', err);
        alert('Error reading image file.');
    };
    reader.readAsDataURL(file);
}

async function saveCroppedImage() {
    if (!cropper) {
        console.error('Cropper not initialized');
        alert('Error: Cropper not initialized.');
        return null;
    }
    const canvas = cropper.getCroppedCanvas();
    if (!canvas) {
        console.error('Failed to get cropped canvas');
        alert('Error: Could not crop image.');
        return null;
    }
    return new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
            if (!blob) {
                console.error('Failed to create blob from canvas');
                alert('Error: Could not process cropped image.');
                resolve(null);
                return;
            }
            const file = new File([blob], `${currentFileInput}.png`, { type: 'image/png' });
            croppedFile = file;
            console.log('Cropped image ready:', file.name);
            resolve(file);
        }, 'image/png');
    });
}

async function loadCustomCategories() {
    const { data: categories, error } = await supabase.from('custom_categories').select('id, name, image').order('name', { ascending: true });
    if (error) {
        console.error('Error loading custom categories:', error.message);
        alert('Error loading custom categories: ' + error.message);
        return;
    }

    const itemCategorySelect = document.getElementById('item-category');
    if (itemCategorySelect) {
        itemCategorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>' +
            categories.map(category => `<option value="${category.id}">${category.name}</option>`).join('');
    }

    const categoriesList = document.getElementById('custom-categories-list');
    if (categoriesList) {
        categoriesList.innerHTML = categories.map(category => `
            <div class="admin-category" data-id="${category.id}">
                ${category.image ? `<img src="${category.image}" alt="${category.name}">` : '<p>No image</p>'}
                <form class="edit-category-form" data-id="${category.id}">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" value="${category.name}" required>
                    </div>
                    <div class="form-group">
                        <label>Image</label>
                        <input type="file" accept="image/*" data-current-image="${category.image || ''}">
                    </div>
                    <div class="form-group">
                        <button type="submit">Update Category</button>
                        <button type="button" class="delete-button" onclick="deleteCategory(${category.id}, 'custom_categories')">Delete Category</button>
                    </div>
                </form>
            </div>
        `).join('');
    }
}

async function loadCuratedCategories() {
    const { data: curatedCategories, error } = await supabase.from('curated_categories').select('id, name, image').order('name', { ascending: true });
    if (error) {
        console.error('Error loading curated categories:', error.message);
        alert('Error loading curated categories: ' + error.message);
        return;
    }

    const curatedItemCategorySelect = document.getElementById('curated-item-category');
    if (curatedItemCategorySelect) {
        curatedItemCategorySelect.innerHTML = '<option value="" disabled selected>Select a curated category</option>' +
            curatedCategories.map(category => `<option value="${category.id}">${category.name}</option>`).join('');
    }

    const curatedCategoriesList = document.getElementById('curated-categories-list');
    if (curatedCategoriesList) {
        curatedCategoriesList.innerHTML = curatedCategories.map(category => `
            <div class="admin-category" data-id="${category.id}">
                ${category.image ? `<img src="${category.image}" alt="${category.name}">` : '<p>No image</p>'}
                <form class="edit-curated-category-form" data-id="${category.id}">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" value="${category.name}" required>
                    </div>
                    <div class="form-group">
                        <label>Image</label>
                        <input type="file" accept="image/*" data-current-image="${category.image || ''}">
                    </div>
                    <div class="form-group">
                        <button type="submit">Update Category</button>
                        <button type="button" class="delete-button" onclick="deleteCategory(${category.id}, 'curated_categories')">Delete Category</button>
                    </div>
                </form>
            </div>
        `).join('');
    }
}

async function loadCustomItems() {
    const { data: items, error } = await supabase.from('items').select('id, name, price, description, image, category_id, quantifiable').order('name', { ascending: true });
    if (error) {
        console.error('Error loading custom items:', error.message);
        alert('Error loading custom items: ' + error.message);
        return;
    }

    const itemsList = document.getElementById('custom-items-list');
    if (itemsList) {
        itemsList.innerHTML = items.map(item => `
            <div class="admin-item" data-id="${item.id}">
                ${item.image ? `<img src="${item.image}" alt="${item.name}">` : '<p>No image</p>'}
                <form class="edit-item-form" data-id="${item.id}">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" value="${item.name}" required>
                    </div>
                    <div class="form-group">
                        <label>Price (₦)</label>
                        <input type="number" value="${item.price}" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea>${item.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Image</label>
                        <input type="file" accept="image/*" data-current-image="${item.image || ''}">
                    </div>
                    <div class="form-group">
                        <label>Quantifiable</label>
                        <input type="checkbox" ${item.quantifiable ? 'checked' : ''}>
                    </div>
                    <div class="form-group">
                        <button type="submit">Update Item</button>
                        <button type="button" class="delete-button" onclick="deleteItem(${item.id}, 'items')">Delete Item</button>
                    </div>
                </form>
            </div>
        `).join('');
    }
}

async function loadCuratedItems() {
    const { data: curatedItems, error } = await supabase.from('curated_items').select('id, name, price, description, image, category_id, quantifiable').order('name', { ascending: true });
    if (error) {
        console.error('Error loading curated items:', error.message);
        alert('Error loading curated items: ' + error.message);
        return;
    }

    const curatedItemsList = document.getElementById('curated-items-list');
    if (curatedItemsList) {
        curatedItemsList.innerHTML = curatedItems.map(item => `
            <div class="admin-item" data-id="${item.id}">
                ${item.image ? `<img src="${item.image}" alt="${item.name}">` : '<p>No image</p>'}
                <form class="edit-curated-item-form" data-id="${item.id}">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" value="${item.name}" required>
                    </div>
                    <div class="form-group">
                        <label>Price (₦)</label>
                        <input type="number" value="${item.price}" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea>${item.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Image</label>
                        <input type="file" accept="image/*" data-current-image="${item.image || ''}">
                    </div>
                    <div class="form-group">
                        <label>Quantifiable</label>
                        <input type="checkbox" ${item.quantifiable ? 'checked' : ''}>
                    </div>
                    <div class="form-group">
                        <button type="submit">Update Item</button>
                        <button type="button" class="delete-button" onclick="deleteItem(${item.id}, 'curated_items')">Delete Item</button>
                    </div>
                </form>
            </div>
        `).join('');
    }
}

async function searchItemsAndCategories(query) {
    query = query.trim().toLowerCase();
    const resultsList = document.getElementById('search-results-list');
    if (!resultsList) return;

    resultsList.innerHTML = '';

    if (!query) {
        document.getElementById('search-results').classList.add('hidden');
        return;
    }

    // Search custom categories
    const { data: customCategories, error: customCatError } = await supabase
        .from('custom_categories')
        .select('id, name, image')
        .ilike('name', `%${query}%`);
    if (customCatError) {
        console.error('Error searching custom categories:', customCatError.message);
        alert('Error searching custom categories: ' + customCatError.message);
    }

    // Search curated categories
    const { data: curatedCategories, error: curatedCatError } = await supabase
        .from('curated_categories')
        .select('id, name, image')
        .ilike('name', `%${query}%`);
    if (curatedCatError) {
        console.error('Error searching curated categories:', curatedCatError.message);
        alert('Error searching curated categories: ' + curatedCatError.message);
    }

    // Search custom items
    const isNumeric = !isNaN(parseFloat(query));
    const customItemsQuery = supabase.from('items').select('id, name, price, description, image, category_id, quantifiable');
    if (isNumeric) {
        customItemsQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%,price.eq.${parseFloat(query)}`);
    } else {
        customItemsQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    }
    const { data: customItems, error: customItemError } = await customItemsQuery;
    if (customItemError) {
        console.error('Error searching custom items:', customItemError.message);
        alert('Error searching custom items: ' + customItemError.message);
    }

    // Search curated items
    const curatedItemsQuery = supabase.from('curated_items').select('id, name, price, description, image, category_id, quantifiable');
    if (isNumeric) {
        curatedItemsQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%,price.eq.${parseFloat(query)}`);
    } else {
        curatedItemsQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    }
    const { data: curatedItems, error: curatedItemError } = await curatedItemsQuery;
    if (curatedItemError) {
        console.error('Error searching curated items:', curatedItemError.message);
        alert('Error searching curated items: ' + curatedItemError.message);
    }

    // Combine and display results
    let resultsHTML = '';

    if (customCategories?.length) {
        resultsHTML += '<h3>Custom Categories</h3>';
        resultsHTML += customCategories.map(category => `
            <div class="admin-category" data-id="${category.id}">
                ${category.image ? `<img src="${category.image}" alt="${category.name}">` : '<p>No image</p>'}
                <form class="edit-category-form" data-id="${category.id}">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" value="${category.name}" required>
                    </div>
                    <div class="form-group">
                        <label>Image</label>
                        <input type="file" accept="image/*" data-current-image="${category.image || ''}">
                    </div>
                    <div class="form-group">
                        <button type="submit">Update Category</button>
                        <button type="button" class="delete-button" onclick="deleteCategory(${category.id}, 'custom_categories')">Delete Category</button>
                    </div>
                </form>
            </div>
        `).join('');
    }

    if (curatedCategories?.length) {
        resultsHTML += '<h3>Curated Categories</h3>';
        resultsHTML += curatedCategories.map(category => `
            <div class="admin-category" data-id="${category.id}">
                ${category.image ? `<img src="${category.image}" alt="${category.name}">` : '<p>No image</p>'}
                <form class="edit-curated-category-form" data-id="${category.id}">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" value="${category.name}" required>
                    </div>
                    <div class="form-group">
                        <label>Image</label>
                        <input type="file" accept="image/*" data-current-image="${category.image || ''}">
                    </div>
                    <div class="form-group">
                        <button type="submit">Update Category</button>
                        <button type="button" class="delete-button" onclick="deleteCategory(${category.id}, 'curated_categories')">Delete Category</button>
                    </div>
                </form>
            </div>
        `).join('');
    }

    if (customItems?.length) {
        resultsHTML += '<h3>Custom Items</h3>';
        resultsHTML += customItems.map(item => `
            <div class="admin-item" data-id="${item.id}">
                ${item.image ? `<img src="${item.image}" alt="${item.name}">` : '<p>No image</p>'}
                <form class="edit-item-form" data-id="${item.id}">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" value="${item.name}" required>
                    </div>
                    <div class="form-group">
                        <label>Price (₦)</label>
                        <input type="number" value="${item.price}" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea>${item.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Image</label>
                        <input type="file" accept="image/*" data-current-image="${item.image || ''}">
                    </div>
                    <div class="form-group">
                        <label>Quantifiable</label>
                        <input type="checkbox" ${item.quantifiable ? 'checked' : ''}>
                    </div>
                    <div class="form-group">
                        <button type="submit">Update Item</button>
                        <button type="button" class="delete-button" onclick="deleteItem(${item.id}, 'items')">Delete Item</button>
                    </div>
                </form>
            </div>
        `).join('');
    }

    if (curatedItems?.length) {
        resultsHTML += '<h3>Curated Items</h3>';
        resultsHTML += curatedItems.map(item => `
            <div class="admin-item" data-id="${item.id}">
                ${item.image ? `<img src="${item.image}" alt="${item.name}">` : '<p>No image</p>'}
                <form class="edit-curated-item-form" data-id="${item.id}">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" value="${item.name}" required>
                    </div>
                    <div class="form-group">
                        <label>Price (₦)</label>
                        <input type="number" value="${item.price}" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea>${item.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Image</label>
                        <input type="file" accept="image/*" data-current-image="${item.image || ''}">
                    </div>
                    <div class="form-group">
                        <label>Quantifiable</label>
                        <input type="checkbox" ${item.quantifiable ? 'checked' : ''}>
                    </div>
                    <div class="form-group">
                        <button type="submit">Update Item</button>
                        <button type="button" class="delete-button" onclick="deleteItem(${item.id}, 'curated_items')">Delete Item</button>
                    </div>
                </form>
            </div>
        `).join('');
    }

    if (!customCategories?.length && !curatedCategories?.length && !customItems?.length && !curatedItems?.length) {
        resultsHTML = '<p>No results found.</p>';
    }

    resultsList.innerHTML = resultsHTML;
    document.getElementById('search-results').classList.remove('hidden');
    showSection('search-results');
}

async function deleteCategory(categoryId, table) {
    if (!confirm('Are you sure you want to delete this category?')) return;

    const { error } = await supabase.from(table).delete().eq('id', categoryId);
    if (error) {
        console.error(`Error deleting category from ${table}:`, error.message);
        alert(`Error deleting category: ${error.message}`);
    } else {
        alert('Category deleted successfully!');
        const searchInput = document.getElementById('search-input');
        if (searchInput.value) {
            searchItemsAndCategories(searchInput.value);
        } else if (table === 'custom_categories') {
            loadCustomCategories();
        } else {
            loadCuratedCategories();
        }
    }
}

async function deleteItem(itemId, table) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    const { error } = await supabase.from(table).delete().eq('id', itemId);
    if (error) {
        console.error(`Error deleting item from ${table}:`, error.message);
        alert(`Error deleting item: ${error.message}`);
    } else {
        alert('Item deleted successfully!');
        const searchInput = document.getElementById('search-input');
        if (searchInput.value) {
            searchItemsAndCategories(searchInput.value);
        } else if (table === 'items') {
            loadCustomItems();
        } else {
            loadCuratedItems();
        }
    }
}

function showSection(sectionId) {
    const sections = [
        'search-results',
        'manage-categories',
        'manage-curated-categories',
        'manage-items',
        'manage-curated-items'
    ];
    sections.forEach(id => {
        const section = document.getElementById(id);
        section.classList.add('hidden');
    });
    const targetSection = document.getElementById(sectionId);
    targetSection.classList.remove('hidden');
    if (sectionId === 'manage-categories') loadCustomCategories();
    if (sectionId === 'manage-curated-categories') loadCuratedCategories();
    if (sectionId === 'manage-items') loadCustomItems();
    if (sectionId === 'manage-curated-items') loadCuratedItems();
}

document.getElementById('category-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('category-name').value;
    const file = croppedFile || document.getElementById('category-image').files[0];
    const image = file ? await uploadImage(file) : null;

    if (!image && file) {
        alert('Failed to upload image. Please try again.');
        return;
    }

    const { error } = await supabase.from('custom_categories').insert({ name, image });
    if (error) {
        console.error('Error adding category:', error.message);
        alert('Error adding category: ' + error.message);
    } else {
        alert('Category added successfully!');
        document.getElementById('category-form').reset();
        croppedFile = null;
        loadCustomCategories();
    }
});

document.getElementById('curated-category-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('curated-category-name').value;
    const file = croppedFile || document.getElementById('curated-category-image').files[0];
    const image = file ? await uploadImage(file) : null;

    if (!image && file) {
        alert('Failed to upload image. Please try again.');
        return;
    }

    const { error } = await supabase.from('curated_categories').insert({ name, image });
    if (error) {
        console.error('Error adding curated category:', error.message);
        alert('Error adding curated category: ' + error.message);
    } else {
        alert('Curated category added successfully!');
        document.getElementById('curated-category-form').reset();
        croppedFile = null;
        loadCuratedCategories();
    }
});

document.getElementById('item-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const category_id = document.getElementById('item-category').value;
    const name = document.getElementById('item-name').value;
    const price = parseFloat(document.getElementById('item-price').value);
    const description = document.getElementById('item-description').value || null;
    const quantifiable = document.getElementById('item-quantifiable').checked;
    const file = croppedFile || document.getElementById('item-image').files[0];
    const image = file ? await uploadImage(file) : null;

    if (!image && file) {
        alert('Failed to upload image. Please try again.');
        return;
    }

    const { error } = await supabase.from('items').insert({ category_id, name, price, description, image, quantifiable });
    if (error) {
        console.error('Error adding item:', error.message);
        alert('Error adding item: ' + error.message);
    } else {
        alert('Item added successfully!');
        document.getElementById('item-form').reset();
        croppedFile = null;
        loadCustomItems();
    }
});

document.getElementById('curated-item-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const category_id = document.getElementById('curated-item-category').value;
    const name = document.getElementById('curated-item-name').value;
    const price = parseFloat(document.getElementById('curated-item-price').value);
    const description = document.getElementById('curated-item-description').value || null;
    const quantifiable = document.getElementById('curated-item-quantifiable').checked;
    const file = croppedFile || document.getElementById('curated-item-image').files[0];
    const image = file ? await uploadImage(file) : null;

    if (!image && file) {
        alert('Failed to upload image. Please try again.');
        return;
    }

    const { error } = await supabase.from('curated_items').insert({ category_id, name, price, description, image, quantifiable });
    if (error) {
        console.error('Error adding curated item:', error.message);
        alert('Error adding curated item: ' + error.message);
    } else {
        alert('Curated item added successfully!');
        document.getElementById('curated-item-form').reset();
        croppedFile = null;
        loadCuratedItems();
    }
});

document.getElementById('search-input')?.addEventListener('input', (e) => {
    searchItemsAndCategories(e.target.value);
});

document.getElementById('view-custom-categories')?.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('manage-categories');
    document.getElementById('hamburger-menu').classList.remove('active');
    document.getElementById('search-input').classList.add('hidden');
});

document.getElementById('view-curated-categories')?.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('manage-curated-categories');
    document.getElementById('hamburger-menu').classList.remove('active');
    document.getElementById('search-input').classList.add('hidden');
});

document.getElementById('view-custom-items')?.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('manage-items');
    document.getElementById('hamburger-menu').classList.remove('active');
    document.getElementById('search-input').classList.add('hidden');
});

document.getElementById('view-curated-items')?.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('manage-curated-items');
    document.getElementById('hamburger-menu').classList.remove('active');
    document.getElementById('search-input').classList.add('hidden');
});

document.addEventListener('DOMContentLoaded', async () => {
    const userData = await checkAuth();
    if (!userData || userData.role !== 'admin') {
        alert('Access denied. Admins only.');
        window.location.href = 'index.html';
        return;
    }

    loadCustomCategories();
    loadCuratedCategories();

    const fileInputs = [
        'category-image',
        'curated-category-image',
        'item-image',
        'curated-item-image'
    ].map(id => document.getElementById(id));

    fileInputs.forEach(input => {
        if (input) {
            input.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    initCropper(e.target.files[0], e.target.id);
                }
            });
        }
    });

    document.getElementById('cropper-save')?.addEventListener('click', async () => {
        const file = await saveCroppedImage();
        if (file) {
            croppedFile = file;
            document.getElementById('cropper-modal').classList.remove('active');
            if (cropper) {
                cropper.destroy();
                cropper = null;
            }
        }
    });

    document.getElementById('cropper-cancel')?.addEventListener('click', () => {
        croppedFile = null;
        document.getElementById(currentFileInput).value = '';
        document.getElementById('cropper-modal').classList.remove('active');
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
    });

    const categoriesList = document.getElementById('custom-categories-list');
    if (categoriesList) {
        categoriesList.addEventListener('submit', async (e) => {
            if (e.target.classList.contains('edit-category-form')) {
                e.preventDefault();
                const categoryId = e.target.dataset.id;
                const inputs = e.target.querySelectorAll('input');
                const name = inputs[0].value;
                const file = croppedFile || inputs[1].files[0];
                const image = file ? await uploadImage(file) : inputs[1].dataset.currentImage || null;

                if (!image && file) {
                    alert('Failed to upload image. Please try again.');
                    return;
                }

                const { error } = await supabase.from('custom_categories').update({ name, image }).eq('id', categoryId);
                if (error) {
                    console.error('Error updating category:', error.message);
                    alert('Error updating category: ' + error.message);
                } else {
                    alert('Category updated successfully!');
                    croppedFile = null;
                    loadCustomCategories();
                    const searchInput = document.getElementById('search-input');
                    if (searchInput.value) searchItemsAndCategories(searchInput.value);
                }
            }
        });
    }

    const curatedCategoriesList = document.getElementById('curated-categories-list');
    if (curatedCategoriesList) {
        curatedCategoriesList.addEventListener('submit', async (e) => {
            if (e.target.classList.contains('edit-curated-category-form')) {
                e.preventDefault();
                const categoryId = e.target.dataset.id;
                const inputs = e.target.querySelectorAll('input');
                const name = inputs[0].value;
                const file = croppedFile || inputs[1].files[0];
                const image = file ? await uploadImage(file) : inputs[1].dataset.currentImage || null;

                if (!image && file) {
                    alert('Failed to upload image. Please try again.');
                    return;
                }

                const { error } = await supabase.from('curated_categories').update({ name, image }).eq('id', categoryId);
                if (error) {
                    console.error('Error updating curated category:', error.message);
                    alert('Error updating curated category: ' + error.message);
                } else {
                    alert('Curated category updated successfully!');
                    croppedFile = null;
                    loadCuratedCategories();
                    const searchInput = document.getElementById('search-input');
                    if (searchInput.value) searchItemsAndCategories(searchInput.value);
                }
            }
        });
    }

    const itemsList = document.getElementById('custom-items-list');
    if (itemsList) {
        itemsList.addEventListener('submit', async (e) => {
            if (e.target.classList.contains('edit-item-form')) {
                e.preventDefault();
                const itemId = e.target.dataset.id;
                const inputs = e.target.querySelectorAll('input, textarea');
                const name = inputs[0].value;
                const price = parseFloat(inputs[1].value);
                const description = inputs[2].value || null;
                const file = croppedFile || inputs[3].files[0];
                const image = file ? await uploadImage(file) : inputs[3].dataset.currentImage || null;
                const quantifiable = inputs[4].checked;

                if (!image && file) {
                    alert('Failed to upload image. Please try again.');
                    return;
                }

                const { error } = await supabase.from('items').update({ name, price, description, image, quantifiable }).eq('id', itemId);
                if (error) {
                    console.error('Error updating item:', error.message);
                    alert('Error updating item: ' + error.message);
                } else {
                    alert('Item updated successfully!');
                    croppedFile = null;
                    loadCustomItems();
                    const searchInput = document.getElementById('search-input');
                    if (searchInput.value) searchItemsAndCategories(searchInput.value);
                }
            }
        });
    }

    const curatedItemsList = document.getElementById('curated-items-list');
    if (curatedItemsList) {
        curatedItemsList.addEventListener('submit', async (e) => {
            if (e.target.classList.contains('edit-curated-item-form')) {
                e.preventDefault();
                const itemId = e.target.dataset.id;
                const inputs = e.target.querySelectorAll('input, textarea');
                const name = inputs[0].value;
                const price = parseFloat(inputs[1].value);
                const description = inputs[2].value || null;
                const file = croppedFile || inputs[3].files[0];
                const image = file ? await uploadImage(file) : inputs[3].dataset.currentImage || null;
                const quantifiable = inputs[4].checked;

                if (!image && file) {
                    alert('Failed to upload image. Please try again.');
                    return;
                }

                const { error } = await supabase.from('curated_items').update({ name, price, description, image, quantifiable }).eq('id', itemId);
                if (error) {
                    console.error('Error updating curated item:', error.message);
                    alert('Error updating curated item: ' + error.message);
                } else {
                    alert('Curated item updated successfully!');
                    croppedFile = null;
                    loadCuratedItems();
                    const searchInput = document.getElementById('search-input');
                    if (searchInput.value) searchItemsAndCategories(searchInput.value);
                }
            }
        });
    }

    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);
});

window.deleteCategory = deleteCategory;
window.deleteItem = deleteItem;
