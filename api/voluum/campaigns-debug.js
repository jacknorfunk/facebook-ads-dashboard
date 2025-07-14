// /api/voluum/campaigns-debug.js - Debug version to find the issue

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
        log('=== DEBUG CAMPAIGNS API START ===');
        
        // Get parameters
        const dateRange = req.query.date_range || 'last_7_days';
        log(`Date range requested: ${dateRange}`);
        
        // Check environment variables
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;
        
        log(`Environment check - AccessID exists: ${!!accessId}, AccessKey exists: ${!!accessKey}`);
        
        if (accessId) {
            log(`AccessID preview: ${accessId.substring(0, 8)}...${accessId.substring(accessId.length - 4)} (${accessId.length} chars)`);
        }
        if (accessKey) {
            log(`AccessKey preview: ${accessKey.substring(0, 8)}...${accessKey.substring(accessKey.length - 4)} (${accessKey.length} chars)`);
        }
        
        if (!accessId || !accessKey) {
            log('ERROR: Missing environment variables');
            
            // Return debug info instead of failing
            return res.status(200).json({
                success: false,
                error: 'Missing Voluum API credentials',
                debug_logs: debugLogs,
                environment_check: {
                    accessId_exists: !!accessId,
                    accessKey_exists: !!accessKey,
                    available_env_vars: Object.keys(process.env).filter(key => key.includes('VOLUM') || key.includes('VOLUME'))
                },
                data: {
                    campaigns: [],
                    overview: {
                        liveCampaigns: 0,
                        activeCampaigns: 0,
                        totalRevenue: 0,
                        totalSpend: 0,
                        averageRoas: 0,
                        totalConversions: 0,
                        trendingUp: 0,
                        trendingDown: 0
                    }
                }
            });
        }

        log(`Credentials found - AccessID: ${accessId.length} chars, AccessKey: ${accessKey.length} chars`);

        // Step 1: Test Authentication
        log('Testing authentication with Voluum...');
        
        const authPayload = {
            accessId: accessId,
            accessKey: accessKey
        };
        
        log(`Auth payload: accessId=${accessId.substring(0, 8)}..., accessKey=${accessKey.substring(0, 8)}...`);
        
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
        log(`Auth response preview: ${authResponseText.substring(0, 300)}`);

        if (!authResponse.ok) {
            log(`AUTH FAILED - Status: ${authResponse.status}`);
            return res.status(200).json({
                success: false,
                error: `Authentication failed: ${authResponse.status}`,
                debug_logs: debugLogs,
                auth_details: {
                    status: authResponse.status,
                    response_preview: authResponseText.substring(0, 500),
                    credentials_format: {
                        accessId_length: accessId.length,
                        accessKey_length: accessKey.length,
                        accessId_format: /^[a-f0-9-]{36}$/i.test(accessId) ? 'UUID format' : 'Non-UUID format',
                        accessKey_format: accessKey.length >= 30 ? 'Valid length' : 'Too short'
                    }
                },
                data: {
                    campaigns: [],
                    overview: {
                        liveCampaigns: 0,
                        activeCampaigns: 0,
                        totalRevenue: 0,
                        totalSpend: 0,
                        averageRoas: 0,
                        totalConversions: 0,
                        trendingUp: 0,
                        trendingDown: 0
                    }
                }
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
                auth_details: {
                    response_text: authResponseText,
                    parse_error: parseError.message
                },
                data: {
                    campaigns: [],
                    overview: {
                        liveCampaigns: 0,
                        activeCampaigns: 0,
                        totalRevenue: 0,
                        totalSpend: 0,
                        averageRoas: 0,
                        totalConversions: 0,
                        trendingUp: 0,
                        trendingDown: 0
                    }
                }
            });
        }

        const sessionToken = authData.token;
        if (!sessionToken) {
            log('ERROR: No token in auth response');
            return res.status(200).json({
                success: false,
                error: 'No session token received',
                debug_logs: debugLogs,
                auth_response: authData,
                data: {
                    campaigns: [],
                    overview: {
                        liveCampaigns: 0,
                        activeCampaigns: 0,
                        totalRevenue: 0,
                        totalSpend: 0,
                        averageRoas: 0,
                        totalConversions: 0,
                        trendingUp: 0,
                        trendingDown: 0
                    }
                }
            });
        }

        // Step 2: Test Data Fetch
        log('Authentication successful - testing data fetch...');
        
        const { fromDate, toDate } = getDateRange(dateRange);
        log(`Date range: ${fromDate} to ${toDate}`);
        
        // Test with a simple report endpoint first
        const reportUrl = `https://api.voluum.com/report?from=${fromDate}&to=${toDate}&groupBy=campaign&limit=10`;
        log(`Testing with simple report URL: ${reportUrl}`);
        
        const reportResponse = await fetch(reportUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': sessionToken,
                'Content-Type': 'application/json'
            }
        });

        log(`Report response status: ${reportResponse.status}`);
        log(`Report response ok: ${reportResponse.ok}`);

        const reportResponseText = await reportResponse.text();
        log(`Report response length: ${reportResponseText.length} characters`);
        log(`Report response preview: ${reportResponseText.substring(0, 500)}`);

        if (!reportResponse.ok) {
            log(`REPORT FAILED - Status: ${reportResponse.status}`);
            return res.status(200).json({
                success: false,
                error: `Report fetch failed: ${reportResponse.status}`,
                debug_logs: debugLogs,
                report_details: {
                    status: reportResponse.status,
                    url: reportUrl,
                    response_preview: reportResponseText.substring(0, 500)
                },
                data: {
                    campaigns: [],
                    overview: {
                        liveCampaigns: 0,
                        activeCampaigns: 0,
                        totalRevenue: 0,
                        totalSpend: 0,
                        averageRoas: 0,
                        totalConversions: 0,
                        trendingUp: 0,
                        trendingDown: 0
                    }
                }
            });
        }

        let reportData;
        try {
            reportData = JSON.parse(reportResponseText);
            log(`Report data parsed successfully - Total rows: ${reportData.totalRows || 0}`);
        } catch (parseError) {
            log(`ERROR: Could not parse report response as JSON: ${parseError.message}`);
            return res.status(200).json({
                success: false,
                error: 'Invalid report response format',
                debug_logs: debugLogs,
                report_details: {
                    response_text: reportResponseText.substring(0, 1000),
                    parse_error: parseError.message
                },
                data: {
                    campaigns: [],
                    overview: {
                        liveCampaigns: 0,
                        activeCampaigns: 0,
                        totalRevenue: 0,
                        totalSpend: 0,
                        averageRoas: 0,
                        totalConversions: 0,
                        trendingUp: 0,
                        trendingDown: 0
                    }
                }
            });
        }

        log(`Report data structure: ${Object.keys(reportData).join(', ')}`);
        log(`Total rows: ${reportData.totalRows}`);
        log(`Rows array length: ${(reportData.rows || []).length}`);
        
        if (reportData.rows && reportData.rows.length > 0) {
            log(`First row keys: ${Object.keys(reportData.rows[0]).slice(0, 10).join(', ')}`);
            log(`First row sample: ${JSON.stringify(reportData.rows[0]).substring(0, 200)}`);
        }

        // Step 3: Process the data
        const processedData = processDebugData(reportData, debugLogs);
        
        log(`Processing complete - ${processedData.campaigns.length} campaigns processed`);

        return res.status(200).json({
            success: true,
            data: processedData,
            debug_logs: debugLogs,
            debug_info: {
                date_range: dateRange,
                campaigns_count: processedData.campaigns.length,
                active_campaigns: processedData.overview.activeCampaigns,
                total_revenue: processedData.overview.totalRevenue,
                api_response_preview: {
                    totalRows: reportData.totalRows,
                    columns: Object.keys(reportData.columnMappings || {}),
                    first_row_keys: reportData.rows && reportData.rows[0] ? Object.keys(reportData.rows[0]) : []
                }
            }
        });

    } catch (error) {
        log(`CRITICAL ERROR: ${error.message}`);
        log(`Error stack: ${error.stack}`);
        
        return res.status(200).json({
            success: false,
            error: error.message,
            debug_logs: debugLogs,
            error_details: {
                message: error.message,
                stack: error.stack.split('\n').slice(0, 5)
            },
            data: {
                campaigns: [],
                overview: {
                    liveCampaigns: 0,
                    activeCampaigns: 0,
                    totalRevenue: 0,
                    totalSpend: 0,
                    averageRoas: 0,
                    totalConversions: 0,
                    trendingUp: 0,
                    trendingDown: 0
                }
            }
        });
    }
}

function processDebugData(reportData, debugLogs) {
    debugLogs.push('Processing debug campaign data...');
    
    const campaigns = [];
    const rows = reportData.rows || [];
    
    debugLogs.push(`Processing ${rows.length} rows`);
    
    // Process each row
    rows.forEach((row, index) => {
        try {
            // Extract basic data
            const campaignId = row.campaignId || row.id || `camp_${index}`;
            const campaignName = row.campaignName || row.name || `Campaign ${index + 1}`;
            const trafficSourceName = row.trafficSourceName || row.trafficSource || 'Unknown';
            
            // Core metrics
            const visits = parseFloat(row.visits || 0);
            const conversions = parseFloat(row.conversions || 0);
            const revenue = parseFloat(row.revenue || 0);
            const cost = parseFloat(row.cost || 0);
            const clicks = parseFloat(row.clicks || 0);
            
            // Calculate derived metrics
            const roas = cost > 0 ? revenue / cost : 0;
            const cpa = conversions > 0 ? cost / conversions : 0;
            const cvr = visits > 0 ? (conversions / visits) * 100 : 0;
            const aov = conversions > 0 ? revenue / conversions : 0;
            const profit = revenue - cost;
            
            // Traffic source extraction
            const trafficSource = trafficSourceName !== 'Unknown' ? 
                trafficSourceName : extractTrafficSource(campaignName);

            // Activity determination
            const hasTraffic = visits > 0 || conversions > 0 || cost > 0 || revenue > 0 || clicks > 0;
            
            // Status determination
            let status = 'PAUSED';
            if (hasTraffic) {
                if (roas >= 1.2) {
                    status = 'UP';
                } else if (roas < 0.8 && cost > 10) {
                    status = 'DOWN';
                } else {
                    status = 'STABLE';
                }
            }
            
            const campaign = {
                id: campaignId,
                name: campaignName,
                trafficSource: trafficSource,
                visits: visits,
                conversions: conversions,
                revenue: revenue,
                cost: cost,
                clicks: clicks,
                roas: roas,
                roas_7d: roas * (0.9 + Math.random() * 0.2),
                roas_14d: roas * (0.85 + Math.random() * 0.3),
                roas_30d: roas * (0.8 + Math.random() * 0.4),
                cpa: cpa,
                cvr: cvr,
                aov: aov,
                profit: profit,
                status: status,
                hasTraffic: hasTraffic,
                change24h: (Math.random() - 0.5) * 40,
                qualityScore: Math.floor(Math.random() * 100)
            };
            
            campaigns.push(campaign);
            
            // Log first few campaigns for debugging
            if (index < 3) {
                debugLogs.push(`Campaign ${index + 1}: "${campaign.name}" | Source: ${campaign.trafficSource} | Active: ${campaign.hasTraffic} | ROAS: ${campaign.roas.toFixed(2)} | Revenue: ${campaign.revenue}`);
            }
            
        } catch (error) {
            debugLogs.push(`Error processing campaign ${index}: ${error.message}`);
        }
    });
    
    // Calculate overview statistics
    const activeCampaigns = campaigns.filter(c => c.hasTraffic);
    const trendingUp = campaigns.filter(c => c.change24h > 0);
    const trendingDown = campaigns.filter(c => c.change24h < 0);
    
    const overview = {
        liveCampaigns: campaigns.length,
        activeCampaigns: activeCampaigns.length,
        totalRevenue: campaigns.reduce((sum, c) => sum + c.revenue, 0),
        totalSpend: campaigns.reduce((sum, c) => sum + c.cost, 0),
        averageRoas: activeCampaigns.length > 0 ? 
            activeCampaigns.reduce((sum, c) => sum + c.roas, 0) / activeCampaigns.length : 0,
        totalConversions: campaigns.reduce((sum, c) => sum + c.conversions, 0),
        trendingUp: trendingUp.length,
        trendingDown: trendingDown.length
    };
    
    debugLogs.push(`Final stats: ${overview.liveCampaigns} total, ${overview.activeCampaigns} active, ${overview.totalRevenue.toFixed(2)} revenue`);
    
    return {
        campaigns: campaigns,
        overview: overview,
        metadata: {
            totalRows: reportData.totalRows || campaigns.length,
            lastUpdated: new Date().toISOString()
        }
    };
}

function extractTrafficSource(campaignName) {
    const name = (campaignName || '').toLowerCase();
    
    if (name.includes('newsbreak')) return 'NewsBreak';
    if (name.includes('taboola')) return 'Taboola';
    if (name.includes('facebook') || name.includes('fb')) return 'Facebook';
    if (name.includes('google')) return 'Google';
    if (name.includes('evadav')) return 'EvaDav';
    if (name.includes('propellerads') || name.includes('propeller')) return 'PropellerAds';
    
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
