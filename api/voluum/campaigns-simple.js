// /api/voluum/campaigns-simple.js - VOLUUM ONLY - Fixed implementation
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
            throw new Error(`Auth failed: ${authResponse.status}`);
        }

        const authData = await authResponse.json();
        const token = authData.token;

        console.log('✅ Voluum authentication successful');

        // Step 2: Use the methods that worked in your breakthrough
        let campaigns = [];

        // Method 1: Try bulk campaign CSV (this bypassed workspace restrictions in your test)
        try {
            console.log('🔄 Trying bulk campaign method...');
            const bulkResponse = await fetch('https://api.voluum.com/bulk/campaign', {
                headers: {
                    'cwauth-token': token,
                    'Accept': 'text/csv'
                }
            });
            
            if (bulkResponse.ok) {
                const csvData = await bulkResponse.text();
                console.log('📊 Bulk CSV response length:', csvData.length);
                
                if (csvData.length > 100) { // Has actual data beyond headers
                    campaigns = parseCsvToJson(csvData);
                    console.log('✅ SUCCESS: Found', campaigns.length, 'campaigns via bulk CSV');
                }
            }
        } catch (err) {
            console.log('❌ Bulk CSV failed:', err.message);
        }

        // Method 2: Try specific workspaces that contain your campaigns
        if (campaigns.length === 0) {
            const knownWorkspaces = [
                '9345f0cf-ffb4-43b6-8548-3f71c346bcea', // MG+J workspace
                'ff231fd9-7055-4caa-97f0-ec6e18d26083'  // Tim - B1A1 workspace
            ];

            for (const workspaceId of knownWorkspaces) {
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
                            campaigns = campaigns.concat(wsData);
                            console.log(`✅ Found ${wsData.length} campaigns in workspace ${workspaceId}`);
                        }
                    }
                } catch (err) {
                    console.log(`❌ Workspace ${workspaceId} failed:`, err.message);
                }
            }
        }

        // Method 3: Try report endpoint without date restrictions
        if (campaigns.length === 0) {
            try {
                console.log('🔄 Trying report endpoint...');
                const reportResponse = await fetch('https://api.voluum.com/report?groupBy=campaign&columns=campaignId,campaignName,visits,conversions,revenue,cost', {
                    headers: {
                        'cwauth-token': token,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (reportResponse.ok) {
                    const reportData = await reportResponse.json();
                    if (reportData.rows && reportData.rows.length > 0) {
                        campaigns = reportData.rows;
                        console.log('✅ Found campaigns via report endpoint:', reportData.rows.length);
                    }
                }
            } catch (err) {
                console.log('❌ Report endpoint failed:', err.message);
            }
        }

        // Step 3: Process and normalize the campaign data
        const normalizedCampaigns = campaigns.map(campaign => ({
            id: campaign.id || campaign.campaignId || campaign.name || generateId(),
            name: campaign.name || campaign.campaignName || 'Unknown Campaign',
            status: campaign.status || 'ACTIVE',
            trafficSource: determineTrafficSource(campaign.name || ''),
            visits: parseInt(campaign.visits || campaign.clicks || 0),
            conversions: parseInt(campaign.conversions || 0),
            revenue: parseFloat(campaign.revenue || 0),
            cost: parseFloat(campaign.cost || campaign.spend || 0),
            // Calculated metrics
            roas: calculateROAS(campaign.revenue || 0, campaign.cost || campaign.spend || 0),
            cpa: calculateCPA(campaign.cost || campaign.spend || 0, campaign.conversions || 0),
            cvr: calculateCVR(campaign.conversions || 0, campaign.visits || campaign.clicks || 0),
            aov: calculateAOV(campaign.revenue || 0, campaign.conversions || 0)
        }));

        // Filter out inactive campaigns (0 spend, 0 traffic)
        const activeCampaigns = normalizedCampaigns.filter(campaign => {
            const hasSpend = campaign.cost > 0;
            const hasTraffic = campaign.visits > 0;
            const hasRevenue = campaign.revenue > 0;
            return hasSpend || hasTraffic || hasRevenue;
        });

        console.log(`🎯 FINAL RESULT: ${activeCampaigns.length} active campaigns from Voluum`);

        return res.json({
            success: true,
            campaigns: activeCampaigns,
            debug_info: {
                total_found: campaigns.length,
                active_campaigns: activeCampaigns.length,
                data_source: 'voluum_only',
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

// Helper functions
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
