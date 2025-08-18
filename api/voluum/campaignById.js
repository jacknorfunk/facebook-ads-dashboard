// /api/voluum/campaignById.js - Enhanced Debug Version

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Method not allowed. Use POST.' 
        });
    }

    const { campaignId } = req.body;

    if (!campaignId) {
        return res.status(400).json({ 
            success: false, 
            error: 'Campaign ID is required',
            received: req.body
        });
    }

    console.log(`🎯 Enhanced Campaign API - Fetching details for: ${campaignId}`);

    try {
        // Get auth token from environment variables
        const authToken = process.env.VOLUUM_AUTH_TOKEN || process.env.VOLUME_KEY;
        
        if (!authToken) {
            console.log('❌ No auth token found in environment variables');
            return res.status(401).json({ 
                success: false, 
                error: 'No Voluum authentication token available',
                envVars: {
                    hasVOLUUM_AUTH_TOKEN: !!process.env.VOLUUM_AUTH_TOKEN,
                    hasVOLUME_KEY: !!process.env.VOLUME_KEY
                }
            });
        }

        console.log('✅ Auth token found, making API request...');

        // ENHANCED: First get the campaigns from the working endpoint to find this campaign
        let campaignData = null;
        let dataSource = 'unknown';
        let debugInfo = {
            searchAttempts: [],
            campaignFound: false,
            availableCampaignIds: []
        };

        try {
            console.log('📡 Step 1: Getting all campaigns from working endpoint...');
            
            const currentDate = new Date();
            const last30Days = new Date(currentDate.getTime() - (30 * 24 * 60 * 60 * 1000));
            
            const startDate = last30Days.toISOString().split('T')[0];
            const endDate = currentDate.toISOString().split('T')[0];
            
            const campaignsUrl = `https://api.voluum.com/report?from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&groupBy=campaign&limit=1000`;
            
            console.log(`📡 Campaigns URL: ${campaignsUrl}`);
            
            const campaignsResponse = await fetch(campaignsUrl, {
                headers: {
                    'cwauth-token': authToken,
                    'Content-Type': 'application/json'
                }
            });

            if (campaignsResponse.ok) {
                const campaignsData = await campaignsResponse.json();
                console.log(`📊 Found ${campaignsData.rows?.length || 0} campaigns in report`);
                
                debugInfo.searchAttempts.push({
                    method: 'campaigns_report',
                    status: 'success',
                    campaignsFound: campaignsData.rows?.length || 0
                });

                if (campaignsData.rows && campaignsData.columns) {
                    // Extract all campaign IDs for debugging
                    const campaignIdIndex = campaignsData.columns.indexOf('campaignId');
                    const campaignNameIndex = campaignsData.columns.indexOf('campaignName');
                    
                    if (campaignIdIndex >= 0) {
                        debugInfo.availableCampaignIds = campaignsData.rows.map(row => ({
                            id: row[campaignIdIndex],
                            name: campaignNameIndex >= 0 ? row[campaignNameIndex] : 'Unknown'
                        })).slice(0, 10); // First 10 for debugging
                    }
                    
                    // Find the specific campaign
                    const campaignRow = campaignsData.rows.find(row => {
                        return campaignIdIndex >= 0 && row[campaignIdIndex] === campaignId;
                    });
                    
                    if (campaignRow) {
                        console.log('✅ Campaign found in campaigns report');
                        debugInfo.campaignFound = true;
                        
                        // Convert row data to object
                        campaignData = {};
                        campaignsData.columns.forEach((column, index) => {
                            campaignData[column] = campaignRow[index];
                        });
                        
                        dataSource = 'campaigns_report';
                    } else {
                        console.log(`⚠️ Campaign ${campaignId} not found in campaigns report`);
                        
                        // Check if any campaign names contain "taboola" for debugging
                        const taboolaCampaigns = campaignsData.rows.filter(row => {
                            const name = campaignNameIndex >= 0 ? row[campaignNameIndex] : '';
                            return name && name.toLowerCase().includes('taboola');
                        });
                        
                        debugInfo.taboolaCampaignsFound = taboolaCampaigns.length;
                        debugInfo.sampleTaboolaCampaigns = taboolaCampaigns.slice(0, 3).map(row => ({
                            id: campaignIdIndex >= 0 ? row[campaignIdIndex] : 'unknown',
                            name: campaignNameIndex >= 0 ? row[campaignNameIndex] : 'unknown'
                        }));
                    }
                }
            } else {
                const errorText = await campaignsResponse.text();
                console.log(`⚠️ Campaigns report failed: ${campaignsResponse.status} - ${errorText}`);
                debugInfo.searchAttempts.push({
                    method: 'campaigns_report',
                    status: 'failed',
                    error: `${campaignsResponse.status}: ${errorText}`
                });
            }
        } catch (campaignsError) {
            console.log('⚠️ Campaigns report error:', campaignsError.message);
            debugInfo.searchAttempts.push({
                method: 'campaigns_report',
                status: 'error',
                error: campaignsError.message
            });
        }

        // If not found in campaigns report, try bulk select anyway
        if (!campaignData) {
            try {
                console.log('📡 Step 2: Trying bulk select endpoint...');
                
                const bulkResponse = await fetch('https://api.voluum.com/campaign/bulk/select', {
                    method: 'POST',
                    headers: {
                        'cwauth-token': authToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        campaignIds: [campaignId]
                    })
                });

                console.log(`📊 Bulk select response status: ${bulkResponse.status}`);
                debugInfo.searchAttempts.push({
                    method: 'bulk_select',
                    status: bulkResponse.status
                });

                if (bulkResponse.ok) {
                    const bulkData = await bulkResponse.json();
                    console.log('📊 Bulk select data:', bulkData);
                    
                    if (bulkData && Array.isArray(bulkData) && bulkData.length > 0) {
                        campaignData = bulkData[0];
                        dataSource = 'bulk_select';
                        debugInfo.campaignFound = true;
                        console.log('✅ Campaign data found via bulk select');
                    }
                } else {
                    const errorText = await bulkResponse.text();
                    console.log(`⚠️ Bulk select failed: ${bulkResponse.status} - ${errorText}`);
                }
            } catch (bulkError) {
                console.log('⚠️ Bulk select error:', bulkError.message);
                debugInfo.searchAttempts.push({
                    method: 'bulk_select',
                    status: 'error',
                    error: bulkError.message
                });
            }
        }

        if (!campaignData) {
            console.log(`❌ Campaign ${campaignId} not found in any data source`);
            return res.status(404).json({
                success: false,
                error: `Campaign ${campaignId} not found`,
                dataSource: 'No data source worked',
                debug: {
                    campaignId: campaignId,
                    searchAttempts: debugInfo.searchAttempts,
                    availableCampaignIds: debugInfo.availableCampaignIds,
                    taboolaCampaignsFound: debugInfo.taboolaCampaignsFound,
                    sampleTaboolaCampaigns: debugInfo.sampleTaboolaCampaigns,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Process the campaign data
        const processedCampaign = processCampaignData(campaignData);
        
        console.log('✅ Campaign data processed successfully');

        return res.json({
            success: true,
            campaign: processedCampaign,
            dataSource: dataSource,
            debug: debugInfo,
            metadata: {
                campaignId: campaignId,
                lastUpdated: new Date().toISOString(),
                apiVersion: 'enhanced_debug_v1'
            }
        });

    } catch (error) {
        console.error('❌ Campaign API error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug: {
                campaignId: campaignId,
                errorStack: error.stack,
                timestamp: new Date().toISOString()
            }
        });
    }
}

function processCampaignData(rawCampaign) {
    console.log('🔍 Processing campaign data:', rawCampaign.campaignName || rawCampaign.name);

    // Enhanced traffic source detection
    const detectedTrafficSource = detectTrafficSource(rawCampaign.campaignName || rawCampaign.name);
    
    const processed = {
        id: rawCampaign.campaignId || rawCampaign.id,
        name: rawCampaign.campaignName || rawCampaign.name || 'Unknown Campaign',
        status: rawCampaign.status || 'ACTIVE',
        costModel: rawCampaign.costModel || rawCampaign.cost_model || 'AUTO',
        created: rawCampaign.created || rawCampaign.createdAt || 'N/A',
        
        // Performance metrics
        visits: parseInt(rawCampaign.visits || 0),
        conversions: parseInt(rawCampaign.conversions || rawCampaign.cv || 0),
        revenue: parseFloat(rawCampaign.revenue || 0),
        cost: parseFloat(rawCampaign.cost || rawCampaign.spent || 0),
        
        // Traffic source detection
        trafficSource: detectedTrafficSource,
        detectedTrafficSource: detectedTrafficSource,
        originalTrafficSource: rawCampaign.trafficSource || 'not_set',
        
        // Debug info
        rawData: {
            campaignName: rawCampaign.campaignName || rawCampaign.name,
            detectionResult: detectedTrafficSource,
            originalSource: rawCampaign.trafficSource
        }
    };

    // Calculate derived metrics
    processed.profit = processed.revenue - processed.cost;
    processed.roas = processed.cost > 0 ? processed.revenue / processed.cost : 0;
    processed.cpa = processed.conversions > 0 ? processed.cost / processed.conversions : 0;
    processed.cvr = processed.visits > 0 ? (processed.conversions / processed.visits) * 100 : 0;
    processed.epc = processed.visits > 0 ? processed.revenue / processed.visits : 0;

    console.log(`✅ Campaign processed: "${processed.name}" -> Traffic Source: ${detectedTrafficSource}`);
    
    return processed;
}

function detectTrafficSource(campaignName) {
    if (!campaignName || typeof campaignName !== 'string') {
        console.log('⚠️ Invalid campaign name for traffic source detection:', campaignName);
        return 'unknown';
    }

    const name = campaignName.toLowerCase().trim();
    console.log(`🔍 Detecting traffic source for: "${name}"`);

    // Priority-based detection (TABOOLA FIRST)
    if (name.includes('taboola')) {
        console.log('✅ Detected: taboola');
        return 'taboola';
    }
    
    if (name.includes('facebook') || name.includes('fb') || name.includes('meta')) {
        console.log('✅ Detected: facebook');
        return 'facebook';
    }
    
    if (name.includes('newsbreak') || name.includes('nb')) {
        console.log('✅ Detected: newsbreak');
        return 'newsbreak';
    }
    
    if (name.includes('admaven')) {
        console.log('✅ Detected: admaven');
        return 'admaven';
    }
    
    if (name.includes('google') || name.includes('gads') || name.includes('adwords')) {
        console.log('✅ Detected: google');
        return 'google';
    }

    console.log(`⚠️ No traffic source detected for: "${name}" -> defaulting to "other"`);
    return 'other';
}
