// /api/voluum/test-workspace-access.js
// Test workspace access and find where campaigns are located

export default async function handler(req, res) {
    // Set CORS headers
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
                error: 'Missing Voluum credentials',
                debug: { 
                    volumeKeyId_exists: !!volumeKeyId, 
                    volumeKey_exists: !!volumeKey 
                }
            });
        }

        console.log('🔐 Authenticating with Voluum...');
        
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
            const authError = await authResponse.text();
            console.error('Voluum auth failed:', authError);
            throw new Error(`Auth failed: ${authResponse.status} ${authResponse.statusText}`);
        }

        const authData = await authResponse.json();
        const token = authData.token;

        if (!token) {
            throw new Error('No token received from Voluum auth');
        }

        console.log('✅ Authentication successful, testing workspace access...');

        // Step 2: Test multiple workspace-related endpoints
        const testResults = {};

        // Test 1: Get current profile with more details
        try {
            const profileResponse = await fetch('https://api.voluum.com/profile', {
                method: 'GET',
                headers: {
                    'cwauth-token': token,
                    'Content-Type': 'application/json'
                }
            });

            if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                testResults.profile = {
                    status: profileResponse.status,
                    data: profileData
                };
            } else {
                testResults.profile = {
                    status: profileResponse.status,
                    error: await profileResponse.text()
                };
            }
        } catch (error) {
            testResults.profile = { error: error.message };
        }

        // Test 2: Get workspaces
        try {
            const workspaceResponse = await fetch('https://api.voluum.com/multiuser/workspace', {
                method: 'GET',
                headers: {
                    'cwauth-token': token,
                    'Content-Type': 'application/json'
                }
            });

            if (workspaceResponse.ok) {
                const workspaceData = await workspaceResponse.json();
                testResults.workspaces = {
                    status: workspaceResponse.status,
                    count: Array.isArray(workspaceData) ? workspaceData.length : 0,
                    data: workspaceData
                };
            } else {
                testResults.workspaces = {
                    status: workspaceResponse.status,
                    error: await workspaceResponse.text()
                };
            }
        } catch (error) {
            testResults.workspaces = { error: error.message };
        }

        // Test 3: Get memberships (multi-user access)
        try {
            const membershipResponse = await fetch('https://api.voluum.com/multiuser/membership', {
                method: 'GET',
                headers: {
                    'cwauth-token': token,
                    'Content-Type': 'application/json'
                }
            });

            if (membershipResponse.ok) {
                const membershipData = await membershipResponse.json();
                testResults.memberships = {
                    status: membershipResponse.status,
                    data: membershipData
                };
            } else {
                testResults.memberships = {
                    status: membershipResponse.status,
                    error: await membershipResponse.text()
                };
            }
        } catch (error) {
            testResults.memberships = { error: error.message };
        }

        // Test 4: Test campaigns in different ways
        try {
            const campaignResponse = await fetch('https://api.voluum.com/campaign', {
                method: 'GET',
                headers: {
                    'cwauth-token': token,
                    'Content-Type': 'application/json'
                }
            });

            if (campaignResponse.ok) {
                const campaignData = await campaignResponse.json();
                testResults.campaigns = {
                    status: campaignResponse.status,
                    count: Array.isArray(campaignData) ? campaignData.length : 0,
                    data: campaignData
                };
            } else {
                testResults.campaigns = {
                    status: campaignResponse.status,
                    error: await campaignResponse.text()
                };
            }
        } catch (error) {
            testResults.campaigns = { error: error.message };
        }

        // Test 5: If we have workspaces, try to get campaigns from each workspace
        if (testResults.workspaces?.data && Array.isArray(testResults.workspaces.data)) {
            testResults.workspace_campaigns = {};
            
            for (const workspace of testResults.workspaces.data) {
                try {
                    // Try different methods to access campaigns in specific workspace
                    const workspaceId = workspace.id;
                    
                    // Method 1: Query parameter
                    const campaignResponse1 = await fetch(`https://api.voluum.com/campaign?workspaceId=${workspaceId}`, {
                        headers: { 'cwauth-token': token }
                    });
                    
                    let campaignData1 = null;
                    if (campaignResponse1.ok) {
                        campaignData1 = await campaignResponse1.json();
                    }
                    
                    testResults.workspace_campaigns[workspace.name || workspaceId] = {
                        workspace_id: workspaceId,
                        workspace_name: workspace.name,
                        method1_status: campaignResponse1.status,
                        method1_count: Array.isArray(campaignData1) ? campaignData1.length : 0,
                        method1_data: campaignData1
                    };
                    
                } catch (error) {
                    testResults.workspace_campaigns[workspace.name || workspace.id] = {
                        error: error.message
                    };
                }
            }
        }

        // Test 6: Check if any campaigns exist at all
        try {
            const anyCreatedResponse = await fetch('https://api.voluum.com/any-created/campaign', {
                method: 'GET',
                headers: {
                    'cwauth-token': token,
                    'Content-Type': 'application/json'
                }
            });

            if (anyCreatedResponse.ok) {
                const anyCreatedData = await anyCreatedResponse.json();
                testResults.any_created = {
                    status: anyCreatedResponse.status,
                    data: anyCreatedData
                };
            } else {
                testResults.any_created = {
                    status: anyCreatedResponse.status,
                    error: await anyCreatedResponse.text()
                };
            }
        } catch (error) {
            testResults.any_created = { error: error.message };
        }

        console.log('📊 Workspace access test completed');

        return res.status(200).json({
            success: true,
            test_results: testResults,
            summary: {
                profile_working: !!testResults.profile?.data,
                workspaces_found: testResults.workspaces?.count || 0,
                campaigns_found: testResults.campaigns?.count || 0,
                any_campaigns_exist: testResults.any_created?.data,
                total_workspace_campaigns: testResults.workspace_campaigns ? 
                    Object.values(testResults.workspace_campaigns).reduce((sum, ws) => sum + (ws.method1_count || 0), 0) : 0
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Workspace access test error:', error);
        
        return res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
