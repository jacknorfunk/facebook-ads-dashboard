// Test endpoint to debug Voluum offers API
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { campaignId } = req.query;
    
    if (!campaignId) {
        return res.status(400).json({
            success: false,
            error: 'campaignId parameter is required'
        });
    }

    try {
        console.log(`🧪 Testing offers API for campaign: ${campaignId}`);

        // Get Voluum API credentials
        const VOLUME_KEY = process.env.VOLUME_KEY;
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;
        
        if (!VOLUME_KEY || !VOLUME_KEY_ID) {
            return res.status(500).json({
                success: false,
                error: 'Voluum API credentials not configured',
                debug: {
                    hasVolumeKey: !!VOLUME_KEY,
                    hasVolumeKeyId: !!VOLUME_KEY_ID
                }
            });
        }

        // Create session
        console.log('🔐 Creating Voluum API session...');
        const sessionResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                accessKey: VOLUME_KEY,
                accessKeyId: VOLUME_KEY_ID
            })
        });

        if (!sessionResponse.ok) {
            const errorText = await sessionResponse.text();
            return res.status(500).json({
                success: false,
                error: `Failed to create Voluum session: ${sessionResponse.status}`,
                debug: {
                    sessionStatus: sessionResponse.status,
                    sessionError: errorText
                }
            });
        }

        const sessionData = await sessionResponse.json();
        const authToken = sessionData.token;
        
        if (!authToken) {
            return res.status(500).json({
                success: false,
                error: 'No auth token received from Voluum API',
                debug: { sessionData }
            });
        }

        console.log('✅ Voluum session created successfully');

        // Test the offers API call
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        const reportUrl = `https://api.voluum.com/report?from=${startDateStr}T00Z&to=${endDateStr}T00Z&tz=America/New_York&groupBy=offer&campaignId=${campaignId}&limit=1000`;
        
        console.log(`🎯 Testing API URL:`, reportUrl);

        const reportResponse = await fetch(reportUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        const responseText = await reportResponse.text();
        let reportData;
        
        try {
            reportData = JSON.parse(responseText);
        } catch (parseError) {
            reportData = { parseError: parseError.message, rawResponse: responseText };
        }

        return res.status(200).json({
            success: true,
            debug: {
                campaignId,
                apiUrl: reportUrl,
                responseStatus: reportResponse.status,
                responseOk: reportResponse.ok,
                responseHeaders: Object.fromEntries(reportResponse.headers.entries()),
                responseData: reportData,
                dateRange: {
                    from: startDateStr,
                    to: endDateStr
                }
            }
        });

    } catch (error) {
        console.error('❌ Test API error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug: {
                campaignId,
                stack: error.stack
            }
        });
    }
}