// /api/voluum/campaignById.js - Campaign Details via POST /bulk/campaign/select
// Implements the POST /bulk/campaign/select endpoint as requested in requirements
// Uses only live Voluum data with proper error handling and no dummy data

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed. Use POST for bulk campaign select.' 
        });
    }

    try {
        const { campaignId } = req.body;
        
        if (!campaignId) {
            return res.status(400).json({
                success: false,
                error: 'Campaign ID is required in request body'
            });
        }

        console.log(`🔍 Fetching campaign details for ID: ${campaignId}`);

        // Get Voluum API credentials
        const VOLUME_KEY = process.env.VOLUME_KEY;
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;
        
        if (!VOLUME_KEY || !VOLUME_KEY_ID) {
            throw new Error('Voluum API credentials not configured. Missing VOLUME_KEY or VOLUME_KEY_ID environment variables');
        }

        // Create session using access key (following official documentation)
        console.log('🔐 Creating Voluum API session for campaign details...');
        const sessionResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                accessId: VOLUME_KEY_ID,
                accessKey: VOLUME_KEY
            })
        });

        if (!sessionResponse.ok) {
            const sessionError = await sessionResponse.text();
            console.log('❌ Campaign session creation failed:', sessionError);
            throw new Error(`Session creation failed: ${sessionResponse.status} - ${sessionError}`);
        }

        const sessionData = await sessionResponse.json();
        const authToken = sessionData.token;
        
        if (!authToken) {
            throw new Error('No auth token received from Voluum session API');
        }

        console.log('✅ Campaign session created successfully');

        // Use the official POST /bulk/campaign/select endpoint
        // Following the official Voluum API documentation structure
        
        console.log(`🎯 Using official POST /bulk/campaign/select endpoint for campaign: ${campaignId}`);
        
        const bulkSelectUrl = 'https://api.voluum.com/bulk/campaign/select';
        
        // Prepare the JSON payload as per official API documentation
        const requestPayload = {
            campaignIds: [campaignId]  // Array of campaign IDs to select
        };
        
        console.log(`📤 Request payload:`, JSON.stringify(requestPayload, null, 2));
        
        const bulkSelectResponse = await fetch(bulkSelectUrl, {
            method: 'POST',
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        if (!bulkSelectResponse.ok) {
            const errorText = await bulkSelectResponse.text();
            console.log(`❌ POST /bulk/campaign/select failed:`, errorText);
            
            // Rate limit handling as mentioned in requirements
            if (bulkSelectResponse.status === 429) {
                console.log(`⏰ Rate limit hit, implementing backoff...`);
                await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000)); // 2-3 second delay
                
                // Retry once after backoff
                const retryResponse = await fetch(bulkSelectUrl, {
                    method: 'POST',
                    headers: {
                        'cwauth-token': authToken,
                        'Content-Type': 'application/json; charset=utf-8',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestPayload)
                });
                
                if (!retryResponse.ok) {
                    throw new Error(`Bulk select retry failed: ${retryResponse.status} - ${await retryResponse.text()}`);
                }
                
                const retryData = await retryResponse.json();
                console.log(`✅ Bulk select retry successful`);
                
                return res.json({
                    success: true,
                    campaign: retryData,
                    source: 'voluum_bulk_campaign_select_retry',
                    debug_info: {
                        endpoint: 'POST /bulk/campaign/select',
                        campaignId: campaignId,
                        rate_limit_handled: true,
                        retry_successful: true,
                        timestamp: new Date().toISOString()
                    }
                });
            }
            
            throw new Error(`Bulk select failed: ${bulkSelectResponse.status} - ${errorText}`);
        }

        const campaignDetails = await bulkSelectResponse.json();
        console.log(`✅ POST /bulk/campaign/select successful for campaign ${campaignId}`);
        console.log(`📊 Campaign details retrieved:`, {
            hasData: !!campaignDetails,
            keys: campaignDetails ? Object.keys(campaignDetails) : []
        });

        // Final check: If no campaign found
        if (!campaignDetails) {
            return res.status(404).json({
                success: false,
                error: `Campaign with ID ${campaignId} not foun
