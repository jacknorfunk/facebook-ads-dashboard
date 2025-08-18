// /api/voluum/campaignById.js - DIAGNOSTIC VERSION to show available campaign IDs

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed. Use POST.' 
        });
    }

    const { campaignId } = req.body;

    if (!campaignId) {
        return res.status(400).json({ 
            success: false, 
            error: 'Campaign ID is required'
        });
    }

    console.log(`🔍 DIAGNOSTIC: Looking for campaign: ${campaignId}`);

    try {
        // Use your exact environment variables
        const volumeKeyId = process.env.VOLUME_KEY_ID;
        const volumeKey = process.env.VOLUME_KEY;

        if (!volumeKeyId || !volumeKey) {
            return res.status(401).json({ 
                success: false, 
                error: 'Missing Voluum credentials'
            });
        }

        // Step 1: Authenticate
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
            return res.status(401).json({ 
                success: false, 
                error: 'Voluum authentication failed',
                debug: { authStatus: authResponse.status, authError }
            });
        }

        const authData = await authResponse.json();
        const token = authData.token;

        console.log('✅ Authenticated successfully');

        // Step 2: Get ALL available campaign IDs from different sources
        const diagnosticData = {
            searchedFor: campaignId,
            availableCampaigns: {
                directCampaignList: [],
                reportAPI: [],
                workspaceCampaigns: []
            },
            searchResults: {
                foundInDirectList: false,
                foundInReport: false,
                foundInWorkspace: false
            }
        };

        // Method 1: Direct campaign list
        try {
            console.log('📡 Getting direct campaign list...');
            const campaignListResponse = await fetch('https://api.voluum.com/campaign', {
                headers: {
                    'cwauth-token': token,
                    'Content-Type': 'application/json'
                }
            });

            if (campaignListResponse.ok) {
                const campaigns = await campaignListResponse.json();
                console.log(`📊 Direct list: ${campaigns.length} campaigns`);
                
                diagnosticData.availableCampaigns.directCampaignList = campaigns.map(c => ({
                    id: c.id,
                    name: c.name,
                    status: c.status,
                    isTarget: c.id === campaignId
                }));
                
                const found = campaigns.find(c => c.id === campaignId);
                if (found) {
                    diagnosticData.searchResults.foundInDirectList = true;
                    console.log('✅ Found in direct list!');
                }
            } else {
                console.log(`⚠️ Direct list failed: ${campaignListResponse.status}`);
            }
        } catch (error) {
            console.log(`⚠️ Direct list error: ${error.message}`);
        }

        // Method 2: Report API (like your working campaigns endpoint)
        try {
            console.log('📡 Getting campaigns from report API...');
            const currentDate = new Date();
            const last90Days = new Date(currentDate.getTime() - (90 * 24 * 60 * 60 * 1000));
            
            const startDate = last90Days.toISOString().split('T')[0];
            const endDate = currentDate.toISOString().split('T')[0];
            
            const reportUrl = `https://api.voluum.com/report?from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&groupBy=campaign&limit=1000`;
            
            const reportResponse = await fetch(reportUrl, {
                headers: {
                    'cwauth-token': token,
                    'Content-Type': 'application/json'
                }
            });

            if (reportResponse.ok) {
                const reportData = await reportResponse.json();
                console.log(`📊 Report API: ${reportData.rows?.length || 0} campaigns`);
                
                if (reportData.rows && reportData.columns) {
                    const campaignIdIndex = reportData.columns.indexOf('campaignId');
                    const campaignNameIndex = reportData.columns.indexOf('campaignName');
                    
                    if (campaignIdIndex >= 0) {
                        diagnosticData.availableCampaigns.reportAPI = reportData.rows.map(row => ({
                            id: row[campaignIdIndex],
                            name: campaignNameIndex >= 0 ? row[campaignNameIndex] : 'Unknown',
                            isTarget: row[campaignIdIndex] === campaignId
                        }));
                        
                        const found = reportData.rows.find(row => row[campaignIdIndex] === campaignId);
                        if (found) {
                            diagnosticData.searchResults.foundInReport = true;
                            console.log('✅ Found in report API!');
                        }
                    }
                }
            } else {
                console.log(`⚠️ Report API failed: ${reportResponse.status}`);
            }
        } catch (error) {
            console.log(`⚠️ Report API error: ${error.message}`);
        }

        // Method 3: Check workspaces (based on your working implementation)
        try {
            console.log('📡 Checking workspaces...');
            
            // Your known workspaces from the working implementation
            const workspaces = [
                '9345f0cf-ffb4-43b6-8548-3f71c346bcea', // MG+J workspace
                'ff231fd9-7055-4caa-97f0-ec6e18d26083'  // Tim - B1A1 workspace
            ];

            for (const workspaceId of workspaces) {
                try {
                    const wsResponse = await fetch('https://api.voluum.com/campaign', {
                        headers: {
                            'cwauth-token': token,
                            'Content-Type': 'application/json',
                            'workspace': workspaceId
                        }
                    });

                    if (wsResponse.ok) {
                        const wsCampaigns = await wsResponse.json();
                        console.log(`📊 Workspace ${workspaceId}: ${wsCampaigns.length} campaigns`);
                        
                        const workspaceCampaigns = wsCampaigns.map(c => ({
                            id: c.id,
                            name: c.name,
                            workspace: workspaceId,
                            isTarget: c.id === campaignId
                        }));
                        
                        diagnosticData.availableCampaigns.workspaceCampaigns.push(...workspaceCampaigns);
                        
                        const found = wsCampaigns.find(c => c.id === campaignId);
                        if (found) {
                            diagnosticData.searchResults.foundInWorkspace = true;
                            diagnosticData.foundInWorkspaceId = workspaceId;
                            console.log(`✅ Found in workspace ${workspaceId}!`);
                        }
                    }
                } catch (wsError) {
                    console.log(`⚠️ Workspace ${workspaceId} error: ${wsError.message}`);
                }
            }
        } catch (error) {
            console.log(`⚠️ Workspace check error: ${error.message}`);
        }

        // Step 3: Analyze results
        const totalFound = diagnosticData.availableCampaigns.directCampaignList.length + 
                          diagnosticData.availableCampaigns.reportAPI.length + 
                          diagnosticData.availableCampaigns.workspaceCampaigns.length;

        const foundAnywhere = diagnosticData.searchResults.foundInDirectList || 
                             diagnosticData.searchResults.foundInReport || 
                             diagnosticData.searchResults.foundInWorkspace;

        // Step 4: Find Taboola campaigns for testing
        const allCampaigns = [
            ...diagnosticData.availableCampaigns.directCampaignList,
            ...diagnosticData.availableCampaigns.reportAPI,
            ...diagnosticData.availableCampaigns.workspaceCampaigns
        ];

        const taboolaCampaigns = allCampaigns.filter(c => 
            c.name && c.name.toLowerCase().includes('taboola')
        ).slice(0, 5); // First 5 Taboola campaigns

        console.log(`🔍 DIAGNOSTIC COMPLETE: Found ${totalFound} total campaigns, target found: ${foundAnywhere}`);

        if (foundAnywhere) {
            // If we found the campaign, return success
            const foundCampaign = allCampaigns.find(c => c.isTarget);
            return res.json({
                success: true,
                campaign: {
                    id: foundCampaign.id,
                    name: foundCampaign.name,
                    detectedTrafficSource: detectTrafficSource(foundCampaign.name),
                    status: 'FOUND_IN_DIAGNOSTIC'
                },
                dataSource: 'Diagnostic search',
                diagnostic: diagnosticData
            });
        } else {
            // Return detailed diagnostic info
            return res.status(404).json({
                success: false,
                error: `Campaign ${campaignId} not found in any source`,
                diagnostic: diagnosticData,
                suggestions: {
                    totalCampaignsFound: totalFound,
                    taboolaCampaignsAvailable: taboolaCampaigns,
                    recommendedTest: taboolaCampaigns.length > 0 ? 
                        `Try testing with Taboola campaign: ${taboolaCampaigns[0].name} (ID: ${taboolaCampaigns[0].id})` :
                        'No Taboola campaigns found in available data',
                    possibleCauses: [
                        'Campaign ID is from a different time period',
                        'Campaign may be in a different workspace',
                        'Campaign may have been deleted',
                        'Dashboard is showing cached data'
                    ]
                }
            });
        }

    } catch (error) {
        console.error('❌ Diagnostic error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug: {
                campaignId: campaignId,
                errorStack: error.stack
            }
        });
    }
}

function detectTrafficSource(campaignName) {
    if (!campaignName) return 'unknown';
    
    const name = campaignName.toLowerCase();
    if (name.includes('taboola')) return 'taboola';
    if (name.includes('facebook') || name.includes('fb')) return 'facebook';
    if (name.includes('newsbreak')) return 'newsbreak';
    if (name.includes('admaven')) return 'admaven';
    return 'other';
}
