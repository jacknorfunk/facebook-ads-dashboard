// /api/test-connection.js - Simple test endpoint to verify API is working

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Check environment variables
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;
        
        return res.status(200).json({
            success: true,
            message: 'API is working',
            timestamp: new Date().toISOString(),
            env_check: {
                volume_key_id_exists: !!accessId,
                volume_key_exists: !!accessKey,
                volume_key_id_length: accessId ? accessId.length : 0,
                volume_key_length: accessKey ? accessKey.length : 0
            },
            request_info: {
                method: req.method,
                url: req.url,
                headers: req.headers,
                query: req.query
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
