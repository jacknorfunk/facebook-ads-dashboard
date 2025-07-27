// /api/voluum/campaigns.js - FIXED: Remove aggressive filtering
export default async function handler(req, res) {
    try {
        const volumeKeyId = process.env.VOLUME_KEY_ID;
        const volumeKey = process.env.VOLUME_KEY;

        if (!volumeKeyId || !volumeKey) {
            return res.status(500).json({
                success: false,
                error: 'Missing Voluum API credentials'
            });
        }

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
            return res.status(500).json({
                success: false,
                error: `Authentication failed: ${authResponse.status}`
            });
        }

        const authData = await authResponse.json();
        const token = authData.token;

        // Step 2: Calculate date range
        const range = req.query.range || 'last7days';
        let startDate, endDate;
        
        const now = new Date();
        endDate = now.toISOString().split('T')[0];
        
        if (range === 'last7days') {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else if (range === 'last30days') {
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }

        // Step 3: Get report data
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
        
        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': token,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            return res.status(500).json({
                success: false,
                error: `Report API failed: ${reportResponse.status} - ${errorText}`
            });
        }

        const reportData = await reportResponse.json();
        const rows = reportData.rows || [];

        console.log(`📊 Raw report data: ${rows.length} rows found`);

        // Step 4: Transform ALL campaigns (NO FILTERING YET)
        const campaigns = rows.map((row, index) => {
            const campaign = {
                id: row[0] || `campaign_${index}`,
                name: row[1] || 'Unknown Campaign',
                visits: parseInt(row[2]) || 0,
                conversions: parseInt(row[3]) || 0,
                revenue: parseFloat(row[4]) || 0,
                cost: parseFloat(row[5]) || 0,
                clicks: parseInt(row[6]) || 0,
                status: 'ACTIVE',
                trafficSource: determineTrafficSource(row[1] || '')
            };

            // Calculate metrics
            campaign.roas = campaign.cost > 0 ? (campaign.revenue / campaign.cost) : 0;
            campaign.cpa = campaign.conversions > 0 ? (campaign.cost / campaign.conversions) : 0;
            campaign.cvr = campaign.visits > 0 ? ((campaign.conversions / campaign.visits) * 100) : 0;
            campaign.aov = campaign.conversions > 0 ? (campaign.revenue / campaign.conversions) : 0;

            // Log first few campaigns for debugging
            if (index < 3) {
                console.log(`Campaign ${index}:`, {
                    name: campaign.name,
                    visits: campaign.visits,
                    conversions: campaign.conversions,
                    revenue: campaign.revenue,
                    cost: campaign.cost,
                    clicks: campaign.clicks
                });
            }

            return campaign;
        });

        // Step 5: MUCH LESS AGGRESSIVE FILTERING
        // Only filter out campaigns that are completely empty (all fields are 0 or empty)
        const activeCampaigns = campaigns.filter(campaign => {
            // Keep campaign if it has ANY of these:
            const hasName = campaign.name && campaign.name !== 'Unknown Campaign';
            const hasAnyMetric = campaign.visits > 0 || campaign.clicks > 0 || campaign.conversions > 0 || campaign.revenue > 0 || campaign.cost > 0;
            
            // Only exclude if it's completely empty
            return hasName || hasAnyMetric;
        });

        console.log(`🎯 After filtering: ${activeCampaigns.length} campaigns (from ${campaigns.length} total)`);

        // Log filtering details for debugging
        const filteredOut = campaigns.length - activeCampaigns.length;
        console.log(`Filtered out ${filteredOut} empty campaigns`);

        // If still no campaigns, let's see what we have
        if (activeCampaigns.length === 0 && campaigns.length > 0) {
            console.log('⚠️ All campaigns were filtered out. First 3 raw campaigns:');
            campaigns.slice(0, 3).forEach((campaign, i) => {
                console.log(`Campaign ${i}:`, campaign);
            });
        }

        return res.json({
            success: true,
            campaigns: activeCampaigns,
            debug_info: {
                total_found: campaigns.length,
                active_campaigns: activeCampaigns.length,
                filtered_out: filteredOut,
                date_range: `${startDate} to ${endDate}`,
                api_endpoint: 'report',
                columns_requested: columns,
                sample_raw_data: campaigns.slice(0, 2), // Show first 2 campaigns for debugging
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Voluum API error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

function determineTrafficSource(campaignName) {
    if (!campaignName) return 'Voluum';
    
    const name = campaignName.toLowerCase();
    if (name.includes('newsbreak')) return 'NewsBreak';
    if (name.includes('facebook') || name.includes('fb')) return 'Facebook';
    if (name.includes('taboola')) return 'Taboola';
    if (name.includes('admaven')) return 'AdMaven';
    if (name.includes('adcash')) return 'AdCash';
    
    return 'Voluum';
}
