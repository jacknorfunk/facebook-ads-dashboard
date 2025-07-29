// /api/newsbreak/auth-test.js  
// Test if the API key is accessible
export default async function handler(req, res) {
    try {
        console.log('🔑 Testing environment variable access...');
        
        const newsbreakKey = process.env.newsbreak_key;
        
        // List all environment variables for debugging (safely)
        const envVars = Object.keys(process.env);
        const newsbreakRelatedVars = envVars.filter(key => 
            key.toLowerCase().includes('news') || 
            key.toLowerCase().includes('break') || 
            key.toLowerCase().includes('key')
        );

        return res.json({
            success: true,
            api_key_status: newsbreakKey ? 'Found' : 'Missing',
            api_key_length: newsbreakKey ? newsbreakKey.length : 0,
            api_key_preview: newsbreakKey ? `${newsbreakKey.substring(0, 8)}...${newsbreakKey.substring(newsbreakKey.length - 4)}` : 'N/A',
            newsbreak_related_vars: newsbreakRelatedVars,
            total_env_vars: envVars.length,
            api_usage_info: {
                authentication_method: 'Access-Token header (corrected)',
                api_endpoint: 'https://business.newsbreak.com/business-api/v1/reports/getIntegratedReport',
                request_method: 'POST'
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Auth test error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
