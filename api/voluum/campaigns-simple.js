// /api/voluum/campaigns-simple.js - FIXED implementation based on workspace discovery
export default async function handler(req, res) {
    try {
        const volumeKeyId = process.env.VOLUME_KEY_ID;
        const volumeKey = process.env.VOLUME_KEY;

        if (!volumeKeyId || !volumeKey) {
            return res.status(500).json({
                success: false,
                error: 'Missing Voluum API credentials',
                debug_info: { 
                    volume_key_id_exists: !!volumeKeyId,
                    volume_key_exists: !!volumeKey
                }
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
            throw new Error(`Auth failed: ${authResponse.status}`);
        }

        const authData = await authResponse.json();
        const token = authData.token;

        console.log('✅ Authentication successful');

        // Step 2: Try multiple approaches to get campaign data
        // Based on your breakthrough, these are the methods that work:

        let allCampaigns = [];

        // Approach 1: Bulk Campaign CSV (bypasses workspace restrictions)
        try {
            console.log('🔄 Trying bulk campaign CSV method...');
            const bulkResponse = await fetch('https://api.voluum.com/bulk/campaign', {
                headers: {
                    'cwauth-token': token,
                    'Accept': 'text/csv'
                }
            });
            
            if (bulkResponse.ok) {
                const csvData = await bulkResponse.text();
                console.log('✅ Bulk CSV response length:', csvData.length);
                
                if (csvData.length > 100) { // Has actual data, not just headers
                    const campaigns = parseCsvToJson(csvData);
                    if (campaigns.length > 0) {
                        allCampaigns = campaigns;
                        console.log('✅ Found campaigns via bulk CSV:', campaigns.length);
                    }
                }
            }
        } catch (err) {
            console.log('❌ Bulk CSV method failed:', err.message);
        }

        // Approach 2: Direct campaign endpoint for each workspace
        if (allCampaigns.length === 0) {
            const workspaces = [
                '9345f0cf-ffb4-43b6-8548-3f71c346bcea', // MG+J workspace
                'ff231fd9-7055-4caa-97f0-ec6e18d26083'  // Tim - B1A1 workspace
            ];

            for (const workspaceId of workspaces) {
                try {
                    console.log(`🔄 Trying workspace ${workspaceId}...`);
                    
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
        }

        // Approach 3: Report endpoint without date filters (global scope)
        if (allCampaigns.length === 0) {
            try {
                console.log('🔄 Trying report endpoint without dates...');
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
                        console.log('✅ Found campaigns via report:', reportData.rows.length);
                    }
                }
            } catch (err) {
                console.log('❌ Report method failed:', err.message);
            }
        }

        // Step 3: Process and normalize the data
        const normalizedCampaigns = allCampaigns.map(campaign => normalizeCampaignData(campaign));

        // Filter out campaigns with no meaningful data
        const activeCampaigns = normalizedCampaigns.filter(campaign => {
            const hasSpend = (campaign.cost || 0) > 0;
            const hasTraffic = (campaign.visits || 0) > 0;
            const hasRevenue = (campaign.revenue || 0) > 0;
            return hasSpend || hasTraffic || hasRevenue;
        });

        console.log(`✅ Final result: ${activeCampaigns.length} active campaigns`);

        return res.json({
            success: true,
            campaigns: activeCampaigns,
            debug_info: {
                total_campaigns_found: allCampaigns.length,
                active_campaigns: activeCampaigns.length,
                data_source: 'voluum_multi_method',
                auth_token_length: token ? token.length : 0,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Voluum API error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug_info: {
                error_type: error.name,
                timestamp: new Date().toISOString()
            }
        });
    }
}

// Helper function to parse CSV to JSON
function parseCsvToJson(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const campaigns = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length >= headers.length) {
            const campaign = {};
            headers.forEach((header, index) => {
                campaign[header] = values[index] || '';
            });
            campaigns.push(campaign);
        }
    }
    
    return campaigns;
}

// Helper function to normalize campaign data
function normalizeCampaignData(campaign) {
    return {
        id: campaign.id || campaign.campaignId || campaign.name || `campaign_${Date.now()}`,
        name: campaign.name || campaign.campaignName || 'Unknown Campaign',
        status: campaign.status || 'ACTIVE',
        trafficSource: determineTrafficSource(campaign.name || ''),
        visits: parseInt(campaign.visits || 0),
        conversions: parseInt(campaign.conversions || 0),
        revenue: parseFloat(campaign.revenue || 0),
        cost: parseFloat(campaign.cost || campaign.spend || 0),
        // Add calculated metrics
        roas: calculateROAS(campaign.revenue, campaign.cost),
        cpa: calculateCPA(campaign.cost, campaign.conversions),
        cvr: calculateCVR(campaign.conversions, campaign.visits),
        aov: calculateAOV(campaign.revenue, campaign.conversions)
    };
}

// Helper functions for calculations
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
