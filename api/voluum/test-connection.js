// /api/voluum/test-connection.js - Voluum Connection Diagnostic Tool

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log('=== VOLUUM CONNECTION DIAGNOSTIC ===');
        
        // Step 1: Check environment variables
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;
        
        console.log('VOLUME_KEY_ID exists:', !!accessId);
        console.log('VOLUME_KEY exists:', !!accessKey);
        
        const envCheck = {
            volume_key_id_exists: !!accessId,
            volume_key_exists: !!accessKey,
            volume_key_id_length: accessId ? accessId.length : 0,
            volume_key_length: accessKey ? accessKey.length : 0,
            volume_key_id_preview: accessId ? `${accessId.substring(0, 8)}...${accessId.substring(accessId.length - 8)}` : 'MISSING',
            volume_key_preview: accessKey ? `${accessKey.substring(0, 8)}...${accessKey.substring(accessKey.length - 8)}` : 'MISSING'
        };

        if (!accessId || !accessKey) {
            return res.status(200).json({
                success: false,
                step: 'environment_check',
                error: 'Missing Voluum API credentials',
                env_check: envCheck,
                solution: [
                    '1. Go to your deployment platform (Vercel/Netlify/etc.)',
                    '2. Add environment variables:',
                    '   - VOLUME_KEY_ID: Your Voluum Access ID',
                    '   - VOLUME_KEY: Your Voluum Access Key',
                    '3. Redeploy your application',
                    '4. Get these credentials from: Voluum Dashboard → Settings → API Access'
                ],
                debug_info: {
                    platform: 'Check your deployment platform environment variables',
                    required_vars: ['VOLUME_KEY_ID', 'VOLUME_KEY']
                }
            });
        }

        // Step 2: Test Voluum API connectivity
        console.log('Testing Voluum API connectivity...');
        console.log('Access ID length:', accessId.length);
        console.log('Access Key length:', accessKey.length);

        let authResponse;
        let authError = null;
        
        try {
            authResponse = await fetch('https://api.voluum.com/auth/access/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accessId: accessId,
                    accessKey: accessKey
                }),
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });
        } catch (fetchError) {
            authError = fetchError;
            console.error('Fetch error:', fetchError.message);
        }

        if (authError) {
            return res.status(200).json({
                success: false,
                step: 'network_connection',
                error: 'Network connection failed',
                details: authError.message,
                solution: [
                    '1. Check your internet connection',
                    '2. Verify Voluum API is accessible (https://api.voluum.com)',
                    '3. Check if your deployment platform allows external API calls',
                    '4. Try again in a few minutes'
                ],
                debug_info: {
                    error_type: authError.name,
                    error_message: authError.message
                }
            });
        }

        console.log('Auth response status:', authResponse.status);
        console.log('Auth response headers:', Object.fromEntries(authResponse.headers.entries()));

        const authResponseText = await authResponse.text();
        console.log('Auth response body preview:', authResponseText.substring(0, 500));

        if (!authResponse.ok) {
            let errorDetails = 'Unknown error';
            try {
                const errorData = JSON.parse(authResponseText);
                errorDetails = errorData.message || errorData.error || 'Authentication failed';
            } catch (e) {
                errorDetails = authResponseText.substring(0, 200);
            }

            return res.status(200).json({
                success: false,
                step: 'authentication',
                error: 'Voluum authentication failed',
                status_code: authResponse.status,
                details: errorDetails,
                solution: [
                    '1. Verify your Voluum Access ID and Key are correct',
                    '2. Check in Voluum Dashboard → Settings → API Access',
                    '3. Generate new API credentials if needed',
                    '4. Make sure the credentials have proper permissions',
                    '5. Check if your Voluum account is active and not suspended'
                ],
                debug_info: {
                    status: authResponse.status,
                    response_preview: authResponseText.substring(0, 200),
                    headers: Object.fromEntries(authResponse.headers.entries())
                }
            });
        }

        // Step 3: Parse authentication response
        let authData;
        try {
            authData = JSON.parse(authResponseText);
        } catch (parseError) {
            console.error('Failed to parse auth response:', parseError);
            return res.status(200).json({
                success: false,
                step: 'response_parsing',
                error: 'Failed to parse Voluum API response',
                details: 'Response is not valid JSON',
                solution: [
                    '1. This might be a temporary API issue',
                    '2. Try again in a few minutes',
                    '3. Check Voluum API status page',
                    '4. Contact Voluum support if the issue persists'
                ],
                debug_info: {
                    response_preview: authResponseText.substring(0, 200),
                    parse_error: parseError.message
                }
            });
        }

        const token = authData.token;
        if (!token) {
            return res.status(200).json({
                success: false,
                step: 'token_extraction',
                error: 'No token in Voluum API response',
                details: 'Authentication succeeded but no token was returned',
                solution: [
                    '1. Check your API credentials permissions',
                    '2. Verify your Voluum account status',
                    '3. Try regenerating your API credentials',
                    '4. Contact Voluum support'
                ],
                debug_info: {
                    auth_response: authData
                }
            });
        }

        console.log('✅ Authentication successful, token received');

        // Step 4: Test campaigns endpoint with multiple methods
        console.log('Testing campaigns endpoint with multiple authentication methods...');
        let campaignsResponse;
        let campaignsError = null;
        let successMethod = null;

        // Try different authentication methods
        const authMethods = [
            {
                name: 'cwauth-token',
                headers: {
                    'cwauth-token': token,
                    'Content-Type': 'application/json'
                }
            },
            {
                name: 'Bearer token',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            },
            {
                name: 'Query parameter',
                headers: {
                    'Content-Type': 'application/json'
                },
                url: `https://api.voluum.com/campaign?access_token=${token}`
            }
        ];

        for (const method of authMethods) {
            try {
                console.log(`Trying ${method.name} method...`);
                const url = method.url || 'https://api.voluum.com/campaign';
                
                campaignsResponse = await fetch(url, {
                    method: 'GET',
                    headers: method.headers,
                    signal: AbortSignal.timeout(10000)
                });

                console.log(`${method.name} status:`, campaignsResponse.status);

                if (campaignsResponse.ok) {
                    successMethod = method.name;
                    console.log(`✅ Success with ${method.name}!`);
                    break;
                } else {
                    const errorText = await campaignsResponse.text();
                    console.log(`${method.name} failed:`, campaignsResponse.status, errorText.substring(0, 100));
                }
            } catch (fetchError) {
                console.log(`${method.name} error:`, fetchError.message);
                if (!campaignsError) campaignsError = fetchError;
            }
        }

        if (!campaignsResponse || !campaignsResponse.ok) {
        if (!campaignsResponse || !campaignsResponse.ok) {
            const finalError = campaignsError || new Error('All authentication methods failed');
            
            return res.status(200).json({
                success: false,
                step: 'campaigns_access',
                error: 'Failed to access campaigns with any authentication method',
                methods_tried: authMethods.map(m => m.name),
                last_status: campaignsResponse?.status || 'Network Error',
                details: finalError.message,
                solution: [
                    '1. Check API permissions in Voluum Dashboard → Settings → API Access',
                    '2. Ensure "Read Campaigns" permission is enabled',
                    '3. Try regenerating your API credentials',
                    '4. Verify your Voluum account is active and not suspended',
                    '5. Contact Voluum support for API access issues'
                ],
                debug_info: {
                    auth_success: true,
                    token_received: !!token,
                    methods_tested: authMethods.length,
                    final_error: finalError.message
                }
            });
        }

        console.log(`Campaigns response status: ${campaignsResponse.status} using ${successMethod}`);

        const campaignsData = await campaignsResponse.json();
        console.log(`✅ Successfully fetched ${campaignsData.length || 0} campaigns using ${successMethod}`);

        // Step 5: Success response
        return res.status(200).json({
            success: true,
            message: 'Voluum API connection successful',
            test_results: {
                authentication: 'PASSED',
                campaigns_access: 'PASSED',
                total_campaigns: Array.isArray(campaignsData) ? campaignsData.length : 0,
                auth_method_used: successMethod
            },
            env_check: envCheck,
            debug_info: {
                auth_success: true,
                token_received: !!token,
                campaigns_count: Array.isArray(campaignsData) ? campaignsData.length : 0,
                api_endpoints_working: true,
                successful_auth_method: successMethod
            },
            next_steps: [
                '✅ Voluum API is working correctly',
                `✅ Using ${successMethod} authentication method`,
                '✅ You can now use the dashboard',
                'If you still see errors, try refreshing the page'
            ]
        });

    } catch (error) {
        console.error('Diagnostic error:', error);
        return res.status(500).json({
            success: false,
            step: 'unexpected_error',
            error: 'Unexpected error during diagnostic',
            details: error.message,
            solution: [
                '1. This is an unexpected error',
                '2. Check the server logs for more details',
                '3. Try again in a few minutes',
                '4. Contact support if the issue persists'
            ],
            debug_info: {
                error_type: error.name,
                error_message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : 'Hidden in production'
            }
        });
    }
}
