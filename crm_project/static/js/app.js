const token = localStorage.getItem('crm_token');
if (!token) {
    window.location.href = '/';
}

// API Utility
async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(`/api${endpoint}`, options);
        if (response.status === 401) {
            localStorage.removeItem('crm_token');
            window.location.href = '/';
            return null;
        }
        if (response.status === 204) return true;
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'API Error');
        return data;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

// UI State
let currentUser = null;
let customers = [];
let leads = [];

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    await loadUser();
    setupNavigation();
    setupModals();
    await loadDashboardData();

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('crm_token');
        window.location.href = '/';
    });
});

async function loadUser() {
    try {
        currentUser = await apiCall('/auth/me');
        document.getElementById('user-name').textContent = currentUser.full_name;
    } catch (e) {
        console.error('Failed to load user');
    }
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(nav => nav.classList.remove('active'));
            views.forEach(view => view.classList.add('hidden'));
            
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');

            if (targetId === 'customers-view') renderCustomers();
            if (targetId === 'leads-view') renderLeads();
            if (targetId === 'dashboard-view') updateDashboardStats();
        });
    });
}

async function loadDashboardData() {
    try {
        [customers, leads] = await Promise.all([
            apiCall('/customers'),
            apiCall('/leads')
        ]);
        updateDashboardStats();
    } catch (e) {
        console.error('Failed to load data');
    }
}

function updateDashboardStats() {
    document.getElementById('stat-customers').textContent = customers.length;
    document.getElementById('stat-leads').textContent = leads.length;
    
    const totalValue = leads.reduce((sum, lead) => sum + (lead.estimated_value || 0), 0);
    document.getElementById('stat-value').textContent = `$${totalValue.toLocaleString()}`;
}

// Customers Logic
function renderCustomers() {
    const tbody = document.querySelector('#customers-table tbody');
    tbody.innerHTML = '';
    
    customers.forEach(cust => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cust.company_name}</td>
            <td>${cust.contact_name}</td>
            <td>${cust.email}</td>
            <td>${cust.industry || '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editCustomer(${cust.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${cust.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Leads Logic
function renderLeads() {
    const tbody = document.querySelector('#leads-table tbody');
    tbody.innerHTML = '';
    
    leads.forEach(lead => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${lead.title}</td>
            <td>${lead.contact_name}</td>
            <td><span class="badge badge-${lead.status}">${lead.status.toUpperCase()}</span></td>
            <td>$${(lead.estimated_value || 0).toLocaleString()}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="editLead(${lead.id})"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger" onclick="deleteLead(${lead.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Modal & Form Handling
function showModal(id) {
    document.getElementById(id).classList.add('active');
}

function hideModal(id) {
    document.getElementById(id).classList.remove('active');
    if(id === 'customer-modal') document.getElementById('customer-form').reset();
    if(id === 'lead-modal') document.getElementById('lead-form').reset();
}

function setupModals() {
    // Customer Form
    document.getElementById('customer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('customer-id').value;
        const data = {
            company_name: document.getElementById('cust-company').value,
            contact_name: document.getElementById('cust-contact').value,
            email: document.getElementById('cust-email').value,
            industry: document.getElementById('cust-industry').value
        };

        try {
            if (id) {
                await apiCall(`/customers/${id}`, 'PUT', data);
                showToast('Customer updated successfully');
            } else {
                await apiCall('/customers', 'POST', data);
                showToast('Customer created successfully');
            }
            hideModal('customer-modal');
            await loadDashboardData();
            renderCustomers();
        } catch (e) {}
    });

    // Lead Form
    document.getElementById('lead-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('lead-id').value;
        const data = {
            title: document.getElementById('lead-title').value,
            contact_name: document.getElementById('lead-contact').value,
            email: document.getElementById('lead-email').value,
            status: document.getElementById('lead-status').value,
            estimated_value: parseFloat(document.getElementById('lead-value').value) || 0
        };

        try {
            if (id) {
                await apiCall(`/leads/${id}`, 'PUT', data);
                showToast('Lead updated successfully');
            } else {
                await apiCall('/leads', 'POST', data);
                showToast('Lead created successfully');
            }
            hideModal('lead-modal');
            await loadDashboardData();
            renderLeads();
        } catch (e) {}
    });
}

// Edit/Delete Actions
window.editCustomer = (id) => {
    const cust = customers.find(c => c.id === id);
    if(!cust) return;
    document.getElementById('customer-id').value = cust.id;
    document.getElementById('cust-company').value = cust.company_name;
    document.getElementById('cust-contact').value = cust.contact_name;
    document.getElementById('cust-email').value = cust.email;
    document.getElementById('cust-industry').value = cust.industry || '';
    document.getElementById('customer-modal-title').textContent = 'Edit Customer';
    showModal('customer-modal');
};

window.deleteCustomer = async (id) => {
    if(!confirm('Are you sure you want to delete this customer?')) return;
    try {
        await apiCall(`/customers/${id}`, 'DELETE');
        showToast('Customer deleted');
        await loadDashboardData();
        renderCustomers();
    } catch (e) {}
};

window.editLead = (id) => {
    const lead = leads.find(l => l.id === id);
    if(!lead) return;
    document.getElementById('lead-id').value = lead.id;
    document.getElementById('lead-title').value = lead.title;
    document.getElementById('lead-contact').value = lead.contact_name;
    document.getElementById('lead-email').value = lead.email;
    document.getElementById('lead-status').value = lead.status;
    document.getElementById('lead-value').value = lead.estimated_value || 0;
    document.getElementById('lead-modal-title').textContent = 'Edit Lead';
    showModal('lead-modal');
};

window.deleteLead = async (id) => {
    if(!confirm('Are you sure you want to delete this lead?')) return;
    try {
        await apiCall(`/leads/${id}`, 'DELETE');
        showToast('Lead deleted');
        await loadDashboardData();
        renderLeads();
    } catch (e) {}
};

// Toast Notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
