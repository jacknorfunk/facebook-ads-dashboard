// /api/voluum/campaignById.js
// Fixed version - POST /bulk/campaign/select implementation
// Simplified and focused on working correctly

export default async function handler(req, res) {
    // Ensure proper JSON response headers
    res.setHeader('Content-Type', 'application/json');
    
    // Only allow POST method
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed. Use POST.' 
        });
    }

    try {
        // Get campaign ID from request body
        const { campaignId } = req.body;
        
        if (!campaignId) {
            return res.status(400).json({
                success: false,
                error: 'Campaign ID is required in request body'
            });
        }

        console.log(`📍 Campaign details request for: ${campaignId}`);

        // Check environment variables
        const VOLUME_KEY = process.env.VOLUME_KEY;
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;
        
        if (!VOLUME_KEY || !VOLUME_KEY_ID) {
            console.error('❌ Missing Voluum credentials');
            return res.status(500).json({
                success: false,
                error: 'Voluum API credentials not configured'
            });
        }

        // Create Voluum session
        console.log('🔐 Creating Voluum session...');
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
            console.error('❌ Session creation failed:', sessionError);
            return res.status(401).json({
                success: false,
                error: `Voluum authentication failed: ${sessionResponse.status}`
            });
        }

        const sessionData = await sessionResponse.json();
        const authToken = sessionData.token;
        
        if (!authToken) {
            console.error('❌ No token received');
            return res.status(401).json({
                success: false,
                error: 'No authentication token received from Voluum'
            });
        }

        console.log('✅ Voluum session created');

        // Try to get campaign details using the bulk select endpoint
        console.log(`🔍 Fetching campaign via bulk select: ${campaignId}`);
        
        const bulkSelectUrl = 'https://api.voluum.com/bulk/campaign/select';
        const requestPayload = {
            campaignIds: [campaignId]
        };

        const bulkResponse = await fetch(bulkSelectUrl, {
            method: 'POST',
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestPayload)
        });

        if (!bulkResponse.ok) {
            // If bulk select fails, try fallback method using report API
            console.log(`⚠️ Bulk select failed (${bulkResponse.status}), trying fallback...`);
            
            // Try progressively wider date ranges to find campaign data
            const dateRanges = [
                { days: 7, name: "last 7 days" },
                { days: 30, name: "last 30 days" },
                { days: 90, name: "last 90 days" },
                { days: 365, name: "last year" }
            ];
            
            let campaignFound = false;
            let campaignDetails = null;
            
            for (const range of dateRanges) {
                const endDate = new Date().toISOString().split('T')[0];
                const startDate = new Date(Date.now() - range.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                
                console.log(`🔍 Searching campaign in ${range.name}: ${startDate} to ${endDate}`);
                
                const reportUrl = `https://api.voluum.com/report?from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&groupBy=campaign&campaignId=${campaignId}&limit=1`;
                
                try {
                    const reportResponse = await fetch(reportUrl, {
                        headers: {
                            'cwauth-token': authToken,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (reportResponse.ok) {
                        const reportData = await reportResponse.json();
                        
                        if (reportData.rows && reportData.rows.length > 0) {
                            const campaignRow = reportData.rows[0];
                            console.log(`✅ Campaign found in ${range.name}:`, campaignRow);
                            
                            // Transform report data to campaign format
                            campaignDetails = {
                                id: campaignId,
                                name: campaignRow.campaignName || campaignRow.name || `Campaign ${campaignId}`,
                                status: campaignRow.status || 'ACTIVE',
                                revenue: parseFloat(campaignRow.revenue || 0),
                                cost: parseFloat(campaignRow.cost || 0),
                                visits: parseInt(campaignRow.visits || 0),
                                conversions: parseInt(campaignRow.conversions || 0),
                                roas: 0,
                                cpa: 0,
                                cvr: 0,
                                profit: 0,
                                trafficSourceName: campaignRow.trafficSourceName || 'Unknown',
                                costModel: campaignRow.costModel || 'CPC',
                                createDate: campaignRow.createDate || null,
                                dataRange: range.name
                            };

                            // Calculate metrics
                            campaignDetails.roas = campaignDetails.cost > 0 ? (campaignDetails.revenue / campaignDetails.cost) : 0;
                            campaignDetails.cpa = campaignDetails.conversions > 0 ? (campaignDetails.cost / campaignDetails.conversions) : 0;
                            campaignDetails.cvr = campaignDetails.visits > 0 ? ((campaignDetails.conversions / campaignDetails.visits) * 100) : 0;
                            campaignDetails.profit = campaignDetails.revenue - campaignDetails.cost;

                            campaignFound = true;
                            break;
                        }
                    }
                } catch (rangeError) {
                    console.log(`⚠️ Error searching ${range.name}:`, rangeError.message);
                    continue;
                }
            }
            
            if (!campaignFound) {
                console.error('❌ Campaign not found in any date range');
                return res.status(404).json({
                    success: false,
                    error: `Campaign ${campaignId} not found in any date range (last 7 days to last year). Campaign may be deleted, archived, or ID is incorrect.`
                });
            }

            console.log('✅ Campaign details retrieved via report fallback');
            return res.json({
                success: true,
                campaign: campaignDetails,
                source: 'voluum_report_fallback',
                debug_info: {
                    method: 'report_api_fallback',
                    campaignId: campaignId,
                    found_in_range: campaignDetails.dataRange,
                    bulk_select_failed: true,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Process bulk select response
        const bulkData = await bulkResponse.json();
        console.log('✅ Campaign details retrieved via bulk select');
        
        return res.json({
            success: true,
            campaign: bulkData,
            source: 'voluum_bulk_select',
            debug_info: {
                method: 'bulk_campaign_select',
                campaignId: campaignId,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Campaign API error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
            debug_info: {
                error_type: error.name,
                timestamp: new Date().toISOString()
            }
        });
    }
}
