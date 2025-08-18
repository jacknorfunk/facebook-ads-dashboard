// /api/voluum/campaignById.js - Based on your working campaigns API implementation

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

    console.log(`🎯 Properly Authenticated Campaign API - Fetching: ${campaignId}`);

    try {
        // FIXED: Use the same authentication as your working campaigns API
        const volumeKeyId = process.env.VOLUME_KEY_ID;
        const volumeKey = process.env.VOLUME_KEY;

        if (!volumeKeyId || !volumeKey) {
            console.log('❌ Missing environment variables');
            return res.status(401).json({ 
                success: false, 
                error: 'Missing Voluum credentials',
                debug: {
                    hasVOLUME_KEY_ID: !!volumeKeyId,
                    hasVOLUME_KEY: !!volumeKey
                }
            });
        }

        console.log('✅ Credentials found, authenticating...');

        // Step 1: Get authentication token (same as working API)
        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessId: volumeKeyId,
                accessKey: volumeKey
            })
        });

        if (!authResponse.ok) {
            console.log('❌ Auth failed:', authResponse.status);
            const authError = await authResponse.text();
            return res.status(401).json({ 
                success: false, 
                error: 'Voluum authentication failed',
                debug: {
                    authStatus: authResponse.status,
                    authError: authError.substring(0, 200)
                }
            });
        }

        const authData = await authResponse.json();
        const token = authData.token;

        if (!token) {
            console.log('❌ No token received');
            return res.status(401).json({ 
                success: false, 
                error: 'No authentication token received',
                debug: { authData }
            });
        }

        console.log('✅ Voluum authentication successful');

        // Step 2: Try to get the campaign using the direct campaign list endpoint first
        let campaignData = null;
        let dataSource = 'unknown';

        try {
            console.log('📡 Method 1: Direct campaign list endpoint');
            
            const campaignListResponse = await fetch('https://api.voluum.com/campaign', {
                headers: {
                    'cwauth-token': token,
                    'Content-Type': 'application/json'
                }
            });

            if (campaignListResponse.ok) {
                const campaigns = await campaignListResponse.json();
                console.log(`📊 Found ${campaigns.length} campaigns in direct list`);
                
                // Find our specific campaign
                const foundCampaign = campaigns.find(c => c.id === campaignId);
                
                if (foundCampaign) {
                    console.log('✅ Campaign found in direct list');
                    campaignData = foundCampaign;
                    dataSource = 'Direct campaign list (/campaign)';
                } else {
                    console.log(`⚠️ Campaign ${campaignId} not found in direct list`);
                    
                    // Debug: Show available campaign IDs
                    const availableIds = campaigns.slice(0, 5).map(c => ({
                        id: c.id,
                        name: c.name
                    }));
                    console.log('Available campaigns (first 5):', availableIds);
                }
            } else {
                const errorText = await campaignListResponse.text();
                console.log(`⚠️ Direct campaign list failed: ${campaignListResponse.status} - ${errorText}`);
            }
        } catch (directError) {
            console.log('⚠️ Direct campaign list error:', directError.message);
        }

        // Step 3: If not found in direct list, try the report API (like your working campaigns API)
        if (!campaignData) {
            console.log('📡 Method 2: Report API with campaign grouping');
            
            try {
                // Use longer date range to ensure we find the campaign
                const currentDate = new Date();
                const last90Days = new Date(currentDate.getTime() - (90 * 24 * 60 * 60 * 1000));
                
                const startDate = last90Days.toISOString().split('T')[0];
                const endDate = currentDate.toISOString().split('T')[0];
                
                const reportUrl = `https://api.voluum.com/report?from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&groupBy=campaign&limit=1000`;
                
                console.log(`📡 Report URL: ${reportUrl}`);
                
                const reportResponse = await fetch(reportUrl, {
                    headers: {
                        'cwauth-token': token,
                        'Content-Type': 'application/json'
                    }
                });

                if (reportResponse.ok) {
                    const reportData = await reportResponse.json();
                    console.log(`📊 Report data: ${reportData.rows?.length || 0} campaigns found`);
                    
                    if (reportData.rows && reportData.columns) {
                        // Find the campaign in the report data
                        const campaignIdIndex = reportData.columns.indexOf('campaignId');
                        
                        if (campaignIdIndex >= 0) {
                            const campaignRow = reportData.rows.find(row => row[campaignIdIndex] === campaignId);
                            
                            if (campaignRow) {
                                console.log('✅ Campaign found in report data');
                                
                                // Convert row data to object
                                campaignData = {};
                                reportData.columns.forEach((column, index) => {
                                    campaignData[column] = campaignRow[index];
                                });
                                
                                dataSource = 'Report API (/report groupBy=campaign)';
                            } else {
                                console.log(`⚠️ Campaign ${campaignId} not found in report data`);
                                
                                // Debug: Show sample campaign IDs from report
                                const sampleIds = reportData.rows.slice(0, 5).map(row => row[campaignIdIndex]);
                                console.log('Sample campaign IDs from report:', sampleIds);
                            }
                        } else {
                            console.log('⚠️ No campaignId column found in report');
                            console.log('Available columns:', reportData.columns);
                        }
                    }
                } else {
                    const errorText = await reportResponse.text();
                    console.log(`⚠️ Report API failed: ${reportResponse.status} - ${errorText}`);
                }
            } catch (reportError) {
                console.log('⚠️ Report API error:', reportError.message);
            }
        }

        // Step 4: If still not found, try the bulk select endpoint from Voluum docs
        if (!campaignData) {
            console.log('📡 Method 3: Official bulk select endpoint');
            
            try {
                const bulkSelectUrl = 'https://api.voluum.com/campaign/bulk/select';
                
                const bulkResponse = await fetch(bulkSelectUrl, {
                    method: 'POST',
                    headers: {
                        'cwauth-token': token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        campaignIds: [campaignId]
                    })
                });

                console.log(`📊 Bulk select response status: ${bulkResponse.status}`);

                if (bulkResponse.ok) {
                    const bulkData = await bulkResponse.json();
                    console.log('📊 Bulk select data:', bulkData);
                    
                    if (bulkData && Array.isArray(bulkData) && bulkData.length > 0) {
                        campaignData = bulkData[0];
                        dataSource = 'Official bulk select endpoint';
                        console.log('✅ Campaign found via bulk select');
                    } else {
                        console.log('⚠️ No data returned from bulk select');
                    }
                } else {
                    const errorText = await bulkResponse.text();
                    console.log(`⚠️ Bulk select failed: ${bulkResponse.status} - ${errorText}`);
                }
            } catch (bulkError) {
                console.log('⚠️ Bulk select error:', bulkError.message);
            }
        }

        if (!campaignData) {
            console.log(`❌ Campaign ${campaignId} not found in any data source`);
            return res.status(404).json({
                success: false,
                error: `Campaign ${campaignId} not found in any Voluum endpoint`,
                debug: {
                    campaignId: campaignId,
                    searchedMethods: [
                        'Direct campaign list (/campaign)',
                        'Report API (/report groupBy=campaign)', 
                        'Official bulk select (/campaign/bulk/select)'
                    ],
                    suggestion: 'The campaign ID may be from a different workspace or may have been deleted',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Process the campaign data with enhanced traffic source detection
        const processedCampaign = processCampaignData(campaignData);
        
        console.log('✅ Campaign data processed successfully');

        return res.json({
            success: true,
            campaign: processedCampaign,
            dataSource: dataSource,
            metadata: {
                campaignId: campaignId,
                lastUpdated: new Date().toISOString(),
                apiVersion: 'properly_authenticated_v1'
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

    // FIXED: Enhanced traffic source detection prioritizing Taboola
    const detectedTrafficSource = detectTrafficSourceEnhanced(rawCampaign.campaignName || rawCampaign.name);
    
    const processed = {
        id: rawCampaign.campaignId || rawCampaign.id,
        name: rawCampaign.campaignName || rawCampaign.name || 'Unknown Campaign',
        status: rawCampaign.status || 'ACTIVE',
        costModel: rawCampaign.costModel || rawCampaign.cost_model || 'AUTO',
        created: rawCampaign.created || rawCampaign.createdAt || rawCampaign.createDate || 'N/A',
        
        // Performance metrics
        visits: parseInt(rawCampaign.visits || 0),
        conversions: parseInt(rawCampaign.conversions || rawCampaign.cv || 0),
        revenue: parseFloat(rawCampaign.revenue || 0),
        cost: parseFloat(rawCampaign.cost || rawCampaign.spent || 0),
        
        // FIXED: Proper traffic source detection
        trafficSource: detectedTrafficSource,
        detectedTrafficSource: detectedTrafficSource,
        originalTrafficSource: rawCampaign.trafficSource || rawCampaign.trafficSourceName || 'not_set',
        
        // Debug info
        rawData: {
            campaignName: rawCampaign.campaignName || rawCampaign.name,
            detectionResult: detectedTrafficSource,
            originalSource: rawCampaign.trafficSource || rawCampaign.trafficSourceName
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

// FIXED: Enhanced traffic source detection with Taboola priority
function detectTrafficSourceEnhanced(campaignName) {
    if (!campaignName || typeof campaignName !== 'string') {
        console.log('⚠️ Invalid campaign name for traffic source detection:', campaignName);
        return 'unknown';
    }

    const name = campaignName.toLowerCase().trim();
    console.log(`🔍 Enhanced traffic source detection for: "${name}"`);

    // PRIORITY 1: TABOOLA (most important fix)
    if (name.includes('taboola')) {
        console.log('✅ Detected: taboola (PRIORITY FIX)');
        return 'taboola';
    }
    
    // PRIORITY 2: Other traffic sources
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
    
    if (name.includes('bing') || name.includes('microsoft')) {
        console.log('✅ Detected: bing');
        return 'bing';
    }
    
    if (name.includes('outbrain')) {
        console.log('✅ Detected: outbrain');
        return 'outbrain';
    }

    // Check for common patterns
    if (name.includes('native')) {
        console.log('✅ Detected: native');
        return 'native';
    }
    
    if (name.includes('display')) {
        console.log('✅ Detected: display');
        return 'display';
    }
    
    if (name.includes('push')) {
        console.log('✅ Detected: push');
        return 'push';
    }

    console.log(`⚠️ No traffic source detected for: "${name}" -> defaulting to "other"`);
    return 'other';
}
