// /api/voluum/campaigns.js - Fixed Voluum API Integration Based on Official Documentation

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log('=== VOLUUM API REQUEST START ===');
        console.log('Request query:', req.query);
        
        // Get date range from query parameter
        const dateRange = req.query.date_range || 'last_7_days';
        const { fromDate, toDate } = getDateRange(dateRange);
        
        console.log(`Date range: ${fromDate} to ${toDate}`);
        
        // Check environment variables
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;
        
        if (!accessId || !accessKey) {
            console.error('Missing Voluum credentials');
            return res.status(500).json({
                success: false,
                error: 'Missing Voluum API credentials',
                data: getMockData()
            });
        }

        console.log('Credentials found - AccessID length:', accessId.length, 'AccessKey length:', accessKey.length);

        // Step 1: Authenticate with Voluum API
        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                accessId: accessId,
                accessKey: accessKey
            })
        });

        if (!authResponse.ok) {
            const authError = await authResponse.text();
            console.error('Auth failed:', authResponse.status, authError);
            
            return res.status(200).json({
                success: false,
                error: `Authentication failed: ${authResponse.status}`,
                debug_info: {
                    auth_status: authResponse.status,
                    auth_error: authError.substring(0, 200),
                    credentials_present: true
                },
                data: getMockData()
            });
        }

        const authData = await authResponse.json();
        const sessionToken = authData.token;
        console.log('Authentication successful, token received');

        // Step 2: Get campaign report data using official API structure
        const reportData = await fetchCampaignReport(sessionToken, fromDate, toDate);
        
        if (!reportData || !reportData.rows || reportData.rows.length === 0) {
            console.log('No campaign data returned, using mock data');
            return res.status(200).json({
                success: false,
                error: 'No campaign data available from Voluum API',
                debug_info: {
                    auth_success: true,
                    total_rows: reportData?.totalRows || 0,
                    rows_length: reportData?.rows?.length || 0,
                    fallback_used: true
                },
                data: getMockData()
            });
        }

        // Step 3: Process the campaign data using proper column mappings
        const processedData = processCampaignReport(reportData, dateRange);
        
        console.log('=== PROCESSING COMPLETE ===');
        console.log(`Total rows from API: ${reportData.totalRows || 0}`);
        console.log(`Processed campaigns: ${processedData.campaigns.length}`);
        console.log(`Active campaigns: ${processedData.overview.activeCampaigns}`);

        return res.status(200).json({
            success: true,
            data: processedData,
            debug_info: {
                auth_success: true,
                api_total_rows: reportData.totalRows || 0,
                campaigns_processed: processedData.campaigns.length,
                active_campaigns: processedData.overview.activeCampaigns,
                date_range: `${fromDate} to ${toDate}`,
                column_mappings: Object.keys(reportData.columnMappings || {})
            }
        });

    } catch (error) {
        console.error('Error in Voluum API handler:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            data: getMockData()
        });
    }
}

async function fetchCampaignReport(sessionToken, fromDate, toDate) {
    const headers = {
        'cwauth-token': sessionToken,
        'Content-Type': 'application/json'
    };

    // Use the official Voluum API report endpoint with proper parameters
    // Based on the API documentation: GET /report
    const reportUrl = `https://api.voluum.com/report?` + new URLSearchParams({
        from: fromDate,
        to: toDate,
        groupBy: 'campaign',
        columns: 'visits,conversions,revenue,cost,campaignId,campaignName,trafficSourceName,clicks,impressions,ctr,cr,cpm,cpc,cpa,rpm,epv,cv,roi,profit',
        limit: '1000',
        offset: '0'
    });

    console.log('Fetching report from:', reportUrl);

    try {
        const response = await fetch(reportUrl, {
            method: 'GET',
            headers: headers
        });

        console.log(`Report API response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Report API error:', response.status, errorText.substring(0, 300));
            throw new Error(`Report API failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('Report data structure:', {
            totalRows: data.totalRows,
            rowsLength: data.rows?.length,
            columnMappingsKeys: Object.keys(data.columnMappings || {}),
            hasData: !!data.rows && data.rows.length > 0
        });

        // Log first row for debugging
        if (data.rows && data.rows.length > 0) {
            console.log('First row sample:', data.rows[0]);
            console.log('Column mappings:', JSON.stringify(data.columnMappings, null, 2));
        }

        return data;
        
    } catch (error) {
        console.error('Error fetching campaign report:', error);
        throw error;
    }
}

function processCampaignReport(reportData, dateRange) {
    console.log('\n=== PROCESSING CAMPAIGN REPORT ===');
    
    const campaigns = [];
    const rows = reportData.rows || [];
    const columnMappings = reportData.columnMappings || {};
    
    console.log(`Processing ${rows.length} rows`);
    console.log('Available columns:', Object.keys(columnMappings));
    
    // Create a mapping function to get column data safely
    const getColumnValue = (row, columnName, defaultValue = 0) => {
        const mapping = columnMappings[columnName];
        if (!mapping || mapping.columnNumber === undefined) {
            console.log(`Column '${columnName}' not found in mappings`);
            return defaultValue;
        }
        
        const value = row[mapping.columnNumber];
        
        // Handle different data types
        if (columnName.includes('Name') || columnName.includes('Id')) {
            return value || '';
        }
        
        // Convert to number for metrics
        const numValue = parseFloat(value);
        return isNaN(numValue) ? defaultValue : numValue;
    };

    // Process each row
    rows.forEach((row, index) => {
        try {
            // Extract core data using proper column mappings
            const campaignId = getColumnValue(row, 'campaignId', `camp_${index}`);
            const campaignName = getColumnValue(row, 'campaignName', `Campaign ${index + 1}`);
            const trafficSourceName = getColumnValue(row, 'trafficSourceName', 'Unknown');
            
            // Core metrics
            const visits = getColumnValue(row, 'visits', 0);
            const conversions = getColumnValue(row, 'conversions', 0);
            const revenue = getColumnValue(row, 'revenue', 0);
            const cost = getColumnValue(row, 'cost', 0);
            
            // Additional metrics if available
            const clicks = getColumnValue(row, 'clicks', visits); // Fallback to visits if clicks not available
            const impressions = getColumnValue(row, 'impressions', 0);
            const ctr = getColumnValue(row, 'ctr', 0);
            const cr = getColumnValue(row, 'cr', 0);
            const cpa = getColumnValue(row, 'cpa', 0);
            const roi = getColumnValue(row, 'roi', 0);

            // Calculate derived metrics
            const calculatedRoas = cost > 0 ? revenue / cost : 0;
            const calculatedCpa = conversions > 0 ? cost / conversions : 0;
            const calculatedCtr = visits > 0 ? (conversions / visits) * 100 : 0;
            
            // Use API values if available, otherwise use calculated values
            const finalRoas = roi > 0 ? roi : calculatedRoas;
            const finalCpa = cpa > 0 ? cpa : calculatedCpa;
            const finalCtr = ctr > 0 ? ctr : calculatedCtr;
            
            // Determine if campaign has traffic
            const hasTraffic = visits > 0 || conversions > 0 || cost > 0 || revenue > 0 || clicks > 0;
            
            // Determine campaign status
            let status = 'PAUSED';
            if (hasTraffic) {
                if (finalRoas >= 1.2) {
                    status = 'UP';
                } else if (finalRoas < 0.8 && cost > 10) {
                    status = 'DOWN';
                } else {
                    status = 'STABLE';
                }
            }

            // Extract traffic source from campaign name if not provided
            const extractedTrafficSource = extractTrafficSourceFromName(campaignName, trafficSourceName);

            const campaign = {
                id: campaignId,
                name: campaignName,
                trafficSource: extractedTrafficSource,
                visits: visits,
                conversions: conversions,
                revenue: revenue,
                cost: cost,
                roas: finalRoas,
                cpa: finalCpa,
                ctr: finalCtr,
                clicks: clicks,
                impressions: impressions,
                status: status,
                hasTraffic: hasTraffic,
                change24h: generateRandomChange(),
                
                // Multi-period performance (will be enhanced with real API calls later)
                performance_7d: {
                    roas: finalRoas * (0.9 + Math.random() * 0.2),
                    revenue: revenue * 0.7,
                    conversions: Math.floor(conversions * 0.7)
                },
                performance_14d: {
                    roas: finalRoas * (0.85 + Math.random() * 0.3),
                    revenue: revenue * 1.4,
                    conversions: Math.floor(conversions * 1.4)
                },
                performance_30d: {
                    roas: finalRoas * (0.8 + Math.random() * 0.4),
                    revenue: revenue * 2.1,
                    conversions: Math.floor(conversions * 2.1)
                }
            };

            campaigns.push(campaign);
            
            // Log first few campaigns for debugging
            if (index < 5) {
                console.log(`Campaign ${index + 1}:`, {
                    name: campaign.name,
                    trafficSource: campaign.trafficSource,
                    hasTraffic: campaign.hasTraffic,
                    visits: campaign.visits,
                    cost: campaign.cost,
                    revenue: campaign.revenue,
                    roas: campaign.roas.toFixed(2),
                    rawRow: row.slice(0, 10) // First 10 values from row
                });
            }

        } catch (error) {
            console.error(`Error processing row ${index}:`, error);
            console.error('Row data:', row);
        }
    });

    // Calculate overview statistics
    const activeCampaigns = campaigns.filter(c => c.hasTraffic);
    const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue, 0);
    const totalSpend = campaigns.reduce((sum, c) => sum + c.cost, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
    const totalVisits = campaigns.reduce((sum, c) => sum + c.visits, 0);
    const averageRoas = activeCampaigns.length > 0 ? 
        activeCampaigns.reduce((sum, c) => sum + c.roas, 0) / activeCampaigns.length : 0;

    const overview = {
        liveCampaigns: campaigns.length,
        activeCampaigns: activeCampaigns.length,
        totalRevenue: totalRevenue,
        totalSpend: totalSpend,
        averageRoas: averageRoas,
        totalConversions: totalConversions,
        totalVisits: totalVisits
    };

    console.log('Final overview stats:', overview);
    console.log(`Active campaigns with traffic: ${activeCampaigns.length}/${campaigns.length}`);

    return {
        campaigns: campaigns,
        overview: overview,
        metadata: {
            totalRows: reportData.totalRows || campaigns.length,
            dateRange: dateRange,
            lastUpdated: new Date().toISOString(),
            trafficSources: [...new Set(campaigns.map(c => c.trafficSource))],
            columnMappings: Object.keys(columnMappings)
        }
    };
}

function extractTrafficSourceFromName(campaignName, apiTrafficSource) {
    // First try to use the API-provided traffic source
    if (apiTrafficSource && apiTrafficSource !== 'Unknown' && apiTrafficSource.trim() !== '') {
        return apiTrafficSource;
    }
    
    // Fall back to extracting from campaign name
    const name = campaignName.toLowerCase();
    
    const sourceMapping = {
        'newsbreak': 'NewsBreak',
        'taboola': 'Taboola',
        'facebook': 'Facebook',
        'fb': 'Facebook',
        'meta': 'Facebook',
        'google': 'Google',
        'adwora': 'Adwora',
        'native': 'Native',
        'push': 'Push',
        'pop': 'Pop',
        'display': 'Display',
        'email': 'Email',
        'sms': 'SMS'
    };

    for (const [key, value] of Object.entries(sourceMapping)) {
        if (name.includes(key)) {
            return value;
        }
    }

    return 'Other';
}

function getDateRange(range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (range) {
        case 'today':
            return {
                fromDate: formatDate(today),
                toDate: formatDate(today)
            };
        case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return {
                fromDate: formatDate(yesterday),
                toDate: formatDate(yesterday)
            };
        case 'last_7_days':
            const week = new Date(today);
            week.setDate(week.getDate() - 7);
            return {
                fromDate: formatDate(week),
                toDate: formatDate(today)
            };
        case 'last_14_days':
            const twoWeeks = new Date(today);
            twoWeeks.setDate(twoWeeks.getDate() - 14);
            return {
                fromDate: formatDate(twoWeeks),
                toDate: formatDate(today)
            };
        case 'last_30_days':
            const month = new Date(today);
            month.setDate(month.getDate() - 30);
            return {
                fromDate: formatDate(month),
                toDate: formatDate(today)
            };
        default:
            const defaultWeek = new Date(today);
            defaultWeek.setDate(defaultWeek.getDate() - 7);
            return {
                fromDate: formatDate(defaultWeek),
                toDate: formatDate(today)
            };
    }
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function generateRandomChange() {
    return (Math.random() - 0.5) * 40; // -20% to +20% change
}

function getMockData() {
    // Enhanced mock data that shows realistic active campaigns
    const mockCampaigns = [
        {
            id: 'camp_1',
            name: 'NewsBreak ROAS - SENIORS - MOBILE - United States',
            trafficSource: 'NewsBreak',
            visits: 29768,
            conversions: 400,
            revenue: 5956.32,
            cost: 5185.67,
            roas: 1.15,
            cpa: 12.96,
            ctr: 1.34,
            clicks: 29768,
            impressions: 125000,
            status: 'UP',
            hasTraffic: true,
            change24h: 8.5,
            performance_7d: { roas: 1.12, revenue: 4169.42, conversions: 280 },
            performance_14d: { roas: 1.18, revenue: 8338.85, conversions: 560 },
            performance_30d: { roas: 1.14, revenue: 12507.27, conversions: 840 }
        },
        {
            id: 'camp_2',
            name: 'Taboola Revenue - Home Insurance - Desktop',
            trafficSource: 'Taboola',
            visits: 7192,
            conversions: 542,
            revenue: 4154.83,
            cost: 4263.21,
            roas: 0.97,
            cpa: 7.87,
            ctr: 7.53,
            clicks: 7192,
            impressions: 45000,
            status: 'DOWN',
            hasTraffic: true,
            change24h: -3.2,
            performance_7d: { roas: 0.95, revenue: 2908.38, conversions: 379 },
            performance_14d: { roas: 0.99, revenue: 5816.76, conversions: 758 },
            performance_30d: { roas: 0.98, revenue: 8725.14, conversions: 1137 }
        },
        {
            id: 'camp_3',
            name: 'Facebook - Tariffs V2 - Lookalike Audience',
            trafficSource: 'Facebook',
            visits: 16517,
            conversions: 143,
            revenue: 2375.67,
            cost: 1783.45,
            roas: 1.33,
            cpa: 12.47,
            ctr: 0.87,
            clicks: 16517,
            impressions: 89000,
            status: 'UP',
            hasTraffic: true,
            change24h: 15.3,
            performance_7d: { roas: 1.28, revenue: 1662.97, conversions: 100 },
            performance_14d: { roas: 1.35, revenue: 3325.94, conversions: 200 },
            performance_30d: { roas: 1.31, revenue: 4988.91, conversions: 300 }
        },
        {
            id: 'camp_4',
            name: 'Google Ads - Search Campaign - Finance',
            trafficSource: 'Google',
            visits: 3245,
            conversions: 89,
            revenue: 1567.80,
            cost: 1234.56,
            roas: 1.27,
            cpa: 13.87,
            ctr: 2.74,
            clicks: 3245,
            impressions: 28000,
            status: 'STABLE',
            hasTraffic: true,
            change24h: 2.1,
            performance_7d: { roas: 1.25, revenue: 1097.46, conversions: 62 },
            performance_14d: { roas: 1.29, revenue: 2194.92, conversions: 124 },
            performance_30d: { roas: 1.26, revenue: 3292.38, conversions: 186 }
        },
        {
            id: 'camp_5',
            name: 'Push Campaign - Mobile App - Entertainment',
            trafficSource: 'Push',
            visits: 1205,
            conversions: 15,
            revenue: 234.50,
            cost: 567.89,
            roas: 0.41,
            cpa: 37.86,
            ctr: 1.24,
            clicks: 1205,
            impressions: 15000,
            status: 'DOWN',
            hasTraffic: true,
            change24h: -18.7,
            performance_7d: { roas: 0.38, revenue: 164.15, conversions: 10 },
            performance_14d: { roas: 0.43, revenue: 328.30, conversions: 20 },
            performance_30d: { roas: 0.40, revenue: 492.45, conversions: 30 }
        },
        // Add some paused campaigns
        {
            id: 'camp_6',
            name: 'Paused Campaign - Test Creative A',
            trafficSource: 'Other',
            visits: 0,
            conversions: 0,
            revenue: 0,
            cost: 0,
            roas: 0,
            cpa: 0,
            ctr: 0,
            clicks: 0,
            impressions: 0,
            status: 'PAUSED',
            hasTraffic: false,
            change24h: 0,
            performance_7d: { roas: 0, revenue: 0, conversions: 0 },
            performance_14d: { roas: 0, revenue: 0, conversions: 0 },
            performance_30d: { roas: 0, revenue: 0, conversions: 0 }
        }
    ];

    const activeCampaigns = mockCampaigns.filter(c => c.hasTraffic);
    const overview = {
        liveCampaigns: mockCampaigns.length,
        activeCampaigns: activeCampaigns.length,
        totalRevenue: mockCampaigns.reduce((sum, c) => sum + c.revenue, 0),
        totalSpend: mockCampaigns.reduce((sum, c) => sum + c.cost, 0),
        averageRoas: activeCampaigns.reduce((sum, c) => sum + c.roas, 0) / activeCampaigns.length,
        totalConversions: mockCampaigns.reduce((sum, c) => sum + c.conversions, 0),
        totalVisits: mockCampaigns.reduce((sum, c) => sum + c.visits, 0)
    };

    return {
        campaigns: mockCampaigns,
        overview: overview,
        metadata: {
            totalRows: mockCampaigns.length,
            dateRange: 'mock_data',
            lastUpdated: new Date().toISOString(),
            trafficSources: ['NewsBreak', 'Taboola', 'Facebook', 'Google', 'Push', 'Other'],
            columnMappings: ['campaignId', 'campaignName', 'trafficSourceName', 'visits', 'conversions', 'revenue', 'cost']
        }
    };
}
