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
            }
            const file = new File([blob], `${currentFileInput}.png`, { type: 'image/png' });
            croppedFile = file;
            console.log('Cropped image ready:', file.name);
            resolve(file);
        }, 'image/png');
    });
}

async function loadCategories() {
    const { data: categories, error } = await supabase.from('custom_categories').select('id, name').order('name', { ascending: true });
    if (error) {
        console.error('Error loading categories:', error.message);
        alert('Error loading categories: ' + error.message);
        return;
    }
    
    const itemCategorySelect = document.getElementById('item-category');
    itemCategorySelect.innerHTML = '<option value="" disabled selected>Select a category</option>' + 
        categories.map(category => `<option value="${category.id}">${category.name}</option>`).join('');
}

async function loadCuratedCategories() {
    const { data: curatedCategories, error } = await supabase.from('curated_categories').select('id, name').order('name', { ascending: true });
    if (error) {
        console.error('Error loading curated categories:', error.message);
        alert('Error loading curated categories: ' + error.message);
        return;
    }
    
    const curatedItemCategorySelect = document.getElementById('curated-item-category');
    curatedItemCategorySelect.innerHTML = '<option value="" disabled selected>Select a curated category</option>' + 
        curatedCategories.map(category => `<option value="${category.id}">${category.name}</option>`).join('');
}

async function loadCustomItems() {
    const { data: items, error } = await supabase.from('items').select('id, name, price, description, image, category_id').order('name', { ascending: true });
    if (error) {
        console.error('Error loading custom items:', error.message);
        alert('Error loading custom items: ' + error.message);
        return;
    }
    
    const itemsList = document.getElementById('custom-items-list');
    itemsList.innerHTML = items.map(item => `
        <div class="admin-item" data-id="${item.id}">
            ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
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
                    <button type="submit">Update Item</button>
                    <button type="button" class="delete-button" onclick="deleteItem(${item.id}, 'items')">Delete Item</button>
                </div>
            </form>
        </div>
    `).join('');
}

async function loadCuratedItems() {
    const { data: curatedItems, error } = await supabase.from('curated_items').select('id, name, price, description, image, category_id').order('name', { ascending: true });
    if (error) {
        console.error('Error loading curated items:', error.message);
        alert('Error loading curated items: ' + error.message);
        return;
    }
    
    const curatedItemsList = document.getElementById('curated-items-list');
    curatedItemsList.innerHTML = curatedItems.map(item => `
        <div class="admin-item" data-id="${item.id}">
            ${item.image ? `<img src="${item.image}" alt="${item.name}">` : ''}
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
                    <button type="submit">Update Item</button>
                    <button type="button" class="delete-button" onclick="deleteItem(${item.id}, 'curated_items')">Delete Item</button>
                </div>
            </form>
        </div>
    `).join('');
}

async function deleteItem(itemId, table) {
    if (!confirm('Are you sure you want to delete this item?')) return;
    
    const { error } = await supabase.from(table).delete().eq('id', itemId);
    if (error) {
        console.error(`Error deleting item from ${table}:`, error.message);
        alert(`Error deleting item: ${error.message}`);
    } else {
        alert('Item deleted successfully!');
        if (table === 'items') {
            loadCustomItems();
        } else {
            loadCuratedItems();
        }
    }
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
        loadCategories();
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

document.getElementById('view-custom-items')?.addEventListener('click', () => {
    const itemsList = document.getElementById('custom-items-list');
    itemsList.classList.toggle('hidden');
    if (!itemsList.classList.contains('hidden')) {
        loadCustomItems();
    }
});

document.getElementById('view-curated-items')?.addEventListener('click', () => {
    const curatedItemsList = document.getElementById('curated-items-list');
    curatedItemsList.classList.toggle('hidden');
    if (!curatedItemsList.classList.contains('hidden')) {
        loadCuratedItems();
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const userData = await checkAuth();
    if (!userData || userData.role !== 'admin') {
        alert('Access denied. Admins only.');
        window.location.href = 'index.html';
        return;
    }
    
    loadCategories();
    loadCuratedCategories();

    const fileInputs = [
        'category-image',
        'curated-category-image',
        'item-image',
        'curated-item-image'
    ].map(id => document.getElementById(id));
    
    fileInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                initCropper(e.target.files[0], e.target.id);
            }
        });
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
    
    const itemsList = document.getElementById('custom-items-list');
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
            
            if (!image && file) {
                alert('Failed to upload image. Please try again.');
                return;
            }
            
            const { error } = await supabase.from('items').update({ name, price, description, image }).eq('id', itemId);
            if (error) {
                console.error('Error updating item:', error.message);
                alert('Error updating item: ' + error.message);
            } else {
                alert('Item updated successfully!');
                croppedFile = null;
                loadCustomItems();
            }
        }
    });
    
    const curatedItemsList = document.getElementById('curated-items-list');
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
            
            if (!image && file) {
                alert('Failed to upload image. Please try again.');
                return;
            }
            
            const { error } = await supabase.from('curated_items').update({ name, price, description, image }).eq('id', itemId);
            if (error) {
                console.error('Error updating curated item:', error.message);
                alert('Error updating curated item: ' + error.message);
            } else {
                alert('Curated item updated successfully!');
                croppedFile = null;
                loadCuratedItems();
            }
        }
    });
    
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    document.body.classList.toggle('dark-mode', isDarkMode);
});

window.deleteItem = deleteItem;
