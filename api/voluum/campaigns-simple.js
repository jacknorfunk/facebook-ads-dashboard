// /api/voluum/campaigns-simple.js - FIXED to return direct array format
export default async function handler(req, res) {
    try {
        const volumeKeyId = process.env.VOLUME_KEY_ID;
        const volumeKey = process.env.VOLUME_KEY;

        if (!volumeKeyId || !volumeKey) {
            console.log('❌ Missing environment variables');
            return res.status(500).json([]);
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
            console.log('❌ Auth failed:', authResponse.status);
            return res.status(500).json([]);
        }

        const authData = await authResponse.json();
        const token = authData.token;

        console.log('✅ Voluum authentication successful');

        // Step 2: Get campaigns from known workspaces
        let allCampaigns = [];

        // Your workspaces that contain campaigns
        const workspaces = [
            '9345f0cf-ffb4-43b6-8548-3f71c346bcea', // MG+J workspace
            'ff231fd9-7055-4caa-97f0-ec6e18d26083'  // Tim - B1A1 workspace
        ];

        // Method 1: Try workspace-specific campaign calls
        for (const workspaceId of workspaces) {
            try {
                console.log(`🔄 Checking workspace: ${workspaceId}`);
                
                const wsResponse = await fetch('https://api.voluum.com/campaign', {
                    headers: {
                        'cwauth-token': token,
                        'X-Workspace-Id': workspaceId,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (wsResponse.ok) {
                    const wsData = await wsResponse.json();
                    if (wsData && Array.isArray(wsData) && wsData.length > 0) {
                        allCampaigns = allCampaigns.concat(wsData);
                        console.log(`✅ Found ${wsData.length} campaigns in workspace ${workspaceId}`);
                    }
                }
            } catch (err) {
                console.log(`❌ Workspace ${workspaceId} failed:`, err.message);
            }
        }

        // Method 2: If no campaigns from workspaces, try global report without dates
        if (allCampaigns.length === 0) {
            try {
                console.log('🔄 Trying global report endpoint...');
                const reportResponse = await fetch('https://api.voluum.com/report?groupBy=campaign&columns=campaignId,campaignName,visits,conversions,revenue,cost', {
                    headers: {
                        'cwauth-token': token,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (reportResponse.ok) {
                    const reportData = await reportResponse.json();
                    if (reportData.rows && reportData.rows.length > 0) {
                        allCampaigns = reportData.rows;
                        console.log('✅ Found campaigns via global report:', reportData.rows.length);
                    }
                }
            } catch (err) {
                console.log('❌ Global report failed:', err.message);
            }
        }

        // Method 3: Try report with date range as fallback
        if (allCampaigns.length === 0) {
            try {
                const dateRange = req.query.range || '30';
                const endDate = new Date().toISOString().split('T')[0];
                const startDate = new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                
                console.log(`🔄 Trying date range report: ${startDate} to ${endDate}`);
                
                const dateReportResponse = await fetch(`https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=campaign&columns=campaignId,campaignName,visits,conversions,revenue,cost`, {
                    headers: {
                        'cwauth-token': token,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (dateReportResponse.ok) {
                    const dateReportData = await dateReportResponse.json();
                    if (dateReportData.rows && dateReportData.rows.length > 0) {
                        allCampaigns = dateReportData.rows;
                        console.log('✅ Found campaigns via date report:', dateReportData.rows.length);
                    }
                }
            } catch (err) {
                console.log('❌ Date range report failed:', err.message);
            }
        }

        // Step 3: Normalize and return campaigns in the format your dashboard expects
        const normalizedCampaigns = allCampaigns.map(campaign => ({
            id: campaign.id || campaign.campaignId || campaign.name || generateId(),
            name: campaign.name || campaign.campaignName || 'Unknown Campaign',
            status: campaign.status || 'ACTIVE',
            trafficSource: determineTrafficSource(campaign.name || ''),
            visits: parseInt(campaign.visits || campaign.clicks || 0),
            conversions: parseInt(campaign.conversions || 0),
            revenue: parseFloat(campaign.revenue || 0),
            cost: parseFloat(campaign.cost || campaign.spend || 0),
            // Calculated metrics that your dashboard expects
            roas: calculateROAS(campaign.revenue || 0, campaign.cost || campaign.spend || 0),
            cpa: calculateCPA(campaign.cost || campaign.spend || 0, campaign.conversions || 0),
            cvr: calculateCVR(campaign.conversions || 0, campaign.visits || campaign.clicks || 0),
            aov: calculateAOV(campaign.revenue || 0, campaign.conversions || 0)
        }));

        console.log(`🎯 Returning ${normalizedCampaigns.length} campaigns to dashboard`);

        // Return the campaigns as a direct array (not wrapped in an object)
        // This matches what your dashboard expects
        return res.json(normalizedCampaigns);

    } catch (error) {
        console.error('❌ Voluum API error:', error);
        // Return empty array on error to prevent dashboard crash
        return res.json([]);
    }
}

// Helper functions
function determineTrafficSource(campaignName) {
    const name = campaignName.toLowerCase();
    if (name.includes('newsbreak')) return 'NewsBreak';
    if (name.includes('facebook') || name.includes('fb')) return 'Facebook';
    if (name.includes('taboola')) return 'Taboola';
    if (name.includes('admaven')) return 'AdMaven';
    if (name.includes('adcash')) return 'AdCash';
    return 'Voluum';
}

function calculateROAS(revenue, cost) {
    return cost > 0 ? (revenue / cost) : 0;
}

function calculateCPA(cost, conversions) {
    return conversions > 0 ? (cost / conversions) : 0;
}

function calculateCVR(conversions, visits) {
    return visits > 0 ? ((conversions / visits) * 100) : 0;
}

function calculateAOV(revenue, conversions) {
    return conversions > 0 ? (revenue / conversions) : 0;
}

function generateId() {
    return `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
