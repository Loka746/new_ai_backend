/**
 * Main Application Logic for CRM Dashboard
 * Handles CRUD operations, UI rendering, pagination, and modals
 */

// Global State
const state = {
    currentView: 'dashboard',
    customers: { items: [], total: 0, skip: 0, limit: 10, search: '' },
    deals: { items: [], total: 0, skip: 0, limit: 10, search: '', status: '' },
    interactions: { items: [], total: 0, skip: 0, limit: 20 }
};

// DOM Elements
const elements = {
    views: document.querySelectorAll('.view-section'),
    menuItems: document.querySelectorAll('.menu-item'),
    userNameDisplay: document.getElementById('user-name-display'),
    userAvatarDisplay: document.getElementById('user-avatar-display'),
    logoutBtn: document.getElementById('logout-btn')
};

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Guard check is handled in auth.js
    const user = getUserData();
    if (user) {
        elements.userNameDisplay.textContent = user.full_name;
        elements.userAvatarDisplay.textContent = user.full_name.charAt(0).toUpperCase();
    }

    // Setup Event Listeners
    setupNavigation();
    setupModals();
    setupForms();
    setupSearchAndFilters();

    // Load initial data
    await loadDashboardStats();
});

// --- Navigation --- 
function setupNavigation() {
    elements.menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Remove active class from all
            elements.menuItems.forEach(i => i.classList.remove('active'));
            // Add active to clicked
            e.currentTarget.classList.add('active');
            
            const view = e.currentTarget.dataset.view;
            if (view) switchView(view);
        });
    });

    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', logout);
    }
}

function switchView(viewName) {
    state.currentView = viewName;
    elements.views.forEach(view => {
        view.classList.add('d-none');
        if (view.id === `${viewName}-view`) {
            view.classList.remove('d-none');
        }
    });

    // Load data based on view
    if (viewName === 'dashboard') loadDashboardStats();
    if (viewName === 'customers') loadCustomers();
    if (viewName === 'deals') loadDeals();
}

// --- API Fetch Wrapper ---
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
    };
    
    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        if (response.status === 401) {
            logout();
            return;
        }
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'API request failed');
        }
        return response.status !== 204 ? await response.json() : null;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

// --- Dashboard Logic ---
async function loadDashboardStats() {
    try {
        const stats = await apiCall('/stats');
        document.getElementById('stat-total-customers').textContent = stats.total_customers;
        document.getElementById('stat-total-deals').textContent = stats.total_deals;
        document.getElementById('stat-deals-won').textContent = stats.deals_won;
        document.getElementById('stat-revenue').textContent = `$${stats.total_revenue.toLocaleString()}`;
        
        renderRecentActivity(stats.recent_customers, stats.recent_deals);
    } catch (e) {
        console.error("Failed to load stats", e);
    }
}

function renderRecentActivity(customers, deals) {
    const tbody = document.getElementById('recent-activity-table');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const activities = [
        ...customers.map(c => ({ type: 'Customer Added', name: `${c.first_name} ${c.last_name}`, date: c.created_at })),
        ...deals.map(d => ({ type: 'Deal Created', name: d.title, date: d.created_at }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);

    if (activities.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">No recent activity</td></tr>';
        return;
    }

    activities.forEach(act => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${act.type}</td>
            <td>${act.name}</td>
            <td>${new Date(act.date).toLocaleDateString()}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Customers Logic ---
async function loadCustomers() {
    try {
        const { skip, limit, search } = state.customers;
        let url = `/customers?skip=${skip}&limit=${limit}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        
        const data = await apiCall(url);
        state.customers.items = data.items;
        state.customers.total = data.total;
        
        renderCustomersTable();
        updatePagination('customers');
    } catch (e) {
        console.error("Failed to load customers", e);
    }
}

function renderCustomersTable() {
    const tbody = document.getElementById('customers-table-body');
    tbody.innerHTML = '';
    
    if (state.customers.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No customers found</td></tr>';
        return;
    }

    state.customers.items.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.first_name} ${c.last_name}</td>
            <td>${c.email}</td>
            <td>${c.company || '-'}</td>
            <td>${new Date(c.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="editCustomer(${c.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteCustomer(${c.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteCustomer(id) {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
        await apiCall(`/customers/${id}`, 'DELETE');
        showToast("Customer deleted successfully");
        loadCustomers();
        loadDashboardStats();
    } catch (e) {
        console.error(e);
    }
}

// --- Deals Logic ---
async function loadDeals() {
    try {
        const { skip, limit, search, status } = state.deals;
        let url = `/deals?skip=${skip}&limit=${limit}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (status) url += `&status=${status}`;
        
        const data = await apiCall(url);
        state.deals.items = data.items;
        state.deals.total = data.total;
        
        renderDealsTable();
        updatePagination('deals');
    } catch (e) {
        console.error("Failed to load deals", e);
    }
}

function renderDealsTable() {
    const tbody = document.getElementById('deals-table-body');
    tbody.innerHTML = '';
    
    if (state.deals.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No deals found</td></tr>';
        return;
    }

    state.deals.items.forEach(d => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${d.title}</td>
            <td>$${d.value.toLocaleString()}</td>
            <td><span class="status-badge status-${d.status}">${d.status.toUpperCase()}</span></td>
            <td>${d.expected_close_date ? new Date(d.expected_close_date).toLocaleDateString() : '-'}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="editDeal(${d.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteDeal(${d.id})">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function deleteDeal(id) {
    if (!confirm("Are you sure you want to delete this deal?")) return;
    try {
        await apiCall(`/deals/${id}`, 'DELETE');
        showToast("Deal deleted successfully");
        loadDeals();
        loadDashboardStats();
    } catch (e) {
        console.error(e);
    }
}

// --- Search & Pagination ---
function setupSearchAndFilters() {
    const customerSearch = document.getElementById('customer-search');
    if (customerSearch) {
        customerSearch.addEventListener('input', debounce((e) => {
            state.customers.search = e.target.value;
            state.customers.skip = 0;
            loadCustomers();
        }, 500));
    }

    const dealSearch = document.getElementById('deal-search');
    if (dealSearch) {
        dealSearch.addEventListener('input', debounce((e) => {
            state.deals.search = e.target.value;
            state.deals.skip = 0;
            loadDeals();
        }, 500));
    }
}

function updatePagination(entity) {
    const info = document.getElementById(`${entity}-page-info`);
    if (!info) return;
    const s = state[entity];
    const currentPage = Math.floor(s.skip / s.limit) + 1;
    const totalPages = Math.ceil(s.total / s.limit) || 1;
    info.textContent = `Page ${currentPage} of ${totalPages}`;
}

window.prevPage = function(entity) {
    if (state[entity].skip >= state[entity].limit) {
        state[entity].skip -= state[entity].limit;
        entity === 'customers' ? loadCustomers() : loadDeals();
    }
}

window.nextPage = function(entity) {
    if (state[entity].skip + state[entity].limit < state[entity].total) {
        state[entity].skip += state[entity].limit;
        entity === 'customers' ? loadCustomers() : loadDeals();
    }
}

function debounce(func, timeout = 300){
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// --- Modals & Forms ---
function setupModals() {
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal-overlay').classList.remove('active');
        });
    });
}

window.openModal = function(modalId) {
    document.getElementById(modalId).classList.add('active');
    if (modalId === 'dealModal') {
        populateCustomerDropdown();
    }
}

window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.getElementById(`${modalId.replace('Modal', '')}Form`).reset();
    document.getElementById(`${modalId.replace('Modal', '')}Id`).value = '';
}

function setupForms() {
    const customerForm = document.getElementById('customerForm');
    if (customerForm) {
        customerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('customerId').value;
            const payload = {
                first_name: document.getElementById('c_first_name').value,
                last_name: document.getElementById('c_last_name').value,
                email: document.getElementById('c_email').value,
                company: document.getElementById('c_company').value,
                phone: document.getElementById('c_phone').value
            };
            
            try {
                if (id) {
                    await apiCall(`/customers/${id}`, 'PUT', payload);
                    showToast("Customer updated successfully");
                } else {
                    await apiCall(`/customers`, 'POST', payload);
                    showToast("Customer created successfully");
                }
                closeModal('customerModal');
                loadCustomers();
                loadDashboardStats();
            } catch (err) {}
        });
    }

    const dealForm = document.getElementById('dealForm');
    if (dealForm) {
        dealForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('dealId').value;
            const payload = {
                title: document.getElementById('d_title').value,
                value: parseFloat(document.getElementById('d_value').value),
                status: document.getElementById('d_status').value,
                customer_id: parseInt(document.getElementById('d_customer_id').value)
            };
            
            try {
                if (id) {
                    await apiCall(`/deals/${id}`, 'PUT', payload);
                    showToast("Deal updated successfully");
                } else {
                    await apiCall(`/deals`, 'POST', payload);
                    showToast("Deal created successfully");
                }
                closeModal('dealModal');
                loadDeals();
                loadDashboardStats();
            } catch (err) {}
        });
    }
}

async function populateCustomerDropdown() {
    const select = document.getElementById('d_customer_id');
    select.innerHTML = '<option value="">Select Customer...</option>';
    try {
        const data = await apiCall('/customers?limit=100');
        data.items.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.first_name} ${c.last_name} (${c.company || 'No Company'})`;
            select.appendChild(opt);
        });
    } catch (e) {}
}

window.editCustomer = async function(id) {
    try {
        const c = await apiCall(`/customers/${id}`);
        document.getElementById('customerId').value = c.id;
        document.getElementById('c_first_name').value = c.first_name;
        document.getElementById('c_last_name').value = c.last_name;
        document.getElementById('c_email').value = c.email;
        document.getElementById('c_company').value = c.company || '';
        document.getElementById('c_phone').value = c.phone || '';
        openModal('customerModal');
    } catch (e) {}
}

window.editDeal = async function(id) {
    try {
        await populateCustomerDropdown();
        const d = await apiCall(`/deals/${id}`);
        document.getElementById('dealId').value = d.id;
        document.getElementById('d_title').value = d.title;
        document.getElementById('d_value').value = d.value;
        document.getElementById('d_status').value = d.status;
        document.getElementById('d_customer_id').value = d.customer_id;
        openModal('dealModal');
    } catch (e) {}
}
