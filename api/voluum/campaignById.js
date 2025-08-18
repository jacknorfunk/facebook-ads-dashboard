// /api/voluum/campaignById.js - FIXED VERSION
// This API fixes the traffic source detection issue

import fetch from 'node-fetch';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { campaignId } = req.body;

    if (!campaignId) {
        return res.status(400).json({ 
            success: false, 
            error: 'Campaign ID is required' 
        });
    }

    console.log(`🎯 FIXED CAMPAIGN API - Fetching details for: ${campaignId}`);

    try {
        // Get auth token from session/environment
        const authToken = process.env.VOLUUM_AUTH_TOKEN || req.session?.volumAccessKey;
        
        if (!authToken) {
            return res.status(401).json({ 
                success: false, 
                error: 'No Voluum authentication token available' 
            });
        }

        // Try multiple approaches to get campaign data
        let campaignData = null;
        let dataSource = 'unknown';

        // APPROACH 1: Official bulk select endpoint
        try {
            console.log(`📡 Approach 1: Official bulk select endpoint`);
            
            const bulkSelectResponse = await fetch('https://api.voluum.com/campaign/bulk/select', {
                method: 'POST',
                headers: {
                    'cwauth-token': authToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    campaignIds: [campaignId]
                })
            });

            if (bulkSelectResponse.ok) {
                const bulkData = await bulkSelectResponse.json();
                console.log(`📊 Bulk select response:`, bulkData);
                
                if (bulkData && bulkData.length > 0) {
                    campaignData = bulkData[0];
                    dataSource = 'POST /bulk/campaign/select';
                    console.log(`✅ Approach 1 SUCCESS: Campaign data retrieved via bulk select`);
                }
            } else {
                console.log(`⚠️ Approach 1 failed: ${bulkSelectResponse.status} ${bulkSelectResponse.statusText}`);
            }
        } catch (error) {
            console.log(`⚠️ Approach 1 error:`, error.message);
        }

        // APPROACH 2: Progressive date range search if bulk select failed
        if (!campaignData) {
            console.log(`📡 Approach 2: Progressive date range search`);
            campaignData = await getViaProgressiveDateSearch(authToken, campaignId);
            if (campaignData) {
                dataSource = 'Progressive date range search';
                console.log(`✅ Approach 2 SUCCESS: Campaign data found via date search`);
            }
        }

        // APPROACH 3: Campaign list search as last resort
        if (!campaignData) {
            console.log(`📡 Approach 3: Campaign list search`);
            campaignData = await getViaCampaignListSearch(authToken, campaignId);
            if (campaignData) {
                dataSource = 'Campaign list search';
                console.log(`✅ Approach 3 SUCCESS: Campaign data found in campaign list`);
            }
        }

        if (!campaignData) {
            return res.status(404).json({
                success: false,
                error: `Campaign ${campaignId} not found`,
                debug_info: {
                    campaignId: campaignId,
                    attemptsUsed: ['bulk_select', 'progressive_date_search', 'campaign_list_search'],
                    timestamp: new Date().toISOString()
                }
            });
        }

        // FIXED: Process campaign data with proper traffic source detection
        const processedCampaign = processCampaignWithFixedTrafficSource(campaignData);

        console.log(`✅ FINAL SUCCESS: Campaign ${campaignId} processed with traffic source: ${processedCampaign.detectedTrafficSource}`);

        return res.json({
            success: true,
            campaign: processedCampaign,
            dataSource: dataSource,
            metadata: {
                campaignId: campaignId,
                lastUpdated: new Date().toISOString(),
                apiVersion: 'fixed_traffic_source_v2'
            }
        });

    } catch (error) {
        console.error('❌ Fixed Campaign API error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug_info: {
                campaignId: campaignId,
                error_stack: error.stack,
                timestamp: new Date().toISOString()
            }
        });
    }
}

// FIXED: Process campaign data with accurate traffic source detection
function processCampaignWithFixedTrafficSource(rawCampaign) {
    console.log(`🔍 Processing campaign with traffic source detection:`, rawCampaign.name);

    // FIXED: Enhanced traffic source detection
    const detectedTrafficSource = detectTrafficSourceAccurate(rawCampaign.name);
    
    const processed = {
        id: rawCampaign.id || rawCampaign.campaignId,
        name: rawCampaign.name || 'Unknown Campaign',
        status: rawCampaign.status || 'UNKNOWN',
        costModel: rawCampaign.costModel || rawCampaign.cost_model || 'AUTO',
        created: rawCampaign.created || rawCampaign.createdAt || 'N/A',
        
        // Performance metrics
        visits: parseInt(rawCampaign.visits || 0),
        conversions: parseInt(rawCampaign.conversions || rawCampaign.cv || 0),
        revenue: parseFloat(rawCampaign.revenue || 0),
        cost: parseFloat(rawCampaign.cost || rawCampaign.spent || 0),
        
        // FIXED: Proper traffic source detection
        trafficSource: detectedTrafficSource,
        detectedTrafficSource: detectedTrafficSource,
        
        // Original traffic source for debugging
        originalTrafficSource: rawCampaign.trafficSource || 'not_set',
        
        // Debug info
        rawData: {
            campaignName: rawCampaign.name,
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

// FIXED: Accurate traffic source detection based on campaign name
function detectTrafficSourceAccurate(campaignName) {
    if (!campaignName || typeof campaignName !== 'string') {
        console.log(`⚠️ Invalid campaign name for traffic source detection:`, campaignName);
        return 'unknown';
    }

    const name = campaignName.toLowerCase().trim();
    console.log(`🔍 Detecting traffic source for: "${name}"`);

    // Priority-based detection (most specific first)
    if (name.includes('taboola')) {
        console.log(`✅ Detected: taboola (found "taboola" in name)`);
        return 'taboola';
    }
    
    if (name.includes('facebook') || name.includes('fb') || name.includes('meta')) {
        console.log(`✅ Detected: facebook (found facebook/fb/meta in name)`);
        return 'facebook';
    }
    
    if (name.includes('newsbreak') || name.includes('nb')) {
        console.log(`✅ Detected: newsbreak (found newsbreak/nb in name)`);
        return 'newsbreak';
    }
    
    if (name.includes('admaven')) {
        console.log(`✅ Detected: admaven (found "admaven" in name)`);
        return 'admaven';
    }
    
    if (name.includes('google') || name.includes('gads') || name.includes('adwords')) {
        console.log(`✅ Detected: google (found google/gads/adwords in name)`);
        return 'google';
    }
    
    if (name.includes('bing') || name.includes('microsoft')) {
        console.log(`✅ Detected: bing (found bing/microsoft in name)`);
        return 'bing';
    }
    
    if (name.includes('outbrain')) {
        console.log(`✅ Detected: outbrain (found "outbrain" in name)`);
        return 'outbrain';
    }
    
    if (name.includes('yahoo')) {
        console.log(`✅ Detected: yahoo (found "yahoo" in name)`);
        return 'yahoo';
    }

    // Check for common traffic source patterns
    if (name.includes('native')) {
        console.log(`✅ Detected: native (found "native" pattern)`);
        return 'native';
    }
    
    if (name.includes('display')) {
        console.log(`✅ Detected: display (found "display" pattern)`);
        return 'display';
    }
    
    if (name.includes('push')) {
        console.log(`✅ Detected: push (found "push" pattern)`);
        return 'push';
    }
    
    if (name.includes('pop')) {
        console.log(`✅ Detected: pop (found "pop" pattern)`);
        return 'pop';
    }

    console.log(`⚠️ No traffic source detected for: "${name}" -> defaulting to "other"`);
    return 'other';
}

// Progressive date range search for campaigns
async function getViaProgressiveDateSearch(authToken, campaignId) {
    const dateRanges = [
        { days: 7, label: '7 days' },
        { days: 30, label: '30 days' },
        { days: 90, label: '90 days' },
        { days: 365, label: '1 year' }
    ];

    for (const range of dateRanges) {
        try {
            console.log(`🔍 Searching last ${range.label} for campaign ${campaignId}`);
            
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - (range.days * 24 * 60 * 60 * 1000));
            
            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = endDate.toISOString().split('T')[0];
            
            const reportUrl = `https://api.voluum.com/report?campaignId=${campaignId}&from=${startDateStr}T00:00:00Z&to=${endDateStr}T23:00:00Z&tz=America/New_York&groupBy=campaign&limit=1`;
            
            const response = await fetch(reportUrl, {
                headers: {
                    'cwauth-token': authToken,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                if (data.rows && data.rows.length > 0) {
                    // Convert report data to campaign format
                    const campaignRow = data.rows[0];
                    const campaignData = {};
                    
                    if (data.columns) {
                        data.columns.forEach((column, index) => {
                            campaignData[column] = campaignRow[index];
                        });
                    }
                    
                    // Ensure we have the campaign ID and name
                    campaignData.id = campaignData.campaignId || campaignId;
                    
                    console.log(`✅ Found campaign data in ${range.label} range:`, campaignData);
                    return campaignData;
                }
            }
            
        } catch (error) {
            console.log(`⚠️ Error searching ${range.label}:`, error.message);
        }
    }

    return null;
}

// Campaign list search as fallback
async function getViaCampaignListSearch(authToken, campaignId) {
    try {
        console.log(`🔍 Searching campaign list for ${campaignId}`);
        
        const campaignListUrl = 'https://api.voluum.com/campaign';
        
        const response = await fetch(campaignListUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const campaigns = await response.json();
            
            if (Array.isArray(campaigns)) {
                const foundCampaign = campaigns.find(c => c.id === campaignId);
                
                if (foundCampaign) {
                    console.log(`✅ Found campaign in list:`, foundCampaign);
                    return foundCampaign;
                }
            }
        }
        
    } catch (error) {
        console.log(`⚠️ Error searching campaign list:`, error.message);
    }

    return null;
}
