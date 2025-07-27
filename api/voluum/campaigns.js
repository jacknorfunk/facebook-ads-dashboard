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

        // Step 3: Try multiple approaches to get ACTIVE campaigns
        const columns = [
            'campaignId',
            'campaignName', 
            'visits',
            'conversions',
            'revenue',
            'cost',
            'clicks'
        ].join(',');

        let reportData;
        let reportUrl;

        // Approach 1: Try with a wider date range to get more recent activity
        const widerStartDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // Last 90 days
        reportUrl = `https://api.voluum.com/report?from=${widerStartDate}&to=${endDate}&groupBy=campaign&columns=${columns}&tz=UTC`;
        
        console.log('🔄 Trying wider date range (90 days) for active campaigns:', reportUrl);
        
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

        reportData = await reportResponse.json();
        const rows = reportData.rows || [];

        console.log(`📊 Raw report data: ${rows.length} rows found`);

        // Step 4: Transform campaigns - Voluum returns OBJECTS, not arrays
        const campaigns = rows.map((row, index) => {
            // Log the actual raw data structure
            if (index < 3) {
                console.log(`Raw row ${index}:`, row);
                console.log(`Raw row ${index} keys:`, Object.keys(row || {}));
            }

            // Voluum returns objects with many fields, not arrays
            const campaign = {
                id: row?.campaignId || row?.id || `campaign_${index}`,
                name: row?.campaignName || row?.name || `Campaign ${index}`,
                visits: parseInt(row?.visits || row?.uniqueVisits || 0),
                conversions: parseInt(row?.conversions || row?.allConversions || 0),
                revenue: parseFloat(row?.revenue || row?.allConversionsRevenue || 0),
                cost: parseFloat(row?.cost || row?.totalCost || 0),
                clicks: parseInt(row?.clicks || row?.totalClicks || 0),
                status: row?.status || 'ACTIVE',
                trafficSource: determineTrafficSource(row?.campaignName || row?.name || '')
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

        // Step 5: Filter for campaigns with ANY activity (including very recent)
        // Sort by total activity to get most active campaigns first
        const campaignsWithActivity = campaigns
            .filter(campaign => {
                const hasActivity = campaign.visits > 0 || campaign.clicks > 0 || campaign.conversions > 0 || campaign.revenue > 0 || campaign.cost > 0;
                const hasName = campaign.name && campaign.name !== 'Unknown Campaign';
                return hasActivity || hasName;
            })
            .sort((a, b) => {
                // Sort by total activity (visits + clicks + conversions)
                const activityA = (a.visits || 0) + (a.clicks || 0) + (a.conversions || 0);
                const activityB = (b.visits || 0) + (b.clicks || 0) + (b.conversions || 0);
                return activityB - activityA;
            })
            .slice(0, 100); // Take top 100 most active campaigns

        console.log(`🎯 Found ${campaignsWithActivity.length} campaigns with activity (from ${campaigns.length} total)`);

        // If still no campaigns with activity, show ALL campaigns (even with zero metrics)
        const activeCampaigns = campaignsWithActivity.length > 0 ? campaignsWithActivity : campaigns.slice(0, 50);

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
                date_range_used: `${widerStartDate} to ${endDate} (90 days)`,
                original_date_range: `${startDate} to ${endDate}`,
                api_endpoint: 'report',
                columns_requested: columns,
                sample_raw_data: rows.slice(0, 3), // Show actual RAW Voluum data
                sample_processed_data: campaigns.slice(0, 3), // Show how we processed it
                top_campaigns_by_activity: activeCampaigns.slice(0, 5).map(c => ({
                    name: c.name,
                    visits: c.visits,
                    conversions: c.conversions,
                    revenue: c.revenue,
                    cost: c.cost
                })),
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
