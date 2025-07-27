// /api/voluum/campaigns-simple.js - Voluum Campaigns API Endpoint

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        console.log('=== VOLUUM CAMPAIGNS API ===');
        
        // Get environment variables
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;
        
        if (!accessId || !accessKey) {
            return res.status(500).json({
                success: false,
                error: 'Missing Voluum API credentials',
                debug: 'VOLUME_KEY_ID and VOLUME_KEY environment variables required'
            });
        }

        // Get date range from query params
        const { range = 'yesterday', date_range } = req.query;
        const dateRange = date_range || range;
        
        console.log('Date range requested:', dateRange);

        // Step 1: Authenticate with Voluum API
        console.log('Authenticating with Voluum API...');
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
            console.error('Voluum auth failed:', authResponse.status, authError);
            return res.status(401).json({
                success: false,
                error: 'Voluum authentication failed',
                debug: `Status: ${authResponse.status}, Response: ${authError.substring(0, 200)}`
            });
        }

        const authData = await authResponse.json();
        const token = authData.token;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token received from Voluum API',
                debug: authData
            });
        }

        console.log('✅ Voluum authentication successful');

        // Step 2: Convert date range to Voluum format
        const volumeDateRange = convertDateRange(dateRange);
        console.log('Converted date range:', volumeDateRange);

        // Step 3: Get campaigns list using correct Voluum API format
        console.log('Fetching campaigns list...');
        const campaignsResponse = await fetch('https://api.voluum.com/campaign', {
            method: 'GET',
            headers: {
                'cwauth-token': token,
                'Content-Type': 'application/json'
            }
        });

        if (!campaignsResponse.ok) {
            const campaignsError = await campaignsResponse.text();
            console.error('Campaigns fetch failed:', campaignsResponse.status, campaignsError);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch campaigns from Voluum',
                debug: `Status: ${campaignsResponse.status}, Response: ${campaignsError.substring(0, 200)}`
            });
        }

        const campaignsData = await campaignsResponse.json();
        console.log(`Found ${campaignsData.length || 0} campaigns`);

        if (!Array.isArray(campaignsData) || campaignsData.length === 0) {
            return res.status(200).json({
                success: true,
                campaigns: [],
                message: 'No campaigns found in Voluum account'
            });
        }

        // Step 4: Get performance data for each campaign
        console.log('Fetching campaign performance data...');
        const campaignPromises = campaignsData.slice(0, 50).map(async (campaign) => {
            try {
                // Build report query parameters
                const reportParams = new URLSearchParams({
                    from: volumeDateRange.from,
                    to: volumeDateRange.to,
                    tz: 'UTC',
                    groupBy: 'campaign',
                    include: 'ACTIVE',
                    filter1: `campaign:${campaign.id}`,
                    columns: 'visits,clicks,conversions,revenue,cost,campaignId,campaignName'
                });

                const reportResponse = await fetch(`https://api.voluum.com/report?${reportParams}`, {
                    method: 'GET',
                    headers: {
                        'cwauth-token': token,
                        'Content-Type': 'application/json'
                    }
                });

                if (!reportResponse.ok) {
                    console.warn(`Report failed for campaign ${campaign.id}:`, reportResponse.status);
                    return null;
                }

                const reportData = await reportResponse.json();
                
                // Extract metrics from report
                const metrics = reportData.rows && reportData.rows.length > 0 ? reportData.rows[0] : {};
                
                return {
                    id: campaign.id,
                    name: campaign.name || 'Unnamed Campaign',
                    status: campaign.status || 'ACTIVE',
                    visits: parseInt(metrics.visits) || 0,
                    clicks: parseInt(metrics.clicks) || 0,
                    conversions: parseInt(metrics.conversions) || 0,
                    revenue: parseFloat(metrics.revenue) || 0,
                    cost: parseFloat(metrics.cost) || 0,
                    trafficSource: campaign.trafficSource?.name || detectTrafficSource(campaign.name),
                    tags: campaign.tags || [],
                    createdAt: campaign.createdAt,
                    updatedAt: campaign.updatedAt
                };
            } catch (error) {
                console.warn(`Error processing campaign ${campaign.id}:`, error.message);
                return null;
            }
        });

        // Wait for all campaign data to be fetched
        const campaignResults = await Promise.all(campaignPromises);
        const validCampaigns = campaignResults.filter(campaign => campaign !== null);

        console.log(`✅ Successfully processed ${validCampaigns.length} campaigns`);

        // Filter out campaigns with no activity
        const activeCampaigns = validCampaigns.filter(campaign => {
            return campaign.status === 'ACTIVE' && (campaign.visits > 0 || campaign.cost > 0);
        });

        console.log(`📊 Active campaigns with traffic/spend: ${activeCampaigns.length}`);

        return res.status(200).json({
            success: true,
            campaigns: activeCampaigns,
            total: activeCampaigns.length,
            dateRange: dateRange,
            debug: {
                totalFound: campaignsData.length,
                processed: validCampaigns.length,
                activeWithTraffic: activeCampaigns.length
            }
        });

    } catch (error) {
        console.error('Voluum campaigns API error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

// Helper function to convert date range to Voluum API format
function convertDateRange(range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let from, to;
    
    switch (range) {
        case 'today':
            from = to = formatDate(today);
            break;
        case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            from = to = formatDate(yesterday);
            break;
        case 'last_7_days':
            const week = new Date(today);
            week.setDate(week.getDate() - 7);
            from = formatDate(week);
            to = formatDate(today);
            break;
        case 'last_14_days':
            const twoWeeks = new Date(today);
            twoWeeks.setDate(twoWeeks.getDate() - 14);
            from = formatDate(twoWeeks);
            to = formatDate(today);
            break;
        case 'last_30_days':
            const month = new Date(today);
            month.setDate(month.getDate() - 30);
            from = formatDate(month);
            to = formatDate(today);
            break;
        case 'this_month':
            from = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
            to = formatDate(today);
            break;
        case 'last_month':
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
            from = formatDate(lastMonth);
            to = formatDate(lastMonthEnd);
            break;
        default:
            // Default to yesterday
            const defaultDay = new Date(today);
            defaultDay.setDate(defaultDay.getDate() - 1);
            from = to = formatDate(defaultDay);
    }
    
    return { from, to };
}

// Helper function to format date for Voluum API
function formatDate(date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Helper function to detect traffic source from campaign name
function detectTrafficSource(campaignName) {
    if (!campaignName) return 'Unknown';
    
    const name = campaignName.toLowerCase();
    if (name.includes('newsbreak')) return 'NewsBreak';
    if (name.includes('facebook') || name.includes('fb')) return 'Facebook';
    if (name.includes('taboola')) return 'Taboola';
    if (name.includes('google')) return 'Google';
    if (name.includes('bing')) return 'Bing';
    if (name.includes('tiktok')) return 'TikTok';
    if (name.includes('snapchat')) return 'Snapchat';
    return 'Other';
}
