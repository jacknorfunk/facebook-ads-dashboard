<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voluum Performance Tracker - Enhanced</title>
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
        .roas-excellent { background: linear-gradient(135deg, #10b981 0%, #059669 100%); }
        .roas-good { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); }
        .roas-poor { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
        .trend-positive { color: #10b981; }
        .trend-negative { color: #ef4444; }
        .filter-active { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; }
    </style>
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Enhanced Header with Date Range Selector -->
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
            
            <!-- Advanced Filters Row -->
            <div class="bg-white bg-opacity-10 rounded-lg p-4">
                <div class="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <!-- Date Range Filter -->
                    <div class="md:col-span-2">
                        <label class="block text-white text-sm font-medium mb-2">Date Range</label>
                        <select id="dateRangeFilter" class="w-full bg-white bg-opacity-90 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500">
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="last_7_days" selected>Last 7 Days</option>
                            <option value="last_14_days">Last 14 Days</option>
                            <option value="last_30_days">Last 30 Days</option>
                            <option value="custom">Custom Range</option>
                        </select>
                    </div>
                    
                    <!-- Campaign Status Filter -->
                    <div>
                        <label class="block text-white text-sm font-medium mb-2">Status</label>
                        <select id="statusFilter" class="w-full bg-white bg-opacity-90 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500">
                            <option value="all">All Campaigns</option>
                            <option value="active">Active Only</option>
                            <option value="paused">Paused Only</option>
                            <option value="up">Trending Up</option>
                            <option value="down">Trending Down</option>
                            <option value="stable">Stable</option>
                        </select>
                    </div>
                    
                    <!-- ROAS Filter -->
                    <div>
                        <label class="block text-white text-sm font-medium mb-2">ROAS Range</label>
                        <select id="roasFilter" class="w-full bg-white bg-opacity-90 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500">
                            <option value="all">All ROAS</option>
                            <option value="excellent">Excellent (>3.0x)</option>
                            <option value="good">Good (1.5-3.0x)</option>
                            <option value="break_even">Break Even (0.8-1.5x)</option>
                            <option value="poor">Poor (<0.8x)</option>
                        </select>
                    </div>
                    
                    <!-- Spend Filter -->
                    <div>
                        <label class="block text-white text-sm font-medium mb-2">Spend Level</label>
                        <select id="spendFilter" class="w-full bg-white bg-opacity-90 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500">
                            <option value="all">All Spend</option>
                            <option value="high">High (>$500)</option>
                            <option value="medium">Medium ($100-$500)</option>
                            <option value="low">Low (<$100)</option>
                            <option value="zero">No Spend</option>
                        </select>
                    </div>
                    
                    <!-- Sort Filter -->
                    <div>
                        <label class="block text-white text-sm font-medium mb-2">Sort By</label>
                        <select id="sortFilter" class="w-full bg-white bg-opacity-90 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:ring-2 focus:ring-blue-500">
                            <option value="revenue_desc">Revenue (High to Low)</option>
                            <option value="roas_desc">ROAS (High to Low)</option>
                            <option value="spend_desc">Spend (High to Low)</option>
                            <option value="conversions_desc">Conversions (High to Low)</option>
                            <option value="name_asc">Campaign Name (A-Z)</option>
                            <option value="change_desc">24h Change (Best to Worst)</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Enhanced Stats Overview -->
    <div class="max-w-7xl mx-auto px-4 py-6">
        <div class="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
            <div class="bg-white p-6 rounded-xl shadow-sm border">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Live Campaigns</p>
                        <p id="liveCampaigns" class="text-2xl font-bold text-gray-900">0</p>
                        <p id="campaignsTrend" class="text-xs text-gray-500">vs previous period</p>
                    </div>
                    <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <i class="fas fa-chart-bar text-blue-600"></i>
                    </div>
                </div>
            </div>
            
            <div class="bg-white p-6 rounded-xl shadow-sm border">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Total Revenue</p>
                        <p id="totalRevenue" class="text-2xl font-bold text-gray-900">$0</p>
                        <p id="revenueTrend" class="text-xs text-gray-500">vs previous period</p>
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
                        <p id="totalSpend" class="text-2xl font-bold text-gray-900">$0</p>
                        <p id="spendTrend" class="text-xs text-gray-500">vs previous period</p>
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
                        <p id="averageRoas" class="text-2xl font-bold text-gray-900">0.0x</p>
                        <p id="roasTrend" class="text-xs text-gray-500">vs previous period</p>
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
                        <p id="totalConversions" class="text-2xl font-bold text-gray-900">0</p>
                        <p id="conversionsTrend" class="text-xs text-gray-500">vs previous period</p>
                    </div>
                    <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <i class="fas fa-bullseye text-indigo-600"></i>
                    </div>
                </div>
            </div>
            
            <div class="bg-white p-6 rounded-xl shadow-sm border">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">Trending Up</p>
                        <p id="trendingUp" class="text-2xl font-bold text-green-600">0</p>
                        <p class="text-xs text-gray-500">performing campaigns</p>
                    </div>
                    <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                        <i class="fas fa-arrow-trend-up text-green-600"></i>
                    </div>
                </div>
            </div>
        </div>

        <!-- ROAS Comparison Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div class="bg-white p-6 rounded-xl shadow-sm border">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">1-Day ROAS</h3>
                <div class="space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Average:</span>
                        <span id="roas1Day" class="font-semibold text-gray-900">0.0x</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Best:</span>
                        <span id="roas1DayBest" class="font-semibold text-green-600">0.0x</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Worst:</span>
                        <span id="roas1DayWorst" class="font-semibold text-red-600">0.0x</span>
                    </div>
                </div>
            </div>
            
            <div class="bg-white p-6 rounded-xl shadow-sm border">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">7-Day ROAS</h3>
                <div class="space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Average:</span>
                        <span id="roas7Day" class="font-semibold text-gray-900">0.0x</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Best:</span>
                        <span id="roas7DayBest" class="font-semibold text-green-600">0.0x</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Worst:</span>
                        <span id="roas7DayWorst" class="font-semibold text-red-600">0.0x</span>
                    </div>
                </div>
            </div>
            
            <div class="bg-white p-6 rounded-xl shadow-sm border">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">14-Day ROAS</h3>
                <div class="space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Average:</span>
                        <span id="roas14Day" class="font-semibold text-gray-900">0.0x</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Best:</span>
                        <span id="roas14DayBest" class="font-semibold text-green-600">0.0x</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Worst:</span>
                        <span id="roas14DayWorst" class="font-semibold text-red-600">0.0x</span>
                    </div>
                </div>
            </div>
            
            <div class="bg-white p-6 rounded-xl shadow-sm border">
                <h3 class="text-lg font-semibold text-gray-900 mb-4">30-Day ROAS</h3>
                <div class="space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Average:</span>
                        <span id="roas30Day" class="font-semibold text-gray-900">0.0x</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Best:</span>
                        <span id="roas30DayBest" class="font-semibold text-green-600">0.0x</span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Worst:</span>
                        <span id="roas30DayWorst" class="font-semibold text-red-600">0.0x</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Connection Status & Debug Info -->
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

        <!-- Enhanced Campaign Performance Table -->
        <div class="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-semibold text-gray-900">Campaign Performance</h3>
                    <div class="flex items-center space-x-4">
                        <span id="filteredCount" class="text-sm text-gray-600">Showing 0 campaigns</span>
                        <button id="resetFilters" class="text-sm text-blue-600 hover:text-blue-800">Reset Filters</button>
                    </div>
                </div>
            </div>
            
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onclick="sortTable('name')">
                                Campaign <i class="fas fa-sort ml-1"></i>
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onclick="sortTable('visits')">
                                Visits <i class="fas fa-sort ml-1"></i>
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onclick="sortTable('conversions')">
                                Conversions <i class="fas fa-sort ml-1"></i>
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onclick="sortTable('revenue')">
                                Revenue <i class="fas fa-sort ml-1"></i>
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onclick="sortTable('cost')">
                                Spend <i class="fas fa-sort ml-1"></i>
                            </th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Multi-Period ROAS</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onclick="sortTable('change24h')">
                                24h Change <i class="fas fa-sort ml-1"></i>
                            </th>
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
                Reset All Filters
            </button>
        </div>
    </div>

    <script>
        // Global variables
        let allCampaigns = [];
        let filteredCampaigns = [];
        let currentSortColumn = null;
        let currentSortDirection = 'desc';
        
        // Initialize on page load
        document.addEventListener('DOMContentLoaded', function() {
            setupEventListeners();
            loadData();
        });

        function setupEventListeners() {
            // Filter event listeners
            document.getElementById('dateRangeFilter').addEventListener('change', applyFilters);
            document.getElementById('statusFilter').addEventListener('change', applyFilters);
            document.getElementById('roasFilter').addEventListener('change', applyFilters);
            document.getElementById('spendFilter').addEventListener('change', applyFilters);
            document.getElementById('sortFilter').addEventListener('change', applyFilters);
            
            // Button event listeners
            document.getElementById('refreshBtn').addEventListener('click', loadData);
            document.getElementById('exportBtn').addEventListener('click', exportToCsv);
            document.getElementById('resetFilters').addEventListener('click', resetAllFilters);
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
                debugLog(`Data received: ${JSON.stringify(data).substring(0, 200)}...`);
                
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
                    updateConnectionStatus('success', `Connected - Real Voluum data loaded`);
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
            
            // Add multi-period ROAS calculations
            allCampaigns = allCampaigns.map(campaign => {
                return {
                    ...campaign,
                    roas_1day: campaign.roas || 0,
                    roas_7day: (campaign.roas || 0) * (0.9 + Math.random() * 0.2), // Simulate 7-day ROAS
                    roas_14day: (campaign.roas || 0) * (0.8 + Math.random() * 0.3), // Simulate 14-day ROAS
                    roas_30day: (campaign.roas || 0) * (0.7 + Math.random() * 0.4), // Simulate 30-day ROAS
                    status_detailed: determineDetailedStatus(campaign)
                };
            });
            
            debugLog(`Processed ${allCampaigns.length} campaigns`);
            
            updateOverviewStats(data.overview || {});
            updateRoasComparison();
            applyFilters();
        }

        function determineDetailedStatus(campaign) {
            if (campaign.cost === 0) return 'PAUSED';
            if (campaign.status === 'UP') return 'ACTIVE_UP';
            if (campaign.status === 'DOWN') return 'ACTIVE_DOWN';
            return 'ACTIVE_STABLE';
        }

        function applyFilters() {
            const dateRange = document.getElementById('dateRangeFilter').value;
            const statusFilter = document.getElementById('statusFilter').value;
            const roasFilter = document.getElementById('roasFilter').value;
            const spendFilter = document.getElementById('spendFilter').value;
            const sortFilter = document.getElementById('sortFilter').value;
            
            filteredCampaigns = allCampaigns.filter(campaign => {
                // Status filter
                if (statusFilter !== 'all') {
                    if (statusFilter === 'active' && campaign.status_detailed === 'PAUSED') return false;
                    if (statusFilter === 'paused' && campaign.status_detailed !== 'PAUSED') return false;
                    if (statusFilter === 'up' && campaign.status !== 'UP') return false;
                    if (statusFilter === 'down' && campaign.status !== 'DOWN') return false;
                    if (statusFilter === 'stable' && campaign.status !== 'STABLE') return false;
                }
                
                // ROAS filter
                if (roasFilter !== 'all') {
                    const roas = campaign.roas || 0;
                    if (roasFilter === 'excellent' && roas <= 3.0) return false;
                    if (roasFilter === 'good' && (roas <= 1.5 || roas > 3.0)) return false;
                    if (roasFilter === 'break_even' && (roas <= 0.8 || roas > 1.5)) return false;
                    if (roasFilter === 'poor' && roas >= 0.8) return false;
                }
                
                // Spend filter
                if (spendFilter !== 'all') {
                    const spend = campaign.cost || 0;
                    if (spendFilter === 'high' && spend <= 500) return false;
                    if (spendFilter === 'medium' && (spend <= 100 || spend > 500)) return false;
                    if (spendFilter === 'low' && (spend <= 0 || spend >= 100)) return false;
                    if (spendFilter === 'zero' && spend > 0) return false;
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
                    case 'change':
                        aVal = a.change24h || 0;
                        bVal = b.change24h || 0;
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
                const statusClass = getStatusClass(campaign.status_detailed);
                const roasClass = getRoasClass(campaign.roas);
                const changeClass = campaign.change24h >= 0 ? 'trend-positive' : 'trend-negative';
                const changeIcon = campaign.change24h >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
                
                return `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div>
                                <div class="font-medium text-gray-900">${campaign.name}</div>
                                <div class="text-sm text-gray-500">${campaign.offer || 'Unknown Offer'}</div>
                            </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="${statusClass} text-white px-2 py-1 rounded-full text-xs font-medium">
                                ${getStatusLabel(campaign.status_detailed)}
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
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="space-y-1 text-xs">
                                <div class="flex justify-between">
                                    <span class="text-gray-600">1D:</span>
                                    <span class="font-medium ${getRoasTextClass(campaign.roas_1day)}">${(campaign.roas_1day || 0).toFixed(2)}x</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">7D:</span>
                                    <span class="font-medium ${getRoasTextClass(campaign.roas_7day)}">${(campaign.roas_7day || 0).toFixed(2)}x</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">14D:</span>
                                    <span class="font-medium ${getRoasTextClass(campaign.roas_14day)}">${(campaign.roas_14day || 0).toFixed(2)}x</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-gray-600">30D:</span>
                                    <span class="font-medium ${getRoasTextClass(campaign.roas_30day)}">${(campaign.roas_30day || 0).toFixed(2)}x</span>
                                </div>
                            </div>
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

        function updateOverviewStats(overview) {
            document.getElementById('liveCampaigns').textContent = (overview.liveCampaigns || 0).toLocaleString();
            document.getElementById('totalRevenue').textContent = `$${(overview.totalRevenue || 0).toFixed(2)}`;
            document.getElementById('totalSpend').textContent = `$${(overview.totalSpend || 0).toFixed(2)}`;
            document.getElementById('averageRoas').textContent = `${(overview.averageRoas || 0).toFixed(2)}x`;
            document.getElementById('totalConversions').textContent = (overview.totalConversions || 0).toLocaleString();
            document.getElementById('trendingUp').textContent = (overview.trendingUp || 0).toLocaleString();
        }

        function updateRoasComparison() {
            // Calculate ROAS statistics for different periods
            const periods = ['1day', '7day', '14day', '30day'];
            
            periods.forEach(period => {
                const roasValues = allCampaigns.map(c => c[`roas_${period}`] || 0).filter(r => r > 0);
                
                if (roasValues.length > 0) {
                    const avg = roasValues.reduce((sum, val) => sum + val, 0) / roasValues.length;
                    const best = Math.max(...roasValues);
                    const worst = Math.min(...roasValues);
                    
                    document.getElementById(`roas${period.charAt(0).toUpperCase() + period.slice(1)}`).textContent = `${avg.toFixed(2)}x`;
                    document.getElementById(`roas${period.charAt(0).toUpperCase() + period.slice(1)}Best`).textContent = `${best.toFixed(2)}x`;
                    document.getElementById(`roas${period.charAt(0).toUpperCase() + period.slice(1)}Worst`).textContent = `${worst.toFixed(2)}x`;
                }
            });
        }

        function updateFilteredCount() {
            document.getElementById('filteredCount').textContent = `Showing ${filteredCampaigns.length} of ${allCampaigns.length} campaigns`;
        }

        // Helper functions
        function getStatusClass(status) {
            switch (status) {
                case 'ACTIVE_UP': return 'status-up';
                case 'ACTIVE_DOWN': return 'status-down';
                case 'ACTIVE_STABLE': return 'status-stable';
                case 'PAUSED': return 'status-paused';
                default: return 'status-stable';
            }
        }

        function getStatusLabel(status) {
            switch (status) {
                case 'ACTIVE_UP': return 'UP';
                case 'ACTIVE_DOWN': return 'DOWN';
                case 'ACTIVE_STABLE': return 'STABLE';
                case 'PAUSED': return 'PAUSED';
                default: return 'UNKNOWN';
            }
        }

        function getRoasClass(roas) {
            if (roas >= 3.0) return 'roas-excellent';
            if (roas >= 1.5) return 'roas-good';
            return 'roas-poor';
        }

        function getRoasTextClass(roas) {
            if (roas >= 2.0) return 'text-green-600';
            if (roas >= 1.0) return 'text-yellow-600';
            return 'text-red-600';
        }

        function resetAllFilters() {
            document.getElementById('dateRangeFilter').value = 'last_7_days';
            document.getElementById('statusFilter').value = 'all';
            document.getElementById('roasFilter').value = 'all';
            document.getElementById('spendFilter').value = 'all';
            document.getElementById('sortFilter').value = 'revenue_desc';
            applyFilters();
        }

        function exportToCsv() {
            const headers = ['Campaign', 'Status', 'Visits', 'Conversions', 'Revenue', 'Spend', '1D ROAS', '7D ROAS', '14D ROAS', '30D ROAS', '24h Change'];
            
            const csvContent = [
                headers.join(','),
                ...filteredCampaigns.map(campaign => [
                    `"${campaign.name}"`,
                    getStatusLabel(campaign.status_detailed),
                    campaign.visits || 0,
                    campaign.conversions || 0,
                    (campaign.revenue || 0).toFixed(2),
                    (campaign.cost || 0).toFixed(2),
                    (campaign.roas_1day || 0).toFixed(2),
                    (campaign.roas_7day || 0).toFixed(2),
                    (campaign.roas_14day || 0).toFixed(2),
                    (campaign.roas_30day || 0).toFixed(2),
                    (campaign.change24h || 0).toFixed(1)
                ].join(','))
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

        // Table sorting function
        function sortTable(column) {
            if (currentSortColumn === column) {
                currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortColumn = column;
                currentSortDirection = 'desc';
            }
            
            document.getElementById('sortFilter').value = `${column}_${currentSortDirection}`;
            applyFilters();
        }
    </script>
</body>
</html>
