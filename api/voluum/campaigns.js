// /api/voluum/campaigns.js
// Fixed to use GET /campaign endpoint (no parameters required)

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const volumeKeyId = process.env.VOLUME_KEY_ID;
        const volumeKey = process.env.VOLUME_KEY;

        if (!volumeKeyId || !volumeKey) {
            return res.status(500).json({
                success: false,
                error: 'Missing Voluum credentials',
                debug: { 
                    volumeKeyId_exists: !!volumeKeyId, 
                    volumeKey_exists: !!volumeKey 
                }
            });
        }

        console.log('🔐 Authenticating with Voluum...');
        
        // Step 1: Get authentication token
        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessId: volumeKeyId,
                accessKey: volumeKey
            })
        });

        if (!authResponse.ok) {
            const authError = await authResponse.text();
            console.error('Voluum auth failed:', authError);
            throw new Error(`Auth failed: ${authResponse.status} ${authResponse.statusText}`);
        }

        const authData = await authResponse.json();
        const token = authData.token;

        if (!token) {
            throw new Error('No token received from Voluum auth');
        }

        console.log('✅ Authentication successful, fetching campaigns...');

        // Step 2: Get campaigns using simple GET /campaign endpoint (NO PARAMETERS)
        const campaignResponse = await fetch('https://api.voluum.com/campaign', {
            method: 'GET',
            headers: {
                'cwauth-token': token,
                'Content-Type': 'application/json'
            }
        });

        if (!campaignResponse.ok) {
            const campaignError = await campaignResponse.text();
            console.error('Voluum campaign fetch failed:', campaignError);
            throw new Error(`Campaign fetch failed: ${campaignResponse.status} ${campaignResponse.statusText}`);
        }

        const campaignData = await campaignResponse.json();
        console.log(`📊 Received ${campaignData.length || 0} campaigns from Voluum`);

        // Step 3: Process campaigns and add performance data
        const campaigns = Array.isArray(campaignData) ? campaignData : [];
        
        // For each campaign, try to get performance data from reports
        const enhancedCampaigns = [];
        const dateRange = req.query.range || 'yesterday';
        
        for (const campaign of campaigns) {
            try {
                // Try to get performance data for each campaign
                const performanceData = await getCampaignPerformance(token, campaign.id, dateRange);
                
                // Combine campaign info with performance data
                const enhancedCampaign = {
                    ...campaign,
                    visits: performanceData.visits || 0,
                    conversions: performanceData.conversions || 0,
                    revenue: performanceData.revenue || 0,
                    cost: performanceData.cost || 0,
                    clicks: performanceData.clicks || performanceData.visits || 0
                };
                
                enhancedCampaigns.push(enhancedCampaign);
                
            } catch (perfError) {
                console.warn(`Could not get performance data for campaign ${campaign.id}:`, perfError.message);
                
                // Still include campaign without performance data
                enhancedCampaigns.push({
                    ...campaign,
                    visits: 0,
                    conversions: 0,
                    revenue: 0,
                    cost: 0,
                    clicks: 0
                });
            }
        }

        console.log(`✅ Processed ${enhancedCampaigns.length} campaigns with performance data`);

        return res.status(200).json({
            success: true,
            campaigns: enhancedCampaigns,
            total: enhancedCampaigns.length,
            debug_info: {
                campaigns_count: enhancedCampaigns.length,
                date_range: dateRange,
                endpoint_used: 'GET /campaign',
                auth_working: true
            }
        });

    } catch (error) {
        console.error('❌ Voluum API Error:', error);
        
        return res.status(500).json({
            success: false,
            error: error.message,
            campaigns: [],
            debug_info: {
                error_type: error.constructor.name,
                error_message: error.message,
                timestamp: new Date().toISOString()
            }
        });
    }
}

// Helper function to get performance data for a campaign
async function getCampaignPerformance(token, campaignId, dateRange) {
    try {
        // Calculate date range
        const { from, to } = getDateRange(dateRange);
        
        // Try to get performance data from reports
        const reportUrl = `https://api.voluum.com/report?from=${from}&to=${to}&groupBy=campaign&campaignId=${campaignId}&columns=visits,conversions,revenue,cost,clicks`;
        
        const response = await fetch(reportUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': token,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Performance data fetch failed: ${response.status}`);
        }

        const data = await response.json();
        
        // Extract performance metrics from report response
        if (data.rows && data.rows.length > 0) {
            const row = data.rows[0];
            return {
                visits: row.visits || 0,
                conversions: row.conversions || 0,
                revenue: row.revenue || 0,
                cost: row.cost || 0,
                clicks: row.clicks || row.visits || 0
            };
        }
        
        return { visits: 0, conversions: 0, revenue: 0, cost: 0, clicks: 0 };
        
    } catch (error) {
        console.warn('Could not fetch performance data:', error.message);
        return { visits: 0, conversions: 0, revenue: 0, cost: 0, clicks: 0 };
    }
}

// Helper function to calculate date ranges
function getDateRange(range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (range) {
        case 'today':
            return {
                from: today.toISOString().split('T')[0],
                to: today.toISOString().split('T')[0]
            };
            
        case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return {
                from: yesterday.toISOString().split('T')[0],
                to: yesterday.toISOString().split('T')[0]
            };
            
        case 'last7days':
            const week = new Date(today);
            week.setDate(week.getDate() - 7);
            return {
                from: week.toISOString().split('T')[0],
                to: today.toISOString().split('T')[0]
            };
            
        case 'last30days':
            const month = new Date(today);
            month.setDate(month.getDate() - 30);
            return {
                from: month.toISOString().split('T')[0],
                to: today.toISOString().split('T')[0]
            };
            
        default:
            // Default to yesterday
            const defaultYesterday = new Date(today);
            defaultYesterday.setDate(defaultYesterday.getDate() - 1);
            return {
                from: defaultYesterday.toISOString().split('T')[0],
                to: defaultYesterday.toISOString().split('T')[0]
            };
    }
}
