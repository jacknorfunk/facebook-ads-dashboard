// /api/voluum/test-workspaces.js
// Diagnostic to check workspace access and find campaigns

export default async function handler(req, res) {
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
                error: 'Missing Voluum credentials'
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

        console.log('✅ Authenticated, checking workspaces...');

        // Step 2: Check current profile/workspace
        let profileData = null;
        try {
            const profileResponse = await fetch('https://api.voluum.com/profile', {
                headers: { 'cwauth-token': token }
            });
            if (profileResponse.ok) {
                profileData = await profileResponse.json();
            }
        } catch (e) {
            console.warn('Could not fetch profile:', e.message);
        }

        // Step 3: Check workspaces
        let workspaceData = null;
        try {
            const workspaceResponse = await fetch('https://api.voluum.com/multiuser/workspace', {
                headers: { 'cwauth-token': token }
            });
            if (workspaceResponse.ok) {
                workspaceData = await workspaceResponse.json();
            }
        } catch (e) {
            console.warn('Could not fetch workspaces:', e.message);
        }

        // Step 4: Test campaign endpoints with different methods
        const testResults = {};

        // Test 1: Basic campaign endpoint
        try {
            const campaignResponse = await fetch('https://api.voluum.com/campaign', {
                headers: { 'cwauth-token': token }
            });
            const campaignData = await campaignResponse.json();
            testResults.basic_campaign = {
                status: campaignResponse.status,
                count: Array.isArray(campaignData) ? campaignData.length : 0,
                data: campaignData
            };
        } catch (e) {
            testResults.basic_campaign = { error: e.message };
        }

        // Test 5: Try to get campaigns from all workspaces
        if (workspaceData && Array.isArray(workspaceData)) {
            testResults.workspace_campaigns = {};
            
            for (const workspace of workspaceData) {
                try {
                    // Try campaign endpoint with workspace context
                    const wsResponse = await fetch(`https://api.voluum.com/campaign?workspace=${workspace.id}`, {
                        headers: { 'cwauth-token': token }
                    });
                    const wsData = await wsResponse.json();
                    
                    testResults.workspace_campaigns[workspace.name || workspace.id] = {
                        workspace_id: workspace.id,
                        status: wsResponse.status,
                        count: Array.isArray(wsData) ? wsData.length : 0,
                        campaigns: wsData
                    };
                } catch (e) {
                    testResults.workspace_campaigns[workspace.name || workspace.id] = { 
                        error: e.message 
                    };
                }
            }
        }

        // Test 2: Any created campaigns check
        try {
            const anyCreatedResponse = await fetch('https://api.voluum.com/any-created/campaign', {
                headers: { 'cwauth-token': token }
            });
            const anyCreatedData = await anyCreatedResponse.json();
            testResults.any_created = {
                status: anyCreatedResponse.status,
                data: anyCreatedData
            };
        } catch (e) {
            testResults.any_created = { error: e.message };
        }

        // Test 3: Report with minimal params
        try {
            const reportResponse = await fetch('https://api.voluum.com/report?columns=campaign', {
                headers: { 'cwauth-token': token }
            });
            const reportData = await reportResponse.json();
            testResults.minimal_report = {
                status: reportResponse.status,
                totalRows: reportData.totalRows || 0,
                rows: reportData.rows?.length || 0,
                data: reportData
            };
        } catch (e) {
            testResults.minimal_report = { error: e.message };
        }

        // Test 4: Report with date range (yesterday)
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const dateStr = yesterday.toISOString().split('T')[0];
            
            const reportResponse = await fetch(`https://api.voluum.com/report?from=${dateStr}&to=${dateStr}&groupBy=campaign&columns=visits,conversions,revenue,cost`, {
                headers: { 'cwauth-token': token }
            });
            const reportData = await reportResponse.json();
            testResults.yesterday_report = {
                status: reportResponse.status,
                date: dateStr,
                totalRows: reportData.totalRows || 0,
                rows: reportData.rows?.length || 0,
                data: reportData
            };
        } catch (e) {
            testResults.yesterday_report = { error: e.message };
        }

        return res.status(200).json({
            success: true,
            profile: profileData,
            workspaces: workspaceData,
            test_results: testResults,
            diagnosis: {
                current_workspace: profileData?.workspace || 'Unknown',
                available_workspaces: Array.isArray(workspaceData) ? workspaceData.length : 0,
                campaigns_found: Math.max(
                    testResults.basic_campaign?.count || 0,
                    testResults.minimal_report?.rows || 0,
                    testResults.yesterday_report?.rows || 0
                )
            }
        });

    } catch (error) {
        console.error('❌ Workspace diagnostic error:', error);
        
        return res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
