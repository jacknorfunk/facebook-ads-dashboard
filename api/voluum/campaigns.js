<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voluum Performance Tracker</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .status-up { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .status-down { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
        .status-stable { background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); }
        .status-paused { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .loading-pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .trend-positive { color: #10b981; }
        .trend-negative { color: #ef4444; }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Header -->
    <div class="gradient-bg shadow-lg">
        <div class="max-w-7xl mx-auto px-4 py-6">
            <div class="flex items-center justify-between mb-4">
                <div>
                    <h1 class="text-3xl font-bold text-white">Voluum Performance Tracker</h1>
                    <p class="text-blue-100">Real-time campaign monitoring and trend analysis</p>
                </div>
                <div class="flex items-center space-x-4">
                    <button id="exportBtn" class="bg-white bg-opacity-20 text-white px-4 py-2 rounded-lg hover:bg-opacity-30 transition-all">
                        <i class="fas fa-download mr-2"></i>Export CSV
                    </button>
                    <button id="refreshBtn" class="bg-white bg-opacity-20 text-white px-4 py-2 rounded-lg hover:bg-opacity-30 transition-all">
                        <i class="fas fa-sync mr-2"></i>Refresh
                    </button>
                </div>
            </div>
            
            <!-- Simple Filters Row -->
            <div class="bg-white bg-opacity-10 rounded-lg p-4">
                <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <!-- Date Range Filter -->
                    <div>
                        <label class="block text-white text-sm font-medium mb-2">Date Range</label>
                        <select id="dateRangeFilter" class="w-full bg-white bg-opacity-90 border border-gray-300 rounded-lg px-3 py-2 text-gray-900">
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="last_7_days" selected>Last 7 Days</option>
                            <option value="last_14_days">Last 14 Days</option>
                            <option value="last_30_days">Last 30 Days</option>
                        </select>
                    </div>
                    
                    <!-- Campaign Status Filter -->
                    <div>
                        <label class="block text-white text-sm font-medium mb-2">Status</label>
                        <select id="statusFilter" class="w-full bg-white bg-opacity-90 border border-gray-300 rounded-lg px-3 py-2 text-gray-900">
                            <option value="all">All Campaigns</option>
                            <option value="active">Active Only</option>
                            <option value="paused">Paused Only</option>
                            <option value="profitable">Profitable (ROAS > 1.0)</option>
                        </select>
                    </div>
                    
                    <!-- Spend Filter -->
                    <div>
                        <label class="block text-white text-sm font-medium mb-2">Spend Level</label>
                        <select id="spendFilter" class="w-full bg-white bg-opacity-90 border border-gray-300 rounded-lg px-3 py-2 text-gray-900">
                            <option value="all">All Spend</option>
                            <option value="high">High Spend (>$1,000)</option>
                            <option value="medium">Medium Spend ($100-$1,000)</option>
                            <option value="low">Low Spend (<$100)</option>
                            <option value="zero">No Spend</option>
                        </select>
                    </div>
                    
                    <!-- Performance Filter -->
                    <div>
                        <label class="block text-white text-sm font-medium mb-2">Performance</label>
                        <select id="performanceFilter" class="w-full bg-white bg-opacity-90 border border-gray-300 rounded-lg px-3 py-2 text-gray-900">
                            <option value="all">All Performance</option>
                            <option value="excellent">Excellent (ROAS > 1.5)</option>
                            <option value="good">Good (ROAS 1.0-1.5)</option>
                            <option value="poor">Poor (ROAS < 1.0)</option>
                        </select>
                    </div>
                    
                    <!-- Sort Filter -->
                    <div>
                        <label class="block text-white text-sm font-medium mb-2">Sort By</label>
                        <select id="sortFilter" class="w-full bg-white bg-opacity-90 border border-gray-300 rounded-lg px-3 py-2 text-gray-900">
                            <option value="revenue_desc">Revenue (High to Low)</option>
                            <option value="spend_desc">Spend (High to Low)</option>
                            <option value="roas_desc">ROAS (High to Low)</option>
                            <option value="conversions_desc">Conversions (High to Low)</option>
                            <option value="name_asc">Campaign Name (A-Z)</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Stats Overview -->
    <div class="max-w-7xl mx-auto px-4 py-6">
        <div class="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
            <div class="bg-white p-6 rounded-xl shadow-sm border">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Total Campaigns</p>
                        <p id="totalCampaigns" class="text-2xl font-bold text-gray-900">0</p>
                    </div>
                    <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <i class="fas fa-chart-bar text-blue-600"></i>
                    </div>
                </div>
            </div>
            
            <div class="bg-white p-6 rounded-xl shadow-sm border">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Active Campaigns</p>
                        <p id="activeCampaigns" class="text-2xl font-bold text-green-600">0</p>
                    </div>
                    <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <i class="fas fa-play text-green-600"></i>
                    </div>
                </div>
            </div>
            
            <div class="bg-white p-6 rounded-xl shadow-sm border">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Total Revenue</p>
                        <p id="totalRevenue" class="text-2xl font-bold text-gray-900">$0</p>
                    </div>
                    <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <i class="fas fa-dollar-sign text-green-600"></i>
                    </div>
                </div>
            </div>
            
            <div class="bg-white p-6 rounded-xl shadow-sm border">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Total Spend</p>
                        <p id="totalSpend" class="text-2xl font-bold text-red-600">$0</p>
                    </div>
                    <div class="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                        <i class="fas fa-credit-card text-red-600"></i>
                    </div>
                </div>
            </div>
            
            <div class="bg-white p-6 rounded-xl shadow-sm border">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Average ROAS</p>
                        <p id="averageRoas" class="text-2xl font-bold text-purple-600">0.0x</p>
                    </div>
                    <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                        <i class="fas fa-chart-line text-purple-600"></i>
                    </div>
                </div>
            </div>
            
            <div class="bg-white p-6 rounded-xl shadow-sm border">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Total Conversions</p>
                        <p id="totalConversions" class="text-2xl font-bold text-indigo-600">0</p>
                    </div>
                    <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <i class="fas fa-bullseye text-indigo-600"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- Connection Status -->
        <div class="bg-white rounded-xl shadow-sm border p-6 mb-8">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-900">Connection Status</h3>
                <div id="connectionIndicator" class="flex items-center space-x-2">
                    <div class="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <span class="text-sm text-gray-600">Connecting...</span>
                </div>
            </div>
            <div id="debugInfo" class="text-sm text-gray-600 space-y-1">
                <div>Ready to connect...</div>
            </div>
        </div>

        <!-- Campaign Performance Table -->
        <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-semibold text-gray-900">Campaign Performance</h3>
                    <span id="filteredCount" class="text-sm text-gray-600">Showing 0 campaigns</span>
                </div>
            </div>
            
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visits</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversions</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Spend</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ROAS</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPA</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">24h Change</th>
                        </tr>
                    </thead>
                    <tbody id="campaignsTable" class="bg-white divide-y divide-gray-200">
                        <!-- Campaigns will be populated here -->
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Loading State -->
        <div id="loadingState" class="text-center py-12">
            <div class="loading-pulse">
                <i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-600">Loading campaign data...</p>
            </div>
        </div>

        <!-- Empty State -->
        <div id="emptyState" class="text-center py-12 hidden">
            <i class="fas fa-filter text-6xl text-gray-300 mb-4"></i>
            <h3 class="text-xl font-semibold text-gray-700 mb-2">No Campaigns Found</h3>
            <p class="text-gray-600 mb-4">Try adjusting your filters or refresh the data</p>
            <button onclick="resetAllFilters()" class="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Reset Filters
            </button>
        </div>
    </div>

    <script>
        // Global variables
        let allCampaigns = [];
        let filteredCampaigns = [];
        
        // Initialize on page load
        document.addEventListener('DOMContentLoaded', function() {
            setupEventListeners();
            loadData();
        });

        function setupEventListeners() {
            // Filter event listeners
            document.getElementById('dateRangeFilter').addEventListener('change', loadData);
            document.getElementById('statusFilter').addEventListener('change', applyFilters);
            document.getElementById('spendFilter').addEventListener('change', applyFilters);
            document.getElementById('performanceFilter').addEventListener('change', applyFilters);
            document.getElementById('sortFilter').addEventListener('change', applyFilters);
            
            // Button event listeners
            document.getElementById('refreshBtn').addEventListener('click', loadData);
            document.getElementById('exportBtn').addEventListener('click', exportToCsv);
        }

        async function loadData() {
            showLoadingState();
            updateConnectionStatus('loading', 'Loading campaign data...');
            
            try {
                debugLog('Starting data load...');
                
                const dateRange = document.getElementById('dateRangeFilter').value;
                const url = `/api/voluum/campaigns?date_range=${dateRange}`;
                
                debugLog(`Fetching from: ${url}`);
                
                const response = await fetch(url);
                debugLog(`Response status: ${response.status}`);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                debugLog(`Data received successfully`);
                
                if (data.success === false) {
                    debugLog(`API returned error: ${data.error}`);
                    if (data.data) {
                        debugLog('Using fallback data provided by API');
                        processData(data.data);
                        updateConnectionStatus('warning', `Using mock data - ${data.error}`);
                    } else {
                        throw new Error(data.error || 'API returned error');
                    }
                } else {
                    debugLog('Real Voluum data received successfully');
                    processData(data.data || data);
                    updateConnectionStatus('success', `Connected - ${data.debug_info?.campaigns_count || 'Unknown'} campaigns loaded`);
                }
                
            } catch (error) {
                console.error('Error loading data:', error);
                debugLog(`Error: ${error.message}`);
                updateConnectionStatus('error', `Connection failed: ${error.message}`);
                showEmptyState();
            } finally {
                hideLoadingState();
            }
        }

        function processData(data) {
            debugLog('Processing campaign data...');
            
            allCampaigns = data.campaigns || [];
            
            debugLog(`Processed ${allCampaigns.length} campaigns`);
            
            updateOverviewStats(data.overview || calculateOverviewStats(allCampaigns));
            applyFilters();
        }

        function applyFilters() {
            const statusFilter = document.getElementById('statusFilter').value;
            const spendFilter = document.getElementById('spendFilter').value;
            const performanceFilter = document.getElementById('performanceFilter').value;
            const sortFilter = document.getElementById('sortFilter').value;
            
            filteredCampaigns = allCampaigns.filter(campaign => {
                // Status filter
                if (statusFilter !== 'all') {
                    const hasTraffic = (campaign.visits || 0) > 0 || (campaign.cost || 0) > 0;
                    
                    if (statusFilter === 'active' && !hasTraffic) return false;
                    if (statusFilter === 'paused' && hasTraffic) return false;
                    if (statusFilter === 'profitable' && (campaign.roas || 0) <= 1.0) return false;
                }
                
                // Spend filter
                if (spendFilter !== 'all') {
                    const spend = campaign.cost || 0;
                    if (spendFilter === 'high' && spend <= 1000) return false;
                    if (spendFilter === 'medium' && (spend <= 100 || spend > 1000)) return false;
                    if (spendFilter === 'low' && spend >= 100) return false;
                    if (spendFilter === 'zero' && spend > 0) return false;
                }
                
                // Performance filter
                if (performanceFilter !== 'all') {
                    const roas = campaign.roas || 0;
                    if (performanceFilter === 'excellent' && roas <= 1.5) return false;
                    if (performanceFilter === 'good' && (roas <= 1.0 || roas > 1.5)) return false;
                    if (performanceFilter === 'poor' && roas >= 1.0) return false;
                }
                
                return true;
            });
            
            // Apply sorting
            applySorting(sortFilter);
            
            debugLog(`Applied filters: ${filteredCampaigns.length} campaigns after filtering`);
            updateCampaignsTable();
            updateFilteredCount();
        }

        function applySorting(sortOption) {
            const [field, direction] = sortOption.split('_');
            
            filteredCampaigns.sort((a, b) => {
                let aVal, bVal;
                
                switch (field) {
                    case 'name':
                        aVal = a.name || '';
                        bVal = b.name || '';
                        break;
                    case 'revenue':
                        aVal = a.revenue || 0;
                        bVal = b.revenue || 0;
                        break;
                    case 'roas':
                        aVal = a.roas || 0;
                        bVal = b.roas || 0;
                        break;
                    case 'spend':
                        aVal = a.cost || 0;
                        bVal = b.cost || 0;
                        break;
                    case 'conversions':
                        aVal = a.conversions || 0;
                        bVal = b.conversions || 0;
                        break;
                    default:
                        return 0;
                }
                
                if (typeof aVal === 'string') {
                    return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                } else {
                    return direction === 'asc' ? aVal - bVal : bVal - aVal;
                }
            });
        }

        function updateCampaignsTable() {
            const tbody = document.getElementById('campaignsTable');
            
            if (filteredCampaigns.length === 0) {
                showEmptyState();
                return;
            }
            
            hideEmptyState();
            
            tbody.innerHTML = filteredCampaigns.map(campaign => {
                const hasTraffic = (campaign.visits || 0) > 0 || (campaign.cost || 0) > 0;
                const statusClass = hasTraffic ? getStatusClass(campaign.status) : 'status-paused';
                const statusLabel = hasTraffic ? campaign.status || 'ACTIVE' : 'PAUSED';
                const changeClass = (campaign.change24h || 0) >= 0 ? 'trend-positive' : 'trend-negative';
                const changeIcon = (campaign.change24h || 0) >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
                
                return `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="font-medium text-gray-900 text-sm">${campaign.name || 'Unnamed Campaign'}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="${statusClass} text-white px-2 py-1 rounded-full text-xs font-medium">
                                ${statusLabel}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${(campaign.visits || 0).toLocaleString()}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${(campaign.conversions || 0).toLocaleString()}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            $${(campaign.revenue || 0).toFixed(2)}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            $${(campaign.cost || 0).toFixed(2)}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${getRoasColor(campaign.roas)}">
                            ${(campaign.roas || 0).toFixed(2)}x
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            $${(campaign.cpa || 0).toFixed(2)}
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm">
                            <div class="flex items-center ${changeClass}">
                                <i class="fas ${changeIcon} mr-1"></i>
                                ${Math.abs(campaign.change24h || 0).toFixed(1)}%
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function calculateOverviewStats(campaigns) {
            const activeCampaigns = campaigns.filter(c => (c.visits || 0) > 0 || (c.cost || 0) > 0);
            
            return {
                liveCampaigns: campaigns.length,
                activeCampaigns: activeCampaigns.length,
                totalRevenue: campaigns.reduce((sum, c) => sum + (c.revenue || 0), 0),
                totalSpend: campaigns.reduce((sum, c) => sum + (c.cost || 0), 0),
                averageRoas: activeCampaigns.length > 0 ? 
                    activeCampaigns.reduce((sum, c) => sum + (c.roas || 0), 0) / activeCampaigns.length : 0,
                totalConversions: campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0)
            };
        }

        function updateOverviewStats(overview) {
            document.getElementById('totalCampaigns').textContent = (overview.liveCampaigns || 0).toLocaleString();
            document.getElementById('activeCampaigns').textContent = (overview.activeCampaigns || 0).toLocaleString();
            document.getElementById('totalRevenue').textContent = `$${(overview.totalRevenue || 0).toFixed(2)}`;
            document.getElementById('totalSpend').textContent = `$${(overview.totalSpend || 0).toFixed(2)}`;
            document.getElementById('averageRoas').textContent = `${(overview.averageRoas || 0).toFixed(2)}x`;
            document.getElementById('totalConversions').textContent = (overview.totalConversions || 0).toLocaleString();
        }

        function updateFilteredCount() {
            document.getElementById('filteredCount').textContent = `Showing ${filteredCampaigns.length} of ${allCampaigns.length} campaigns`;
        }

        // Helper functions
        function getStatusClass(status) {
            switch (status) {
                case 'UP': return 'status-up';
                case 'DOWN': return 'status-down';
                case 'STABLE': return 'status-stable';
                default: return 'status-stable';
            }
        }

        function getRoasColor(roas) {
            if ((roas || 0) >= 1.5) return 'text-green-600';
            if ((roas || 0) >= 1.0) return 'text-yellow-600';
            return 'text-red-600';
        }

        function resetAllFilters() {
            document.getElementById('statusFilter').value = 'all';
            document.getElementById('spendFilter').value = 'all';
            document.getElementById('performanceFilter').value = 'all';
            document.getElementById('sortFilter').value = 'revenue_desc';
            applyFilters();
        }

        function exportToCsv() {
            const headers = ['Campaign', 'Status', 'Visits', 'Conversions', 'Revenue', 'Spend', 'ROAS', 'CPA', '24h Change'];
            
            const csvContent = [
                headers.join(','),
                ...filteredCampaigns.map(campaign => {
                    const hasTraffic = (campaign.visits || 0) > 0 || (campaign.cost || 0) > 0;
                    const status = hasTraffic ? (campaign.status || 'ACTIVE') : 'PAUSED';
                    
                    return [
                        `"${campaign.name || 'Unnamed Campaign'}"`,
                        status,
                        campaign.visits || 0,
                        campaign.conversions || 0,
                        (campaign.revenue || 0).toFixed(2),
                        (campaign.cost || 0).toFixed(2),
                        (campaign.roas || 0).toFixed(2),
                        (campaign.cpa || 0).toFixed(2),
                        (campaign.change24h || 0).toFixed(1)
                    ].join(',');
                })
            ].join('\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `voluum_campaigns_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        }

        function updateConnectionStatus(status, message) {
            const indicator = document.getElementById('connectionIndicator');
            const colors = {
                loading: 'bg-yellow-400',
                success: 'bg-green-400',
                warning: 'bg-orange-400',
                error: 'bg-red-400'
            };
            
            indicator.innerHTML = `
                <div class="w-3 h-3 ${colors[status]} rounded-full"></div>
                <span class="text-sm text-gray-600">${message}</span>
            `;
        }

        function debugLog(message) {
            const debugInfo = document.getElementById('debugInfo');
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.textContent = `[${timestamp}] ${message}`;
            debugInfo.appendChild(logEntry);
            
            // Keep only last 10 log entries
            while (debugInfo.children.length > 10) {
                debugInfo.removeChild(debugInfo.firstChild);
            }
            
            console.log(message);
        }

        function showLoadingState() {
            document.getElementById('loadingState').classList.remove('hidden');
            document.querySelector('.bg-white.rounded-xl.shadow-sm.border.overflow-hidden').classList.add('hidden');
        }

        function hideLoadingState() {
            document.getElementById('loadingState').classList.add('hidden');
            document.querySelector('.bg-white.rounded-xl.shadow-sm.border.overflow-hidden').classList.remove('hidden');
        }

        function showEmptyState() {
            document.getElementById('emptyState').classList.remove('hidden');
            document.getElementById('campaignsTable').innerHTML = '';
        }

        function hideEmptyState() {
            document.getElementById('emptyState').classList.add('hidden');
        }
    </script>
</body>
</html>
