// /api/voluum/campaignById.js - Simple Vercel Compatible Version

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

    console.log(`🎯 Simple Campaign API - Fetching details for: ${campaignId}`);

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

        // Try the bulk select endpoint first
        let campaignData = null;
        let dataSource = 'unknown';

        try {
            console.log('📡 Trying bulk select endpoint...');
            
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

            if (bulkResponse.ok) {
                const bulkData = await bulkResponse.json();
                console.log('📊 Bulk select data:', bulkData);
                
                if (bulkData && Array.isArray(bulkData) && bulkData.length > 0) {
                    campaignData = bulkData[0];
                    dataSource = 'POST /bulk/campaign/select';
                    console.log('✅ Campaign data found via bulk select');
                }
            } else {
                const errorText = await bulkResponse.text();
                console.log(`⚠️ Bulk select failed: ${bulkResponse.status} - ${errorText}`);
            }
        } catch (bulkError) {
            console.log('⚠️ Bulk select error:', bulkError.message);
        }

        // If bulk select failed, try to find the campaign in the existing campaigns list
        if (!campaignData) {
            console.log('📡 Trying to find campaign in campaigns list...');
            
            try {
                // Use the same approach as the working campaigns endpoint
                const currentDate = new Date();
                const last7Days = new Date(currentDate.getTime() - (7 * 24 * 60 * 60 * 1000));
                
                const startDate = last7Days.toISOString().split('T')[0];
                const endDate = currentDate.toISOString().split('T')[0];
                
                const reportUrl = `https://api.voluum.com/report?from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&groupBy=campaign&limit=1000`;
                
                console.log(`📡 Fetching campaigns from: ${reportUrl}`);
                
                const reportResponse = await fetch(reportUrl, {
                    headers: {
                        'cwauth-token': authToken,
                        'Content-Type': 'application/json'
                    }
                });

                if (reportResponse.ok) {
                    const reportData = await reportResponse.json();
                    console.log(`📊 Report data: ${reportData.rows?.length || 0} campaigns found`);
                    
                    if (reportData.rows && reportData.columns) {
                        // Find the campaign in the report data
                        const campaignRow = reportData.rows.find(row => {
                            const campaignIdIndex = reportData.columns.indexOf('campaignId');
                            return campaignIdIndex >= 0 && row[campaignIdIndex] === campaignId;
                        });
                        
                        if (campaignRow) {
                            console.log('✅ Campaign found in report data');
                            
                            // Convert row data to object
                            campaignData = {};
                            reportData.columns.forEach((column, index) => {
                                campaignData[column] = campaignRow[index];
                            });
                            
                            dataSource = 'Report API search';
                        } else {
                            console.log(`⚠️ Campaign ${campaignId} not found in report data`);
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

        if (!campaignData) {
            console.log(`❌ Campaign ${campaignId} not found in any data source`);
            return res.status(404).json({
                success: false,
                error: `Campaign ${campaignId} not found`,
                dataSource: 'No data source worked',
                debug: {
                    campaignId: campaignId,
                    searchedMethods: ['bulk_select', 'report_api'],
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
            metadata: {
                campaignId: campaignId,
                lastUpdated: new Date().toISOString(),
                apiVersion: 'simple_vercel_v1'
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
