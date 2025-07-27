// /api/test-env.js - Environment Test Endpoint
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log('=== ENVIRONMENT TEST ===');
        
        // Check environment variables
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;
        
        console.log('VOLUME_KEY_ID exists:', !!accessId);
        console.log('VOLUME_KEY exists:', !!accessKey);
        
        const envCheck = {
            volume_key_id_present: !!accessId,
            volume_key_present: !!accessKey,
            volume_key_id_length: accessId ? accessId.length : 0,
            volume_key_length: accessKey ? accessKey.length : 0
        };

        if (accessId) {
            console.log('VOLUME_KEY_ID length:', accessId.length);
            console.log('VOLUME_KEY_ID preview:', `${accessId.substring(0, 8)}...${accessId.substring(accessId.length - 8)}`);
            envCheck.volume_key_id_preview = `${accessId.substring(0, 8)}...${accessId.substring(accessId.length - 8)}`;
        }
        
        if (accessKey) {
            console.log('VOLUME_KEY length:', accessKey.length);
            console.log('VOLUME_KEY preview:', `${accessKey.substring(0, 8)}...${accessKey.substring(accessKey.length - 8)}`);
            envCheck.volume_key_preview = `${accessKey.substring(0, 8)}...${accessKey.substring(accessKey.length - 8)}`;
        }

        // Test basic Voluum API connectivity if credentials exist
        let apiTest = null;
        if (accessId && accessKey) {
            console.log('Testing Voluum API authentication...');
            
            try {
                const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        accessId: accessId,
                        accessKey: accessKey
                    })
                });
                
                console.log('Auth response status:', authResponse.status);
                
                const authResponseText = await authResponse.text();
                console.log('Auth response body preview:', authResponseText.substring(0, 200));
                
                let authData = null;
                try {
                    authData = JSON.parse(authResponseText);
                } catch (e) {
                    console.log('Could not parse auth response as JSON');
                }
                
                apiTest = {
                    auth_attempted: true,
                    auth_status: authResponse.status,
                    auth_success: authResponse.ok,
                    auth_response_preview: authResponseText.substring(0, 200),
                    has_token: authData && authData.token ? true : false,
                    token_preview: authData && authData.token ? `${authData.token.substring(0, 20)}...` : null
                };
                
            } catch (apiError) {
                console.error('API test error:', apiError);
                
                apiTest = {
                    auth_attempted: true,
                    auth_error: apiError.message,
                    error_type: apiError.name
                };
            }
        }

        // Determine overall success
        const success = envCheck.volume_key_id_present && 
                        envCheck.volume_key_present && 
                        (!apiTest || apiTest.auth_success);

        return res.status(200).json({
            success,
            environment_check: envCheck,
            api_test: apiTest,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'unknown'
        });
        
    } catch (error) {
        console.error('Test endpoint error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
