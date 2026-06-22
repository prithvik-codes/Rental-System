/**
 * RentFlow - Single Page Application Engine
 * Handles routing, session management, theme toggle, and API communications.
 */

// ================= GLOBAL STATE =================
const state = {
    token: localStorage.getItem('access_token') || null,
    refreshToken: localStorage.getItem('refresh_token') || null,
    user: JSON.parse(localStorage.getItem('user')) || null,
    currentView: 'view-explore',
    properties: [],
    leases: [],
    activeTab: 'tab-properties'
};

// ================= API WRAPPER =================
const API = {
    baseUrl: window.location.origin,

    // Primary request runner
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        // Inject auth header if token exists
        options.headers = options.headers || {};
        if (state.token) {
            options.headers['Authorization'] = `Bearer ${state.token}`;
        }

        try {
            const response = await fetch(url, options);
            
            // Check for unauthorized state
            if (response.status === 401 && state.token) {
                // Token might be expired. Attempt refresh or logout
                this.logout();
                showToast('Session expired. Please sign in again.', 'warning');
                return null;
            }

            // Handle deleted status which returns no content
            if (response.status === 204 || endpoint.includes('delete')) {
                const text = await response.text();
                return text ? JSON.parse(text) : { success: true };
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || 'Something went wrong');
            }
            return data;
        } catch (error) {
            console.error(`API Error on ${endpoint}:`, error);
            showToast(error.message, 'error');
            throw error;
        }
    },

    // Session helpers
    async login(usernameOrEmail, password) {
        const formData = new URLSearchParams();
        formData.append('username', usernameOrEmail);
        formData.append('password', password);

        try {
            const response = await fetch(`${this.baseUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: formData
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || 'Login failed. Incorrect credentials.');
            }

            state.token = data.access_token;
            state.refreshToken = data.refresh_token;
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);

            // Fetch current user details
            const userDetails = await this.request('/users/me');
            state.user = userDetails;
            localStorage.setItem('user', JSON.stringify(userDetails));

            showToast(`Welcome back, ${state.user.username}!`, 'success');
            setupSessionUI();
            
            // Redirect to appropriate view based on role
            if (state.user.role === 'landlord') {
                switchView('view-dashboard');
            } else {
                switchView('view-explore');
            }
            return true;
        } catch (error) {
            showToast(error.message, 'error');
            return false;
        }
    },

    async signup(username, email, password, role) {
        try {
            const data = await this.request('/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password, role })
            });

            if (data) {
                showToast('Registration successful! Please sign in.', 'success');
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    },

    logout() {
        state.token = null;
        state.refreshToken = null;
        state.user = null;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        
        showToast('You have signed out successfully.', 'info');
        setupSessionUI();
        switchView('view-explore');
    }
};

// ================= THEME MANAGER =================
const ThemeManager = {
    init() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
        this.updateToggleIcon();

        document.getElementById('theme-toggle').addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
            const isDark = document.body.classList.contains('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            this.updateToggleIcon();
        });
    },

    updateToggleIcon() {
        // Lucide icons reload
        if (window.lucide) {
            lucide.createIcons();
        }
    }
};

// ================= TOAST NOTIFICATION SYSTEM =================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';
    if (type === 'warning') iconName = 'alert-circle';

    toast.innerHTML = `
        <i data-lucide="${iconName}" class="toast-icon"></i>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    // Auto remove after animation completes
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// ================= ROUTING & VIEW CONTROLLER =================
function switchView(viewId) {
    // Manage active view sections
    document.querySelectorAll('.view-section').forEach(section => {
        if (section.id === viewId) {
            section.classList.add('active');
            section.classList.remove('hidden');
        } else {
            section.classList.remove('active');
            section.classList.add('hidden');
        }
    });

    // Handle special Hero Section visibility
    const heroSection = document.getElementById('view-hero');
    if (viewId === 'view-explore' && !state.user) {
        heroSection.classList.remove('hidden');
        heroSection.classList.add('active');
    } else {
        heroSection.classList.add('hidden');
        heroSection.classList.remove('active');
    }

    // Manage navbar active state
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('data-target') === viewId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    state.currentView = viewId;
    closeMobileMenu();

    // Trigger specific loaders
    if (viewId === 'view-explore') {
        loadProperties();
    } else if (viewId === 'view-dashboard') {
        loadLandlordDashboard();
    } else if (viewId === 'view-leases') {
        loadTenantLeases();
    }
}

function setupSessionUI() {
    const authActions = document.getElementById('auth-header-actions');
    const userBadge = document.getElementById('user-profile-badge');
    const linkLeases = document.getElementById('link-leases');
    const linkDashboard = document.getElementById('link-dashboard');

    if (state.user) {
        authActions.classList.add('hidden');
        userBadge.classList.remove('hidden');
        
        document.getElementById('display-username').textContent = state.user.username;
        const roleBadge = document.getElementById('display-role');
        roleBadge.textContent = state.user.role;
        roleBadge.className = `badge ${state.user.role === 'landlord' ? 'btn-primary' : 'status-active'}`;

        // Show navigation based on role
        if (state.user.role === 'landlord') {
            linkDashboard.classList.remove('hidden');
            linkLeases.classList.add('hidden');
        } else {
            linkLeases.classList.remove('hidden');
            linkDashboard.classList.add('hidden');
        }
    } else {
        authActions.classList.remove('hidden');
        userBadge.classList.add('hidden');
        linkLeases.classList.add('hidden');
        linkDashboard.classList.add('hidden');
    }
    lucide.createIcons();
}

function closeMobileMenu() {
    const navMenu = document.getElementById('nav-menu');
    navMenu.classList.remove('open');
}

// ================= HELPERS & UTILS =================
function formatCurrency(amount) {
    return '₹' + amount.toLocaleString('en-IN');
}

function getGoogleMapsLink(address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function getPropertyImageUrl(prop) {
    if (prop.image_url) {
        return prop.image_url;
    }
    if (prop.description) {
        const urlMatch = prop.description.match(/(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))/i);
        if (urlMatch) {
            return urlMatch[0];
        }
    }
    // Curated premium house images from Unsplash (the internet)
    const premiumFallbacks = [
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80', // Cozy Studio
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80', // Luxury Penthouse
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80', // Charming Row House
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80'  // Spacious Gated Villa
    ];
    const id = prop.id || 0;
    const index = (id - 1) % premiumFallbacks.length;
    return premiumFallbacks[index < 0 ? 0 : index];
}

// ================= DATA LAYERS & RENDERING =================

// 1. Explore/Properties View
async function loadProperties() {
    const grid = document.getElementById('properties-grid');
    grid.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Scanning spaces...</p>
        </div>
    `;

    try {
        const isAvailableParam = document.getElementById('filter-availability').value;
        const priceParam = document.getElementById('filter-price').value;
        const searchVal = document.getElementById('filter-search').value.toLowerCase();

        let endpoint = '/properties';
        if (isAvailableParam === 'available') {
            endpoint += '?is_available=true';
        } else if (isAvailableParam === 'rented') {
            endpoint += '?is_available=false';
        }

        const data = await API.request(endpoint);
        if (!data) return;

        state.properties = data;

        // Frontend filters
        let filtered = data;
        if (priceParam) {
            filtered = filtered.filter(p => p.price_per_month <= parseFloat(priceParam));
        }
        if (searchVal) {
            filtered = filtered.filter(p => 
                p.title.toLowerCase().includes(searchVal) || 
                p.address.toLowerCase().includes(searchVal) || 
                (p.description && p.description.toLowerCase().includes(searchVal))
            );
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="search-code"></i>
                    <h4>No spaces match your criteria</h4>
                    <p>Try resetting filters or search keywords to browse our premier selection.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        grid.innerHTML = filtered.map(prop => {
            const isOwner = state.user && state.user.id === prop.owner_id;
            const isTenant = state.user && state.user.role === 'tenant';
            
            let actionBtnHtml = '';
            if (prop.is_available) {
                if (isTenant) {
                    actionBtnHtml = `<button class="btn btn-primary btn-block" onclick="openLeaseModal(${prop.id}, '${escapeHtml(prop.title)}', '${escapeHtml(prop.address)}', ${prop.price_per_month})">Rent Property</button>`;
                } else if (!state.user) {
                    actionBtnHtml = `<button class="btn btn-primary btn-block" onclick="openAuthModal('login')">Sign In to Rent</button>`;
                } else {
                    actionBtnHtml = `<button class="btn btn-secondary btn-block" disabled>Landlords cannot rent</button>`;
                }
            } else {
                actionBtnHtml = `<button class="btn btn-secondary btn-block" disabled>Not Available</button>`;
            }

            const imageUrl = getPropertyImageUrl(prop);
            return `
                <article class="property-card">
                    <div class="card-img-placeholder" style="background-image: url('${imageUrl}'); background-size: cover; background-position: center; min-height: 200px;">
                        <span class="card-badge ${prop.is_available ? 'badge-available' : 'badge-rented'}">
                            ${prop.is_available ? 'Available' : 'Rented'}
                        </span>
                        <div class="card-price-tag">${formatCurrency(prop.price_per_month)}<span class="price-period">/mo</span></div>
                    </div>
                    <div class="property-card-body">
                        <h3 class="property-title">${escapeHtml(prop.title)}</h3>
                        <a href="${getGoogleMapsLink(prop.address)}" target="_blank" rel="noopener noreferrer" class="property-address">
                            <i data-lucide="map-pin"></i>${escapeHtml(prop.address)}
                        </a>
                        <p class="property-desc">${escapeHtml(prop.description || 'No description provided for this listing.')}</p>
                        <div class="property-card-footer">
                            ${actionBtnHtml}
                        </div>
                    </div>
                </article>
            `;
        }).join('');
        
        lucide.createIcons();
    } catch (err) {
        grid.innerHTML = `
            <div class="empty-state">
                <i data-lucide="alert-octagon" style="color: var(--danger);"></i>
                <h4>Failed to load listings</h4>
                <p>Could not fetch catalog. Please verify backend is running.</p>
            </div>
        `;
        lucide.createIcons();
    }
}

// 2. Landlord Dashboard Loading
async function loadLandlordDashboard() {
    const propGrid = document.getElementById('landlord-properties-grid');
    const tableBody = document.getElementById('landlord-leases-table-body');
    
    propGrid.innerHTML = '<div class="spinner"></div>';
    tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Loading leases...</td></tr>';

    try {
        // Fetch properties owned by landlord
        const properties = await API.request(`/properties?owner_id=${state.user.id}`);
        const leases = await API.request('/leases');

        if (!properties || !leases) return;

        // Render Metrics
        const totalOwned = properties.length;
        const activeLeases = leases.filter(l => l.status === 'active');
        const totalActiveLeases = activeLeases.length;
        
        const occupancyRate = totalOwned > 0 ? Math.round((totalActiveLeases / totalOwned) * 100) : 0;
        const totalRevenue = activeLeases.reduce((acc, curr) => acc + curr.rent_amount, 0);

        document.getElementById('metric-total-properties').textContent = totalOwned;
        document.getElementById('metric-occupancy').textContent = `${occupancyRate}%`;
        document.getElementById('metric-revenue').textContent = formatCurrency(totalRevenue);

        // Render listings
        if (properties.length === 0) {
            propGrid.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="building"></i>
                    <h4>You haven't listed any properties yet</h4>
                    <p>Start listing properties to begin acquiring leases.</p>
                    <button class="btn btn-primary" onclick="openPropertyModal()">Create Listing</button>
                </div>
            `;
            lucide.createIcons();
        } else {
            propGrid.innerHTML = properties.map(prop => {
                const imageUrl = getPropertyImageUrl(prop);
                return `
                    <article class="property-card">
                        <div class="card-img-placeholder" style="background-image: url('${imageUrl}'); background-size: cover; background-position: center; min-height: 200px;">
                            <span class="card-badge ${prop.is_available ? 'badge-available' : 'badge-rented'}">
                                ${prop.is_available ? 'Available' : 'Rented'}
                            </span>
                            <div class="card-price-tag">${formatCurrency(prop.price_per_month)}<span class="price-period">/mo</span></div>
                        </div>
                        <div class="property-card-body">
                            <h3 class="property-title">${escapeHtml(prop.title)}</h3>
                            <a href="${getGoogleMapsLink(prop.address)}" target="_blank" rel="noopener noreferrer" class="property-address">
                                <i data-lucide="map-pin"></i>${escapeHtml(prop.address)}
                            </a>
                            <p class="property-desc">${escapeHtml(prop.description || 'No description.')}</p>
                            <div class="property-card-footer">
                                <button class="btn btn-secondary" style="flex: 1;" onclick="openPropertyModal(${JSON.stringify(prop).replace(/"/g, '&quot;')})">Edit</button>
                                <button class="btn btn-danger" onclick="deleteProperty(${prop.id})"><i data-lucide="trash-2"></i></button>
                            </div>
                        </div>
                    </article>
                `;
            }).join('');
            lucide.createIcons();
        }

        // Render table of leases
        if (leases.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No lease records found.</td></tr>';
        } else {
            tableBody.innerHTML = leases.map(lease => {
                const prop = properties.find(p => p.id === lease.property_id);
                const title = prop ? prop.title : `Property #${lease.property_id}`;
                const isActive = lease.status === 'active';
                const actionHtml = isActive 
                    ? `<button class="btn btn-danger btn-block" style="padding: 6px 12px; font-size: 0.82rem;" onclick="terminateLease(${lease.id}, 'landlord')">Terminate</button>`
                    : `<span class="badge">Ended</span>`;

                return `
                    <tr>
                        <td><strong>${escapeHtml(title)}</strong></td>
                        <td><span style="font-family: monospace; font-size: 0.8rem;">${lease.tenant_id.substring(0, 8)}...</span></td>
                        <td>${formatCurrency(lease.rent_amount)}</td>
                        <td>${lease.start_date}</td>
                        <td>${lease.end_date}</td>
                        <td><span class="status-badge ${isActive ? 'status-active' : 'status-terminated'}">${lease.status}</span></td>
                        <td class="text-right">${actionHtml}</td>
                    </tr>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Failed to populate Landlord Dashboard:', err);
    }
}

// 3. Tenant Leases loading
async function loadTenantLeases() {
    const container = document.getElementById('tenant-leases-container');
    container.innerHTML = '<div class="spinner"></div>';

    try {
        const leases = await API.request('/leases');
        if (!leases) return;

        // Render Tenant Metrics
        const activeLeases = leases.filter(l => l.status === 'active');
        const activeCount = activeLeases.length;
        const totalCommitment = activeLeases.reduce((acc, curr) => acc + curr.rent_amount, 0);

        document.getElementById('tenant-active-leases-count').textContent = activeCount;
        document.getElementById('tenant-total-rent').textContent = formatCurrency(totalCommitment);

        if (leases.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="file-minus"></i>
                    <h4>No leases signed</h4>
                    <p>You haven't leased any spaces yet. Browse our explore section to find your perfect home.</p>
                    <button class="btn btn-primary" onclick="switchView('view-explore')">Find Properties</button>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        // Fetch properties list to pair titles
        const properties = await API.request('/properties');

        container.innerHTML = leases.map(lease => {
            const prop = properties.find(p => p.id === lease.property_id);
            const title = prop ? prop.title : `Property Listing #${lease.property_id}`;
            const address = prop ? prop.address : 'Address Unknown';
            const isActive = lease.status === 'active';

            return `
                <div class="lease-card">
                    <div class="lease-card-header">
                        <div>
                            <h3 class="lease-card-title">${escapeHtml(title)}</h3>
                            <a href="${getGoogleMapsLink(address)}" target="_blank" rel="noopener noreferrer" class="property-address">
                                <i data-lucide="map-pin"></i>${escapeHtml(address)}
                            </a>
                        </div>
                        <span class="status-badge ${isActive ? 'status-active' : 'status-terminated'}">${lease.status}</span>
                    </div>
                    <div class="lease-card-details">
                        <div class="detail-block">
                            <span class="detail-label">Rent Amount</span>
                            <span class="detail-value">${formatCurrency(lease.rent_amount)}/mo</span>
                        </div>
                        <div class="detail-block">
                            <span class="detail-label">Lease Status</span>
                            <span class="detail-value" style="text-transform: capitalize;">${lease.status}</span>
                        </div>
                        <div class="detail-block">
                            <span class="detail-label">Start Date</span>
                            <span class="detail-value">${lease.start_date}</span>
                        </div>
                        <div class="detail-block">
                            <span class="detail-label">End Date</span>
                            <span class="detail-value">${lease.end_date}</span>
                        </div>
                    </div>
                    <div class="lease-card-actions">
                        ${isActive ? `<button class="btn btn-danger" onclick="terminateLease(${lease.id}, 'tenant')">Terminate Lease Contract</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    } catch (err) {
        console.error('Failed to populate Tenant leases:', err);
    }
}

// ================= FORM HANDLERS AND OPERATIONS =================

// Auth actions: Switch between Login and Register
let currentAuthTab = 'login';
function setAuthTab(tab) {
    currentAuthTab = tab;
    const title = document.getElementById('auth-modal-title');
    const subtitle = document.getElementById('auth-modal-subtitle');
    const submitBtn = document.getElementById('btn-auth-submit');
    const usernameGroup = document.getElementById('group-username');
    const roleGroup = document.getElementById('group-role');
    
    document.querySelectorAll('.auth-tab').forEach(el => el.classList.remove('active'));

    if (tab === 'login') {
        document.getElementById('tab-login').classList.add('active');
        title.textContent = 'Sign In to RentFlow';
        subtitle.textContent = 'Welcome back! Please enter your details.';
        submitBtn.textContent = 'Sign In';
        usernameGroup.classList.add('hidden');
        roleGroup.classList.add('hidden');
        document.getElementById('auth-username').required = false;
    } else {
        document.getElementById('tab-signup').classList.add('active');
        title.textContent = 'Create an Account';
        subtitle.textContent = 'Join RentFlow today as a landlord or tenant.';
        submitBtn.textContent = 'Register';
        usernameGroup.classList.remove('hidden');
        roleGroup.classList.remove('hidden');
        document.getElementById('auth-username').required = true;
    }
}

// Open modals helper
function openAuthModal(initialTab = 'login') {
    setAuthTab(initialTab);
    document.getElementById('modal-auth').classList.add('open');
}

function closeAuthModal() {
    document.getElementById('modal-auth').classList.remove('open');
    document.getElementById('form-auth').reset();
}

// Add/Edit Property Modals
function openPropertyModal(prop = null) {
    const title = document.getElementById('property-modal-title');
    const submitBtn = document.getElementById('btn-property-submit');
    const availableGroup = document.getElementById('group-prop-available');
    
    document.getElementById('form-property').reset();
    document.getElementById('property-id').value = '';

    if (prop) {
        title.textContent = 'Edit Property Details';
        submitBtn.textContent = 'Save Changes';
        availableGroup.classList.remove('hidden');
        
        document.getElementById('property-id').value = prop.id;
        document.getElementById('prop-title').value = prop.title;
        document.getElementById('prop-address').value = prop.address;
        document.getElementById('prop-price').value = prop.price_per_month;
        document.getElementById('prop-image-url').value = prop.image_url || '';
        document.getElementById('prop-description').value = prop.description || '';
        document.getElementById('prop-available').checked = prop.is_available;
    } else {
        title.textContent = 'List New Property';
        submitBtn.textContent = 'Publish Listing';
        availableGroup.classList.add('hidden');
    }
    
    document.getElementById('modal-property').classList.add('open');
}

function closePropertyModal() {
    document.getElementById('modal-property').classList.remove('open');
}

// Delete Property operation
async function deleteProperty(propertyId) {
    if (!confirm('Are you sure you want to delete this property? This will permanently delete any associated leases.')) {
        return;
    }
    try {
        await API.request(`/properties/${propertyId}`, {
            method: 'DELETE'
        });
        showToast('Property deleted successfully.', 'success');
        loadLandlordDashboard();
    } catch (err) {
        console.error('Delete error:', err);
    }
}

// Lease execution modal
function openLeaseModal(propertyId, title, address, monthlyPrice) {
    document.getElementById('form-lease').reset();
    document.getElementById('lease-property-id').value = propertyId;
    document.getElementById('lease-rent-amount').value = monthlyPrice;
    
    document.getElementById('lease-prop-title').textContent = title;
    document.getElementById('lease-prop-address').innerHTML = `<a href="${getGoogleMapsLink(address)}" target="_blank" rel="noopener noreferrer" class="property-address"><i data-lucide="map-pin"></i> ${address}</a>`;
    document.getElementById('lease-prop-price').textContent = formatCurrency(monthlyPrice);

    // Set default lease dates (Start today, End 1 year from now)
    const today = new Date();
    const formattedToday = today.toISOString().split('T')[0];
    
    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);
    const formattedNextYear = nextYear.toISOString().split('T')[0];

    document.getElementById('lease-start-date').value = formattedToday;
    document.getElementById('lease-end-date').value = formattedNextYear;
    document.getElementById('lease-start-date').min = formattedToday;
    
    updateLeaseEstimate();
    document.getElementById('modal-lease').classList.add('open');
    lucide.createIcons();
}

function closeLeaseModal() {
    document.getElementById('modal-lease').classList.remove('open');
}

function updateLeaseEstimate() {
    const startDateVal = document.getElementById('lease-start-date').value;
    const endDateVal = document.getElementById('lease-end-date').value;
    const rentAmount = parseFloat(document.getElementById('lease-rent-amount').value);

    if (!startDateVal || !endDateVal || isNaN(rentAmount)) return;

    const start = new Date(startDateVal);
    const end = new Date(endDateVal);

    if (end <= start) {
        document.getElementById('estimate-months').textContent = 'Invalid duration';
        document.getElementById('estimate-total-cost').textContent = '₹0';
        document.getElementById('btn-lease-submit').disabled = true;
        return;
    }
    document.getElementById('btn-lease-submit').disabled = false;

    // Calculate approximate month count
    const totalDiffTime = Math.abs(end - start);
    const totalDiffDays = Math.ceil(totalDiffTime / (1000 * 60 * 60 * 24)); 
    const months = Math.max(1, Math.round(totalDiffDays / 30));
    
    const totalCost = months * rentAmount;

    document.getElementById('estimate-months').textContent = `${months} month${months > 1 ? 's' : ''} (${totalDiffDays} days)`;
    document.getElementById('estimate-total-cost').textContent = formatCurrency(totalCost);
}

// Terminate leases
async function terminateLease(leaseId, contextRole) {
    if (!confirm('Are you sure you want to terminate this active lease agreement? The property will become immediately available.')) {
        return;
    }
    try {
        const response = await API.request(`/leases/${leaseId}/terminate`, {
            method: 'POST'
        });
        if (response) {
            showToast('Lease terminated successfully.', 'success');
            if (contextRole === 'landlord') {
                loadLandlordDashboard();
            } else {
                loadTenantLeases();
            }
        }
    } catch (err) {
        console.error('Lease termination failed:', err);
    }
}

// Expose actions to the global window scope to guarantee inline HTML onclick functionality
window.switchView = switchView;
window.openAuthModal = openAuthModal;
window.openPropertyModal = openPropertyModal;
window.deleteProperty = deleteProperty;
window.openLeaseModal = openLeaseModal;
window.terminateLease = terminateLease;

// ================= EVENT LISTENERS =================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Theme
    ThemeManager.init();

    // 2. Setup initial Session UI navbar items
    setupSessionUI();

    // 3. Navigate default view
    if (state.user && state.user.role === 'landlord') {
        switchView('view-dashboard');
    } else {
        switchView('view-explore');
    }

    // 4. Navbar view link clicks
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            switchView(target);
        });
    });

    document.getElementById('nav-brand-logo').addEventListener('click', (e) => {
        e.preventDefault();
        switchView('view-explore');
    });

    // 5. Hero Button Event listeners
    document.getElementById('hero-btn-explore').addEventListener('click', () => {
        switchView('view-explore');
    });
    document.getElementById('hero-btn-join').addEventListener('click', () => {
        openAuthModal('signup');
        // Pre-select Landlord role
        const landlordRadio = document.querySelector('input[name="auth-role"][value="landlord"]');
        if (landlordRadio) landlordRadio.checked = true;
    });

    // 6. Mobile menu toggles
    document.getElementById('mobile-toggle').addEventListener('click', () => {
        const navMenu = document.getElementById('nav-menu');
        navMenu.classList.toggle('open');
    });

    // 7. Modals open / close actions
    document.getElementById('btn-open-login').addEventListener('click', () => openAuthModal('login'));
    document.getElementById('btn-open-register').addEventListener('click', () => openAuthModal('signup'));
    
    document.getElementById('btn-close-auth').addEventListener('click', closeAuthModal);
    document.getElementById('btn-close-property').addEventListener('click', closePropertyModal);
    document.getElementById('btn-close-lease').addEventListener('click', closeLeaseModal);

    document.getElementById('btn-add-property').addEventListener('click', () => openPropertyModal());

    // Close modals clicking outside container
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                backdrop.classList.remove('open');
            }
        });
    });

    // 8. Auth Switch tabs
    document.getElementById('tab-login').addEventListener('click', () => setAuthTab('login'));
    document.getElementById('tab-signup').addEventListener('click', () => setAuthTab('signup'));

    // 9. Auth Submit
    document.getElementById('form-auth').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;

        if (currentAuthTab === 'login') {
            const ok = await API.login(email, password);
            if (ok) closeAuthModal();
        } else {
            const username = document.getElementById('auth-username').value.trim();
            const role = document.querySelector('input[name="auth-role"]:checked').value;
            const ok = await API.signup(username, email, password, role);
            if (ok) setAuthTab('login');
        }
    });

    // 10. Logout Button
    document.getElementById('btn-logout').addEventListener('click', () => {
        API.logout();
    });

    // 11. Property submit creation/edit
    document.getElementById('form-property').addEventListener('submit', async (e) => {
        e.preventDefault();
        const propId = document.getElementById('property-id').value;
        const title = document.getElementById('prop-title').value.trim();
        const address = document.getElementById('prop-address').value.trim();
        const price_per_month = parseFloat(document.getElementById('prop-price').value);
        const image_url = document.getElementById('prop-image-url').value.trim();
        const description = document.getElementById('prop-description').value.trim();
        
        const payload = { title, address, price_per_month, image_url, description };

        try {
            let data;
            if (propId) {
                // Update
                payload.is_available = document.getElementById('prop-available').checked;
                data = await API.request(`/properties/${propId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (data) showToast('Listing updated successfully.', 'success');
            } else {
                // Create
                data = await API.request('/properties', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (data) showToast('New property listed successfully.', 'success');
            }
            
            if (data) {
                closePropertyModal();
                loadLandlordDashboard();
            }
        } catch (err) {
            console.error('Property save failed:', err);
        }
    });

    // 12. Lease Submit
    document.getElementById('form-lease').addEventListener('submit', async (e) => {
        e.preventDefault();
        const property_id = parseInt(document.getElementById('lease-property-id').value);
        const start_date = document.getElementById('lease-start-date').value;
        const end_date = document.getElementById('lease-end-date').value;
        const rent_amount = parseFloat(document.getElementById('lease-rent-amount').value);

        try {
            const data = await API.request('/leases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ property_id, start_date, end_date, rent_amount })
            });

            if (data) {
                showToast('Lease signed and space rented!', 'success');
                closeLeaseModal();
                switchView('view-leases');
            }
        } catch (err) {
            console.error('Lease execution failed:', err);
        }
    });

    // Calculate dates listener for lease estimate calculation
    document.getElementById('lease-start-date').addEventListener('change', updateLeaseEstimate);
    document.getElementById('lease-end-date').addEventListener('change', updateLeaseEstimate);

    // 13. Search and price filters triggers
    document.getElementById('filter-search').addEventListener('input', debounce(loadProperties, 300));
    document.getElementById('filter-price').addEventListener('change', loadProperties);
    document.getElementById('filter-availability').addEventListener('change', loadProperties);

    // 14. Landlord Dashboard sub-tabs (My Listings vs Active Leases)
    document.querySelectorAll('.dash-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.dash-tab-content').forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const targetContentId = tab.getAttribute('data-tab');
            document.getElementById(targetContentId).classList.add('active');
        });
    });

    // 15. Cursor Follow Gradient Glow Effect
    const cursorGlow = document.getElementById('cursor-glow');
    if (cursorGlow) {
        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let currentX = mouseX;
        let currentY = mouseY;
        const speed = 0.16; // Easing / lag inertia speed (lower latency)

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function updateGlow() {
            currentX += (mouseX - currentX) * speed;
            currentY += (mouseY - currentY) * speed;
            cursorGlow.style.transform = `translate3d(calc(${currentX}px - 50%), calc(${currentY}px - 50%), 0)`;
            requestAnimationFrame(updateGlow);
        }
        updateGlow();
    }
});

// ================= UTILITIES =================
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
