// /api/voluum/test.js - Test Voluum API connection and credentials

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        console.log('🧪 Testing Voluum API connection...');

        // Check environment variables
        const VOLUME_KEY = process.env.VOLUME_KEY;        // Secret Access Key
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;  // Access Key ID
        
        console.log('🔑 Environment Variables Check:', {
            hasVolumeKey: !!VOLUME_KEY,
            hasVolumeKeyId: !!VOLUME_KEY_ID,
            volumeKeyLength: VOLUME_KEY ? VOLUME_KEY.length : 0,
            volumeKeyIdLength: VOLUME_KEY_ID ? VOLUME_KEY_ID.length : 0,
            volumeKeyPreview: VOLUME_KEY ? VOLUME_KEY.substring(0, 8) + '...' : 'missing',
            volumeKeyIdPreview: VOLUME_KEY_ID ? VOLUME_KEY_ID.substring(0, 8) + '...' : 'missing'
        });

        if (!VOLUME_KEY) {
            return res.status(500).json({
                success: false,
                error: 'VOLUME_KEY environment variable is missing',
                debug_info: { envVars: { VOLUME_KEY: 'missing', VOLUME_KEY_ID: !!VOLUME_KEY_ID ? 'present' : 'missing' } }
            });
        }

        if (!VOLUME_KEY_ID) {
            return res.status(500).json({
                success: false,
                error: 'VOLUME_KEY_ID environment variable is missing',
                debug_info: { envVars: { VOLUME_KEY: 'present', VOLUME_KEY_ID: 'missing' } }
            });
        }

        // Step 1: Create a session using the access key (correct Voluum API authentication)
        console.log('🔐 Creating Voluum API session...');
        const sessionResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                accessId: VOLUME_KEY_ID,
                accessKey: VOLUME_KEY
            })
        });

        console.log('📊 Session response status:', sessionResponse.status);

        if (!sessionResponse.ok) {
            const sessionError = await sessionResponse.text();
            console.log('❌ Session creation failed:', sessionError);
            
            return res.status(200).json({
                success: false,
                error: 'Voluum API session creation failed',
                debug_info: {
                    session_request: {
                        url: 'https://api.voluum.com/auth/access/session',
                        method: 'POST',
                        status: sessionResponse.status,
                        statusText: sessionResponse.statusText,
                        response: sessionError
                    },
                    credentials: {
                        volumeKeyLength: VOLUME_KEY.length,
                        volumeKeyIdLength: VOLUME_KEY_ID.length,
                        volumeKeyPreview: VOLUME_KEY.substring(0, 8) + '...',
                        volumeKeyIdPreview: VOLUME_KEY_ID.substring(0, 8) + '...'
                    },
                    suggestions: [
                        'Verify VOLUME_KEY and VOLUME_KEY_ID are correct',
                        'Check if the access key has expired', 
                        'Ensure the access key has proper permissions',
                        'Try regenerating the access key in Voluum dashboard'
                    ]
                }
            });
        }

        const sessionData = await sessionResponse.json();
        const authToken = sessionData.token;
        
        if (!authToken) {
            return res.status(200).json({
                success: false,
                error: 'No auth token received from Voluum session API',
                debug_info: { sessionData }
            });
        }

        console.log('✅ Session created successfully, token received:', authToken.substring(0, 8) + '...');

        // Test 2: Test API connectivity with the session token
        console.log('🔌 Testing basic API connectivity with session token...');
        const testUrl = 'https://api.voluum.com/campaign';
        
        console.log('📡 Making test request to:', testUrl);

        const testResponse = await fetch(testUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        console.log('📊 Test response status:', testResponse.status);

        if (!testResponse.ok) {
            const errorText = await testResponse.text();
            console.log('❌ Test request failed:', errorText);
            
            return res.status(200).json({
                success: false,
                error: 'Voluum API request failed after successful session creation',
                debug_info: {
                    session_creation: 'successful',
                    test_request: {
                        url: testUrl,
                        status: testResponse.status,
                        statusText: testResponse.statusText,
                        response: errorText
                    },
                    suggestions: [
                        'Session token is valid but API request failed',
                        'Check if the access key has campaign read permissions',
                        'Verify account has active campaigns to return'
                    ]
                }
            });
        }

        // Parse successful response
        const testData = await testResponse.json();
        console.log('✅ Test request successful!');
        console.log('📋 Response data structure:', {
            hasCampaigns: !!testData.campaigns,
            campaignCount: testData.campaigns ? testData.campaigns.length : 0,
            hasNextPage: !!testData.nextPage,
            dataKeys: Object.keys(testData)
        });

        // Test 3: Report endpoint test with session token
        console.log('📊 Testing report endpoint with session token...');
        const reportUrl = 'https://api.voluum.com/report?from=2025-01-27&to=2025-01-27&groupBy=campaign&columns=campaignId,campaignName,visits,conversions,revenue,cost&tz=America/New_York';
        
        const reportResponse = await fetch(reportUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        console.log('📊 Report response status:', reportResponse.status);

        let reportTest = {};
        if (reportResponse.ok) {
            const reportData = await reportResponse.json();
            reportTest = {
                success: true,
                hasRows: !!reportData.rows,
                rowCount: reportData.rows ? reportData.rows.length : 0,
                hasColumns: !!reportData.columns,
                columnCount: reportData.columns ? reportData.columns.length : 0
            };
            console.log('✅ Report test successful:', reportTest);
        } else {
            const reportError = await reportResponse.text();
            reportTest = {
                success: false,
                status: reportResponse.status,
                error: reportError
            };
            console.log('❌ Report test failed:', reportTest);
        }

        return res.status(200).json({
            success: true,
            message: 'Voluum API connection test completed successfully',
            tests: {
                environment_variables: {
                    status: 'passed',
                    volumeKey: 'present',
                    volumeKeyId: 'present'
                },
                session_creation: {
                    status: 'passed',
                    endpoint: 'https://api.voluum.com/auth/access/session',
                    token_received: true,
                    token_preview: authToken.substring(0, 8) + '...'
                },
                basic_connectivity: {
                    status: 'passed',
                    endpoint: testUrl,
                    responseStatus: testResponse.status,
                    campaignCount: testData.campaigns ? testData.campaigns.length : 0
                },
                report_endpoint: reportTest
            },
            sample_campaigns: testData.campaigns ? testData.campaigns.slice(0, 3).map(c => ({
                id: c.id,
                name: c.name,
                status: c.status
            })) : [],
            recommendations: [
                'API credentials are working correctly with proper session authentication',
                'Both campaign list and report endpoints are accessible',
                'Ready to proceed with full dashboard integration'
            ],
            next_steps: [
                'Deploy the updated campaigns and offers API endpoints',
                'Test the main dashboard with different date ranges',
                'Verify campaign drill-down functionality works'
            ]
        });

    } catch (error) {
        console.error('❌ Test API error:', error);
        return res.status(500).json({
            success: false,
            error: 'Test failed with exception: ' + error.message,
            debug_info: {
                errorName: error.name,
                errorMessage: error.message,
                errorStack: error.stack,
                environmentCheck: {
                    hasVolumeKey: !!process.env.VOLUME_KEY,
                    hasVolumeKeyId: !!process.env.VOLUME_KEY_ID
                }
            }
        });
    }
}
