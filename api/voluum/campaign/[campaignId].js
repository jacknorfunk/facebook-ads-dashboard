// /api/voluum/campaign/[campaignId].js - Get specific campaign details
// Following official Voluum API documentation: https://developers.voluum.com/

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { campaignId } = req.query;
        
        if (!campaignId) {
            return res.status(400).json({
                success: false,
                error: 'campaignId is required'
            });
        }

        console.log(`🎯 Fetching campaign details for ID: ${campaignId}`);

        // Get Voluum API credentials
        const VOLUME_KEY = process.env.VOLUME_KEY;
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;
        
        if (!VOLUME_KEY || !VOLUME_KEY_ID) {
            throw new Error('Voluum API credentials not configured. Missing VOLUME_KEY or VOLUME_KEY_ID environment variables');
        }

        // Step 1: Create session
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
            throw new Error(`Failed to create Voluum session: ${sessionResponse.status} - ${errorText}`);
        }

        const sessionData = await sessionResponse.json();
        const authToken = sessionData.token;
        
        if (!authToken) {
            throw new Error('No auth token received from Voluum API');
        }

        console.log('✅ Voluum session created successfully');

        // Step 2: Get campaign details
        console.log(`📊 Fetching campaign details for: ${campaignId}`);
        
        const campaignResponse = await fetch(`https://api.voluum.com/campaign/${campaignId}`, {
            method: 'GET',
            headers: {
                'cwauth-token': authToken,
                'Accept': 'application/json'
            }
        });

        if (!campaignResponse.ok) {
            const errorText = await campaignResponse.text();
            console.error('❌ Campaign fetch failed:', errorText);
            throw new Error(`Failed to fetch campaign: ${campaignResponse.status} - ${errorText}`);
        }

        const campaignData = await campaignResponse.json();
        console.log('✅ Campaign data fetched successfully');

        return res.status(200).json({
            success: true,
            campaign: campaignData,
            metadata: {
                campaignId: campaignId,
                fetchTime: new Date().toISOString(),
                source: 'voluum_api'
            }
        });

    } catch (error) {
        console.error('❌ Error fetching campaign details:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            campaignId: req.query.campaignId
        });
    }
}