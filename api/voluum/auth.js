// /api/voluum/auth.js - Fixed Authentication Endpoint
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log('=== VOLUUM AUTH REQUEST ===');
        
        // Get environment variables
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;
        
        console.log('Environment check:', {
            hasAccessId: !!accessId,
            hasAccessKey: !!accessKey,
            accessIdLength: accessId?.length,
            accessKeyLength: accessKey?.length
        });

        if (!accessId || !accessKey) {
            return res.status(400).json({
                success: false,
                error: 'Missing environment variables',
                missing: {
                    accessId: !accessId,
                    accessKey: !accessKey
                }
            });
        }

        // Authenticate with Voluum API
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

        const responseText = await authResponse.text();
        console.log('Auth response body:', responseText.substring(0, 500));

        if (!authResponse.ok) {
            return res.status(authResponse.status).json({
                success: false,
                error: 'Voluum authentication failed',
                status: authResponse.status,
                response: responseText.substring(0, 200)
            });
        }

        let authData;
        try {
            authData = JSON.parse(responseText);
        } catch (parseError) {
            return res.status(500).json({
                success: false,
                error: 'Invalid JSON response from Voluum',
                response: responseText.substring(0, 200)
            });
        }

        if (!authData.token) {
            return res.status(500).json({
                success: false,
                error: 'No token in auth response',
                response: authData
            });
        }

        console.log('Authentication successful, token received');

        return res.status(200).json({
            success: true,
            token: authData.token,
            expiresAt: authData.expiresAt
        });

    } catch (error) {
        console.error('Auth endpoint error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
