document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('token')) {
        window.location.href = '/';
        return;
    }
    loadCustomers();
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '/';
});

async function loadCustomers() {
    try {
        const customers = await fetchAPI('/customers/');
        const list = document.getElementById('customer-list');
        list.innerHTML = '';
        
        if (customers.length === 0) {
            list.innerHTML = '<li class="px-4 py-4 sm:px-6 text-gray-500 text-center">No customers found. Add one to get started!</li>';
            return;
        }

        customers.forEach(c => {
            const statusColor = c.status === 'Active' ? 'bg-green-100 text-green-800' : 
                              c.status === 'Lead' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800';
            
            list.innerHTML += `
                <li class="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <div class="flex items-center justify-between">
                        <div class="flex flex-col">
                            <p class="text-sm font-medium text-blue-600 truncate">${c.first_name} ${c.last_name}</p>
                            <p class="text-sm text-gray-500">${c.email} | ${c.company || 'No Company'}</p>
                        </div>
                        <div class="flex items-center space-x-4">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${c.status}</span>
                            <button onclick="editCustomer(${c.id})" class="text-indigo-600 hover:text-indigo-900 text-sm">Edit</button>
                            <button onclick="deleteCustomer(${c.id})" class="text-red-600 hover:text-red-900 text-sm">Delete</button>
                        </div>
                    </div>
                </li>
            `;
        });
    } catch (err) {
        console.error('Failed to load customers:', err);
    }
}

function openModal() {
    document.getElementById('customer-modal').classList.remove('hidden');
    document.getElementById('customer-form').reset();
    document.getElementById('customer-id').value = '';
    document.getElementById('modal-title').textContent = 'Add Customer';
}

function closeModal() {
    document.getElementById('customer-modal').classList.add('hidden');
}

async function editCustomer(id) {
    try {
        const customer = await fetchAPI(`/customers/${id}`);
        document.getElementById('customer-id').value = customer.id;
        document.getElementById('first-name').value = customer.first_name;
        document.getElementById('last-name').value = customer.last_name;
        document.getElementById('customer-email').value = customer.email;
        document.getElementById('phone').value = customer.phone || '';
        document.getElementById('company').value = customer.company || '';
        document.getElementById('status').value = customer.status;
        
        document.getElementById('modal-title').textContent = 'Edit Customer';
        document.getElementById('customer-modal').classList.remove('hidden');
    } catch (err) {
        alert('Failed to load customer details');
    }
}

async function deleteCustomer(id) {
    if (confirm('Are you sure you want to delete this customer?')) {
        try {
            await fetchAPI(`/customers/${id}`, { method: 'DELETE' });
            loadCustomers();
        } catch (err) {
            alert('Failed to delete customer');
        }
    }
}

document.getElementById('customer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('customer-id').value;
    const payload = {
        first_name: document.getElementById('first-name').value,
        last_name: document.getElementById('last-name').value,
        email: document.getElementById('customer-email').value,
        phone: document.getElementById('phone').value,
        company: document.getElementById('company').value,
        status: document.getElementById('status').value
    };

    try {
        if (id) {
            await fetchAPI(`/customers/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            await fetchAPI('/customers/', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }
        closeModal();
        loadCustomers();
    } catch (err) {
        alert(err.message);
    }
});
