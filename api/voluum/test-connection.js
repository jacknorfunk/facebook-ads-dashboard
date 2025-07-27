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

        // Step 4: Test campaigns endpoint
        console.log('Testing campaigns endpoint...');
        let campaignsResponse;
        let campaignsError = null;

        try {
            campaignsResponse = await fetch('https://api.voluum.com/campaign', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(10000)
            });
        } catch (fetchError) {
            campaignsError = fetchError;
            console.error('Campaigns fetch error:', fetchError.message);
        }

        if (campaignsError) {
            return res.status(200).json({
                success: false,
                step: 'campaigns_fetch',
                error: 'Failed to fetch campaigns',
                details: campaignsError.message,
                solution: [
                    '1. Network connectivity issue',
                    '2. Try again in a few minutes',
                    '3. Check Voluum API status'
                ],
                debug_info: {
                    error_type: campaignsError.name,
                    error_message: campaignsError.message,
                    auth_success: true
                }
            });
        }

        console.log('Campaigns response status:', campaignsResponse.status);

        if (!campaignsResponse.ok) {
            const campaignsErrorText = await campaignsResponse.text();
            return res.status(200).json({
                success: false,
                step: 'campaigns_access',
                error: 'Failed to access campaigns',
                status_code: campaignsResponse.status,
                details: campaignsErrorText.substring(0, 200),
                solution: [
                    '1. Check API permissions in Voluum',
                    '2. Verify your account has access to campaigns',
                    '3. Try regenerating API credentials',
                    '4. Contact Voluum support'
                ],
                debug_info: {
                    status: campaignsResponse.status,
                    response_preview: campaignsErrorText.substring(0, 200)
                }
            });
        }

        const campaignsData = await campaignsResponse.json();
        console.log(`✅ Successfully fetched ${campaignsData.length || 0} campaigns`);

        // Step 5: Success response
        return res.status(200).json({
            success: true,
            message: 'Voluum API connection successful',
            test_results: {
                authentication: 'PASSED',
                campaigns_access: 'PASSED',
                total_campaigns: Array.isArray(campaignsData) ? campaignsData.length : 0
            },
            env_check: envCheck,
            debug_info: {
                auth_success: true,
                token_received: !!token,
                campaigns_count: Array.isArray(campaignsData) ? campaignsData.length : 0,
                api_endpoints_working: true
            },
            next_steps: [
                '✅ Voluum API is working correctly',
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
