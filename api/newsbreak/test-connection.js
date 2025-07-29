// /api/newsbreak/test-connection.js
// Corrected NewsBreak API connection test with proper endpoint and headers
export default async function handler(req, res) {
    console.log('🔍 Testing NewsBreak API connection with correct endpoint...');
    
    try {
        // Get API key from environment
        const newsbreakKey = process.env.newsbreak_key;
        
        console.log('API Key status:', newsbreakKey ? `Found (${newsbreakKey.length} chars)` : 'Missing');
        
        if (!newsbreakKey) {
            return res.status(500).json({
                success: false,
                error: 'NewsBreak API key not found in environment variables',
                debug: {
                    env_vars_available: Object.keys(process.env).filter(key => 
                        key.toLowerCase().includes('news') || 
                        key.toLowerCase().includes('break') || 
                        key.toLowerCase().includes('key')
                    ),
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Use the CORRECT endpoint from the curl example
        console.log('🔑 Making test request to correct NewsBreak API endpoint...');
        
        // Correct endpoint: /business-api/v1/reports/getIntegratedReport
        const testReportPayload = {
            name: "API Connection Test",
            dateRange: "FIXED",
            startDate: "2024-07-01",
            endDate: "2024-07-01", 
            filter: null,
            filterIds: [],
            dimensions: ["DATE"],
            metrics: ["COST"],
            emails: [],
            editors: []
        };

        const testResponse = await fetch('https://business.newsbreak.com/business-api/v1/reports/getIntegratedReport', {
            method: 'POST',
            headers: {
                'Access-Token': newsbreakKey, // Correct header name: Access-Token (not access_token)
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(testReportPayload)
        });

        console.log('API Response status:', testResponse.status);
        console.log('API Response headers:', Object.fromEntries(testResponse.headers.entries()));

        const responseText = await testResponse.text();
        console.log('Raw response:', responseText);
        
        let responseData;
        try {
            responseData = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Failed to parse response as JSON:', parseError);
            responseData = { raw_response: responseText };
        }

        if (!testResponse.ok) {
            console.error('❌ NewsBreak API error:', responseData);
            
            return res.status(testResponse.status).json({
                success: false,
                error: `NewsBreak API test failed: ${testResponse.status}`,
                details: responseData,
                debug: {
                    status_code: testResponse.status,
                    status_text: testResponse.statusText,
                    headers: Object.fromEntries(testResponse.headers.entries()),
                    request_payload: testReportPayload,
                    correct_endpoint: 'https://business.newsbreak.com/business-api/v1/reports/getIntegratedReport',
                    correct_header: 'Access-Token',
                    timestamp: new Date().toISOString()
                }
            });
        }

        console.log('✅ NewsBreak API connection successful');

        return res.json({
            success: true,
            message: 'NewsBreak API connection successful',
            response_data: responseData,
            debug: {
                api_endpoint: 'https://business.newsbreak.com/business-api/v1/reports/getIntegratedReport',
                response_status: testResponse.status,
                request_method: 'POST',
                auth_method: 'Access-Token header',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('💥 NewsBreak test connection error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug: {
                error_name: error.name,
                error_stack: error.stack,
                timestamp: new Date().toISOString()
            }
        });
    }
}
