// /api/test-env.js - Test Environment Variables

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
        
        if (accessId) {
            console.log('VOLUME_KEY_ID length:', accessId.length);
            console.log('VOLUME_KEY_ID first 8 chars:', accessId.substring(0, 8));
            console.log('VOLUME_KEY_ID last 8 chars:', accessId.substring(accessId.length - 8));
        }
        
        if (accessKey) {
            console.log('VOLUME_KEY length:', accessKey.length);
            console.log('VOLUME_KEY first 8 chars:', accessKey.substring(0, 8));
            console.log('VOLUME_KEY last 8 chars:', accessKey.substring(accessKey.length - 8));
        }

        // Test basic Voluum API connectivity
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
                console.log('Auth response headers:', Object.fromEntries(authResponse.headers.entries()));
                
                const authResponseText = await authResponse.text();
                console.log('Auth response body:', authResponseText.substring(0, 500));
                
                let authData = null;
                try {
                    authData = JSON.parse(authResponseText);
                } catch (e) {
                    console.log('Could not parse auth response as JSON');
                }
                
                return res.status(200).json({
                    success: true,
                    environment_check: {
                        volume_key_id_present: !!accessId,
                        volume_key_present: !!accessKey,
                        volume_key_id_length: accessId ? accessId.length : 0,
                        volume_key_length: accessKey ? accessKey.length : 0,
                        volume_key_id_preview: accessId ? `${accessId.substring(0, 8)}...${accessId.substring(accessId.length - 8)}` : null,
                        volume_key_preview: accessKey ? `${accessKey.substring(0, 8)}...${accessKey.substring(accessKey.length - 8)}` : null
                    },
                    api_test: {
                        auth_attempted: true,
                        auth_status: authResponse.status,
                        auth_success: authResponse.ok,
                        auth_response_preview: authResponseText.substring(0, 200),
                        has_token: authData && authData.token ? true : false
                    }
                });
                
            } catch (apiError) {
                console.error('API test error:', apiError);
                
                return res.status(200).json({
                    success: false,
                    environment_check: {
                        volume_key_id_present: !!accessId,
                        volume_key_present: !!accessKey,
                        volume_key_id_length: accessId ? accessId.length : 0,
                        volume_key_length: accessKey ? accessKey.length : 0
                    },
                    api_test: {
                        auth_attempted: true,
                        auth_error: apiError.message,
                        error_type: apiError.name
                    }
                });
            }
        } else {
            return res.status(200).json({
                success: false,
                error: 'Missing environment variables',
                environment_check: {
                    volume_key_id_present: !!accessId,
                    volume_key_present: !!accessKey,
                    missing_vars: [
                        !accessId ? 'VOLUME_KEY_ID' : null,
                        !accessKey ? 'VOLUME_KEY' : null
                    ].filter(Boolean)
                }
            });
        }
        
    } catch (error) {
        console.error('Test endpoint error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
}
