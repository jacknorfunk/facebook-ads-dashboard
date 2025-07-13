// /api/voluum/campaigns-simple.js - Simplified Voluum API for Debugging

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const debugLogs = [];
    
    function log(message) {
        const timestamp = new Date().toISOString();
        debugLogs.push(`[${timestamp}] ${message}`);
        console.log(message);
    }

    try {
        log('=== SIMPLIFIED VOLUUM API START ===');
        
        // Get parameters
        const dateRange = req.query.date_range || 'last_7_days';
        log(`Date range requested: ${dateRange}`);
        
        // Check environment variables
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;
        
        log(`Environment check - AccessID exists: ${!!accessId}, AccessKey exists: ${!!accessKey}`);
        
        if (!accessId || !accessKey) {
            log('ERROR: Missing environment variables');
            return res.status(200).json({
                success: false,
                error: 'Missing Voluum API credentials',
                debug_logs: debugLogs,
                data: getMockData()
            });
        }

        log(`Credentials found - AccessID: ${accessId.length} chars, AccessKey: ${accessKey.length} chars`);

        // Step 1: Simple authentication test
        log('Starting authentication with Voluum...');
        
        const authPayload = {
            accessId: accessId,
            accessKey: accessKey
        };
        
        log(`Auth payload prepared: ${JSON.stringify(authPayload).substring(0, 100)}...`);
        
        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(authPayload)
        });

        log(`Auth response status: ${authResponse.status}`);
        log(`Auth response ok: ${authResponse.ok}`);
        
        const authResponseText = await authResponse.text();
        log(`Auth response length: ${authResponseText.length} characters`);
        log(`Auth response preview: ${authResponseText.substring(0, 200)}`);

        if (!authResponse.ok) {
            log(`AUTH FAILED - Status: ${authResponse.status}`);
            return res.status(200).json({
                success: false,
                error: `Authentication failed: ${authResponse.status}`,
                debug_logs: debugLogs,
                auth_details: {
                    status: authResponse.status,
                    response_preview: authResponseText.substring(0, 500)
                },
                data: getMockData()
            });
        }

        let authData;
        try {
            authData = JSON.parse(authResponseText);
            log(`Auth successful - Token received: ${!!authData.token}`);
        } catch (parseError) {
            log(`ERROR: Could not parse auth response as JSON: ${parseError.message}`);
            return res.status(200).json({
                success: false,
                error: 'Invalid auth response format',
                debug_logs: debugLogs,
                data: getMockData()
            });
        }

        const sessionToken = authData.token;
        if (!sessionToken) {
            log('ERROR: No token in auth response');
            return res.status(200).json({
                success: false,
                error: 'No session token received',
                debug_logs: debugLogs,
                data: getMockData()
            });
        }

        // Step 2: Simple data fetch
        log('Fetching campaign data...');
        
        const { fromDate, toDate } = getDateRange(dateRange);
        log(`Date range: ${fromDate} to ${toDate}`);
        
        // Use the simplest possible report endpoint with higher limit
        const reportUrl = `https://api.voluum.com/report?from=${fromDate}&to=${toDate}&groupBy=campaign&limit=1000`;
        log(`Report URL: ${reportUrl}`);
        
        const reportResponse = await fetch(reportUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': sessionToken,
                'Content-Type': 'application/json'
            }
        });

        log(`Report response status: ${reportResponse.status}`);
        log(`Report response ok: ${reportResponse.ok}`);

        if (!reportResponse.ok) {
            const reportError = await reportResponse.text();
            log(`REPORT FAILED - Status: ${reportResponse.status}, Error: ${reportError.substring(0, 200)}`);
            return res.status(200).json({
                success: false,
                error: `Report fetch failed: ${reportResponse.status}`,
                debug_logs: debugLogs,
                report_details: {
                    status: reportResponse.status,
                    error_preview: reportError.substring(0, 500)
                },
                data: getMockData()
            });
        }

        const reportData = await reportResponse.json();
        log(`Report data received - Total rows: ${reportData.totalRows || 0}`);
        log(`Report data structure: ${Object.keys(reportData).join(', ')}`);
        
        if (reportData.rows) {
            log(`First row sample: ${JSON.stringify(reportData.rows[0] || []).substring(0, 200)}`);
        }
        
        if (reportData.columnMappings) {
            log(`Column mappings: ${Object.keys(reportData.columnMappings).join(', ')}`);
        }

        // Step 3: Simple processing
        const processedData = processSimpleData(reportData, debugLogs);
        
        log(`Processing complete - ${processedData.campaigns.length} campaigns processed`);
        log(`Active campaigns: ${processedData.overview.activeCampaigns}`);

        return res.status(200).json({
            success: true,
            data: processedData,
            debug_logs: debugLogs,
            raw_data_preview: {
                total_rows: reportData.totalRows,
                columns: Object.keys(reportData.columnMappings || {}),
                first_row: reportData.rows ? reportData.rows[0] : null
            }
        });

    } catch (error) {
        log(`CRITICAL ERROR: ${error.message}`);
        log(`Error stack: ${error.stack}`);
        
        return res.status(500).json({
            success: false,
            error: error.message,
            debug_logs: debugLogs,
            data: getMockData()
        });
    }
}

function processSimpleData(reportData, debugLogs) {
    debugLogs.push('Processing report data...');
    
    const campaigns = [];
    const rows = reportData.rows || [];
    
    debugLogs.push(`Processing ${rows.length} rows - Data format: ${typeof rows[0]}`);
    
    // Log structure of first row for debugging
    if (rows[0]) {
        debugLogs.push(`First row keys: ${Object.keys(rows[0]).slice(0, 10).join(', ')}...`);
        debugLogs.push(`Sample values: name="${rows[0].campaignName}", visits=${rows[0].visits}, revenue=${rows[0].revenue}`);
    }
    
    // Process each row - no limit, process all campaigns
    rows.forEach((row, index) => {
        try {
            // Extract data directly from object properties
            const campaignId = row.campaignId || `camp_${index}`;
            const campaignName = row.campaignName || `Campaign ${index + 1}`;
            const trafficSourceName = row.trafficSourceName || 'Unknown';
            
            // Core metrics - directly from object properties
            const visits = parseFloat(row.visits || 0);
            const conversions = parseFloat(row.conversions || 0);
            const revenue = parseFloat(row.revenue || 0);
            const cost = parseFloat(row.cost || 0);
            const clicks = parseFloat(row.clicks || 0);
            const impressions = parseFloat(row.impressions || 0);
            
            // Additional metrics if available
            const existingCpa = parseFloat(row.cpa || 0);
            const existingCtr = parseFloat(row.ctr || 0);
            const existingRoi = parseFloat(row.roi || 0);
            
            // Calculate derived metrics
            const calculatedRoas = cost > 0 ? revenue / cost : 0;
            const calculatedCpa = conversions > 0 ? cost / conversions : 0;
            const calculatedCtr = visits > 0 ? (conversions / visits) * 100 : 0;
            
            // Use API values if available, otherwise calculated
            const finalRoas = existingRoi > 0 ? existingRoi : calculatedRoas;
            const finalCpa = existingCpa > 0 ? existingCpa : calculatedCpa;
            const finalCtr = existingCtr > 0 ? existingCtr : calculatedCtr;
            
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
            
            // Extract traffic source (use API value or extract from name)
            const extractedTrafficSource = trafficSourceName !== 'Unknown' ? 
                trafficSourceName : extractTrafficSource(campaignName);

            const campaign = {
                id: campaignId,
                name: campaignName,
                trafficSource: extractedTrafficSource,
                visits: visits,
                conversions: conversions,
                revenue: revenue,
                cost: cost,
                clicks: clicks,
                impressions: impressions,
                roas: finalRoas,
                cpa: finalCpa,
                ctr: finalCtr,
                status: status,
                hasTraffic: hasTraffic,
                change24h: generateRandomChange(),
                
                // Multi-period data (mock for now)
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
                debugLogs.push(`Campaign ${index + 1}: "${campaign.name}" | Source: ${campaign.trafficSource} | Traffic: ${campaign.hasTraffic} | Visits: ${campaign.visits} | Revenue: ${campaign.revenue} | Cost: ${campaign.cost} | ROAS: ${campaign.roas.toFixed(2)}`);
            }
            
        } catch (error) {
            debugLogs.push(`Error processing row ${index}: ${error.message}`);
            if (index < 3) {
                debugLogs.push(`Row ${index} structure: ${JSON.stringify(row).substring(0, 200)}...`);
            }
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
    
    debugLogs.push(`Final Overview: ${overview.liveCampaigns} total campaigns, ${overview.activeCampaigns} active, ${overview.totalRevenue.toFixed(2)} revenue, ${overview.totalSpend.toFixed(2)} spend`);
    
    // Log traffic source breakdown
    const trafficSources = campaigns.reduce((acc, campaign) => {
        acc[campaign.trafficSource] = (acc[campaign.trafficSource] || 0) + 1;
        return acc;
    }, {});
    debugLogs.push(`Traffic sources: ${JSON.stringify(trafficSources)}`);
    
    return {
        campaigns: campaigns,
        overview: overview,
        metadata: {
            totalRows: reportData.totalRows || campaigns.length,
            dateRange: 'processed',
            lastUpdated: new Date().toISOString(),
            trafficSources: Object.keys(trafficSources)
        }
    };
}

function generateRandomChange() {
    return (Math.random() - 0.5) * 40; // -20% to +20% change
}

function extractTrafficSource(campaignName) {
    const name = (campaignName || '').toLowerCase();
    
    if (name.includes('newsbreak')) return 'NewsBreak';
    if (name.includes('taboola')) return 'Taboola';
    if (name.includes('facebook') || name.includes('fb')) return 'Facebook';
    if (name.includes('google')) return 'Google';
    if (name.includes('adwora')) return 'Adwora';
    
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

function getMockData() {
    const mockCampaigns = [
        {
            id: 'camp_1',
            name: 'NewsBreak ROAS - SENIORS - MOBILE',
            trafficSource: 'NewsBreak',
            visits: 29768,
            conversions: 400,
            revenue: 5956.32,
            cost: 5185.67,
            roas: 1.15,
            cpa: 12.96,
            ctr: 1.34,
            status: 'UP',
            hasTraffic: true,
            change24h: 8.5
        },
        {
            id: 'camp_2',
            name: 'Taboola Revenue - Home Insurance',
            trafficSource: 'Taboola',
            visits: 7192,
            conversions: 542,
            revenue: 4154.83,
            cost: 4263.21,
            roas: 0.97,
            cpa: 7.87,
            ctr: 7.53,
            status: 'DOWN',
            hasTraffic: true,
            change24h: -3.2
        }
    ];

    return {
        campaigns: mockCampaigns,
        overview: {
            liveCampaigns: mockCampaigns.length,
            activeCampaigns: mockCampaigns.filter(c => c.hasTraffic).length,
            totalRevenue: mockCampaigns.reduce((sum, c) => sum + c.revenue, 0),
            totalSpend: mockCampaigns.reduce((sum, c) => sum + c.cost, 0),
            averageRoas: 1.06,
            totalConversions: mockCampaigns.reduce((sum, c) => sum + c.conversions, 0)
        },
        metadata: {
            totalRows: mockCampaigns.length,
            dateRange: 'mock_data',
            lastUpdated: new Date().toISOString()
        }
    };
}
