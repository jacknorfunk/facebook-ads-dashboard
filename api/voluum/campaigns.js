// /api/voluum/campaigns.js - CORRECTED using official Voluum API format
export default async function handler(req, res) {
    try {
        const volumeKeyId = process.env.VOLUME_KEY_ID;
        const volumeKey = process.env.VOLUME_KEY;

        if (!volumeKeyId || !volumeKey) {
            console.log('❌ Missing environment variables');
            return res.status(500).json({
                success: false,
                error: 'Missing Voluum API credentials'
            });
        }

        // Step 1: Get authentication token using access key
        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessId: volumeKeyId,
                accessKey: volumeKey
            })
        });

        if (!authResponse.ok) {
            console.log('❌ Auth failed:', authResponse.status);
            return res.status(500).json({
                success: false,
                error: `Authentication failed: ${authResponse.status}`
            });
        }

        const authData = await authResponse.json();
        const token = authData.token;

        console.log('✅ Voluum authentication successful');

        // Step 2: Calculate date range based on request parameter
        const range = req.query.range || 'last7days';
        let startDate, endDate;
        
        const now = new Date();
        endDate = now.toISOString().split('T')[0]; // Today
        
        if (range === 'last7days') {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else if (range === 'last30days') {
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else {
            // Default to 7 days
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }

        console.log(`📅 Date range: ${startDate} to ${endDate}`);

        // Step 3: Use the /report endpoint to get campaign performance data
        // This is the correct approach according to Voluum API docs
        const columns = [
            'campaignId',
            'campaignName', 
            'visits',
            'conversions',
            'revenue',
            'cost',
            'clicks'
        ].join(',');

        const reportUrl = `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=campaign&columns=${columns}&tz=UTC`;
        
        console.log('🔄 Making report API call:', reportUrl);

        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': token,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            console.log('❌ Report API failed:', reportResponse.status);
            const errorText = await reportResponse.text();
            console.log('Error response:', errorText);
            
            return res.status(500).json({
                success: false,
                error: `Report API failed: ${reportResponse.status} - ${errorText}`
            });
        }

        const reportData = await reportResponse.json();
        console.log('📊 Report response received');
        console.log('Report structure:', Object.keys(reportData));
        console.log('Total rows:', reportData.totalRows || 0);

        // Step 4: Process the report data
        const rows = reportData.rows || [];
        console.log(`✅ Found ${rows.length} campaign rows`);

        if (rows.length === 0) {
            console.log('⚠️ No campaign data in response');
            return res.json({
                success: true,
                campaigns: [],
                debug_info: {
                    total_rows: 0,
                    date_range: `${startDate} to ${endDate}`,
                    api_endpoint: 'report',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Step 5: Transform report rows into campaign objects
        const campaigns = rows.map((row, index) => {
            // Voluum report returns data in arrays corresponding to the columns requested
            const campaign = {
                id: row[0] || `campaign_${index}`, // campaignId
                name: row[1] || 'Unknown Campaign', // campaignName
                visits: parseInt(row[2]) || 0, // visits
                conversions: parseInt(row[3]) || 0, // conversions
                revenue: parseFloat(row[4]) || 0, // revenue
                cost: parseFloat(row[5]) || 0, // cost
                clicks: parseInt(row[6]) || 0, // clicks
                status: 'ACTIVE', // Report doesn't include status, assume active
                trafficSource: determineTrafficSource(row[1] || '')
            };

            // Calculate derived metrics
            campaign.roas = campaign.cost > 0 ? (campaign.revenue / campaign.cost) : 0;
            campaign.cpa = campaign.conversions > 0 ? (campaign.cost / campaign.conversions) : 0;
            campaign.cvr = campaign.visits > 0 ? ((campaign.conversions / campaign.visits) * 100) : 0;
            campaign.aov = campaign.conversions > 0 ? (campaign.revenue / campaign.conversions) : 0;

            return campaign;
        });

        // Step 6: Filter out campaigns with no meaningful data
        const activeCampaigns = campaigns.filter(campaign => {
            const hasSpend = campaign.cost > 0;
            const hasTraffic = campaign.visits > 0 || campaign.clicks > 0;
            const hasRevenue = campaign.revenue > 0;
            return hasSpend || hasTraffic || hasRevenue;
        });

        console.log(`🎯 Returning ${activeCampaigns.length} active campaigns`);

        return res.json({
            success: true,
            campaigns: activeCampaigns,
            debug_info: {
                total_found: campaigns.length,
                active_campaigns: activeCampaigns.length,
                date_range: `${startDate} to ${endDate}`,
                api_endpoint: 'report',
                columns_requested: columns,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Voluum API error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug_info: {
                timestamp: new Date().toISOString(),
                error_type: error.name
            }
        });
    }
}

// Helper function to determine traffic source from campaign name
function determineTrafficSource(campaignName) {
    if (!campaignName) return 'Voluum';
    
    const name = campaignName.toLowerCase();
    if (name.includes('newsbreak')) return 'NewsBreak';
    if (name.includes('facebook') || name.includes('fb')) return 'Facebook';
    if (name.includes('taboola')) return 'Taboola';
    if (name.includes('admaven')) return 'AdMaven';
    if (name.includes('adcash')) return 'AdCash';
    if (name.includes('google') || name.includes('gdn')) return 'Google';
    if (name.includes('bing')) return 'Bing';
    if (name.includes('yahoo')) return 'Yahoo';
    
    return 'Voluum';
}
