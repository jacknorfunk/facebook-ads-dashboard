// /api/voluum/campaigns-simple.js - Simplified Voluum Campaigns API

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
        console.log('=== VOLUUM CAMPAIGNS API (SIMPLIFIED) ===');
        
        // Get environment variables
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;
        
        console.log('VOLUME_KEY_ID exists:', !!accessId);
        console.log('VOLUME_KEY exists:', !!accessKey);
        
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

        // Step 1: Authenticate with Voluum API (same as test-env.js)
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

        console.log('Auth response status:', authResponse.status);
        
        if (!authResponse.ok) {
            const authErrorText = await authResponse.text();
            console.error('Voluum auth failed:', authResponse.status, authErrorText.substring(0, 200));
            return res.status(401).json({
                success: false,
                error: 'Voluum authentication failed',
                status: authResponse.status,
                details: authErrorText.substring(0, 200)
            });
        }

        const authData = await authResponse.json();
        const token = authData.token;
        
        if (!token) {
            console.error('No token in auth response:', authData);
            return res.status(401).json({
                success: false,
                error: 'No token received from Voluum API',
                authResponse: authData
            });
        }

        console.log('✅ Voluum authentication successful');

        // Step 2: Try to get campaigns using the token (simplified approach)
        console.log('Fetching campaigns...');
        
        // Try different authentication methods since we're getting 401 on campaigns
        const campaignAttempts = [
            // Method 1: cwauth-token header
            {
                headers: {
                    'cwauth-token': token,
                    'Content-Type': 'application/json'
                },
                method: 'cwauth-token'
            },
            // Method 2: Bearer token
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                method: 'Bearer'
            },
            // Method 3: Token in query parameter
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                url: `https://api.voluum.com/campaign?access_token=${token}`,
                method: 'query_param'
            }
        ];

        let campaignsData = null;
        let successMethod = null;

        for (const attempt of campaignAttempts) {
            try {
                console.log(`Trying ${attempt.method} method...`);
                
                const campaignUrl = attempt.url || 'https://api.voluum.com/campaign';
                const campaignsResponse = await fetch(campaignUrl, {
                    method: 'GET',
                    headers: attempt.headers
                });

                console.log(`${attempt.method} response status:`, campaignsResponse.status);

                if (campaignsResponse.ok) {
                    campaignsData = await campaignsResponse.json();
                    successMethod = attempt.method;
                    console.log(`✅ Success with ${attempt.method} method!`);
                    break;
                } else {
                    const errorText = await campaignsResponse.text();
                    console.log(`${attempt.method} failed:`, campaignsResponse.status, errorText.substring(0, 100));
                }
            } catch (error) {
                console.log(`${attempt.method} error:`, error.message);
            }
        }

        if (!campaignsData) {
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch campaigns with any authentication method',
                tried_methods: campaignAttempts.map(a => a.method),
                suggestion: 'Check API permissions in Voluum Dashboard → Settings → API Access'
            });
        }

        console.log(`Campaigns fetched successfully using ${successMethod}:`, Array.isArray(campaignsData) ? campaignsData.length : 'unknown count');

        // Step 3: Process campaign data into a simple format
        if (!Array.isArray(campaignsData)) {
            console.log('Unexpected campaigns data format:', typeof campaignsData);
            return res.status(500).json({
                success: false,
                error: 'Unexpected campaigns data format',
                dataType: typeof campaignsData,
                sample: JSON.stringify(campaignsData).substring(0, 200)
            });
        }

        // Convert to simple format for the dashboard
        const processedCampaigns = campaignsData.map(campaign => {
            return {
                id: campaign.id || campaign.campaignId || Math.random().toString(36).substr(2, 9),
                name: campaign.name || campaign.campaignName || 'Unnamed Campaign',
                status: campaign.status || 'ACTIVE',
                // Set basic metrics to 0 for now - we'll get these from reports later
                visits: 0,
                clicks: 0,
                conversions: 0,
                revenue: 0,
                cost: 0,
                trafficSource: campaign.trafficSource?.name || detectTrafficSource(campaign.name),
                tags: campaign.tags || [],
                createdAt: campaign.createdAt,
                updatedAt: campaign.updatedAt,
                // Mark as basic data - dashboard can request detailed metrics separately
                hasDetailedMetrics: false
            };
        });

        // Filter for active campaigns only
        const activeCampaigns = processedCampaigns.filter(campaign => 
            campaign.status && campaign.status.toUpperCase() === 'ACTIVE'
        );

        console.log(`✅ Processed ${activeCampaigns.length} active campaigns`);

        return res.status(200).json({
            success: true,
            campaigns: activeCampaigns,
            total: activeCampaigns.length,
            dateRange: dateRange,
            authMethod: successMethod,
            note: 'Basic campaign data loaded. Detailed metrics available via report endpoint.',
            debug: {
                totalFound: campaignsData.length,
                activeFiltered: activeCampaigns.length,
                authMethodUsed: successMethod
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
