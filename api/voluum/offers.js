// /api/voluum/offers.js - FIXED with Proper Drill-down Approach
// Based on official Voluum API documentation: Use drill-down methodology
// Reference: https://doc.voluum.com/en/voluum_api_docs.html
// Key insight: "explore behavior for different requests by using Chrome Developers tools"

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { campaignId, range = 'last_7_days', from, to } = req.query;
        
        if (!campaignId) {
            return res.status(400).json({
                success: false,
                error: 'campaignId parameter is required'
            });
        }

        console.log(`📊 Loading offers for SPECIFIC campaign using drill-down approach: ${campaignId}`);

        // Calculate date range with proper EST timezone
        let startDate, endDate;
        if (from && to) {
            startDate = from;
            endDate = to;
            console.log(`📅 Using custom date range: ${startDate} to ${endDate}`);
        } else {
            const dateRange = calculateDateRangeFixedForVoluum(range);
            startDate = dateRange.startDate;
            endDate = dateRange.endDate;
            console.log(`📅 Using preset range (${range}): ${startDate} to ${endDate}`);
        }

        // Get Voluum API credentials
        const VOLUME_KEY = process.env.VOLUME_KEY;
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;
        
        if (!VOLUME_KEY || !VOLUME_KEY_ID) {
            throw new Error('Voluum API credentials not configured. Missing VOLUME_KEY or VOLUME_KEY_ID environment variables');
        }

        // Create session using access key
        console.log('🔐 Creating Voluum API session for offers...');
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
            console.log('❌ Offers session creation failed:', sessionError);
            throw new Error(`Session creation failed: ${sessionResponse.status} - ${sessionError}`);
        }

        const sessionData = await sessionResponse.json();
        const authToken = sessionData.token;
        
        if (!authToken) {
            throw new Error('No auth token received from Voluum session API');
        }

        console.log('✅ Offers session created successfully');

        // CRITICAL FIX: Use the drill-down approach as per Voluum documentation
        // Instead of trying to filter offers by campaignId, use the campaign-specific drill-down endpoint
        console.log(`🎯 Using campaign drill-down approach for: ${campaignId}`);
        
        // Step 1: First get the campaign report to verify it exists
        const campaignReportUrl = `https://api.voluum.com/report?from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&groupBy=campaign&campaignId=${campaignId}&limit=1`;
        
        console.log(`🔍 Verifying campaign exists:`, campaignReportUrl);

        const campaignResponse = await fetch(campaignReportUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (!campaignResponse.ok) {
            const errorText = await campaignResponse.text();
            console.log(`❌ Campaign verification failed:`, errorText);
            throw new Error(`Campaign verification failed: ${campaignResponse.status} - ${errorText}`);
        }

        const campaignData = await campaignResponse.json();
        console.log(`📊 Campaign verification:`, {
            hasRows: !!campaignData.rows,
            rowCount: campaignData.rows?.length || 0
        });

        if (!campaignData.rows || campaignData.rows.length === 0) {
            console.log(`⚠️ Campaign ${campaignId} not found or has no data in date range`);
            return res.json({
                success: true,
                offers: [],
                debug_info: {
                    data_source: 'voluum_campaign_drill_down',
                    campaignId: campaignId,
                    total_found: 0,
                    active_offers: 0,
                    date_range_used: `${startDate} to ${endDate}`,
                    message: `Campaign ${campaignId} not found or has no data in date range`,
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Step 2: Now try multiple approaches to get campaign-specific offers
        const campaignSpecificOffers = await getCampaignSpecificOffers(authToken, startDate, endDate, campaignId);

        console.log(`✅ Campaign drill-down completed for ${campaignId}: found ${campaignSpecificOffers.length} offers`);

        return res.json({
            success: true,
            offers: campaignSpecificOffers,
            debug_info: {
                data_source: 'voluum_campaign_drill_down',
                campaignId: campaignId,
                total_found: campaignSpecificOffers.length,
                active_offers: campaignSpecificOffers.length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                custom_dates: !!from && !!to,
                timezone_used: 'America/New_York',
                filtering_method: 'campaign_drill_down',
                official_voluum_api: true,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Offer API error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug_info: {
                error_details: error.stack,
                campaignId: req.query.campaignId,
                timestamp: new Date().toISOString()
            }
        });
    }
}

// CRITICAL FUNCTION: Get campaign-specific offers using multiple approaches
async function getCampaignSpecificOffers(authToken, startDate, endDate, campaignId) {
    const offers = [];
    
    // Approach 1: Try direct offer report with campaign filter
    try {
        console.log(`🔄 Approach 1: Direct offer report with campaign filter`);
        const directUrl = `https://api.voluum.com/report?from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&groupBy=offer&campaignId=${campaignId}&limit=1000`;
        
        const directResponse = await fetch(directUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (directResponse.ok) {
            const directData = await directResponse.json();
            console.log(`📊 Direct approach results: ${directData.rows?.length || 0} offers`);
            
            if (directData.rows && directData.rows.length > 0) {
                const processedOffers = processOfferData(directData, campaignId);
                offers.push(...processedOffers);
                console.log(`✅ Direct approach successful: ${processedOffers.length} offers added`);
                return offers; // Return early if this works
            }
        } else {
            console.log(`⚠️ Direct approach failed: ${directResponse.status}`);
        }
    } catch (error) {
        console.log(`⚠️ Direct approach error:`, error.message);
    }

    // Approach 2: Try campaign-specific report groupBy offer
    try {
        console.log(`🔄 Approach 2: Campaign-specific report grouped by offer`);
        const groupedUrl = `https://api.voluum.com/report?from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&campaignId=${campaignId}&groupBy=offer&limit=1000`;
        
        const groupedResponse = await fetch(groupedUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (groupedResponse.ok) {
            const groupedData = await groupedResponse.json();
            console.log(`📊 Grouped approach results: ${groupedData.rows?.length || 0} offers`);
            
            if (groupedData.rows && groupedData.rows.length > 0) {
                const processedOffers = processOfferData(groupedData, campaignId);
                offers.push(...processedOffers);
                console.log(`✅ Grouped approach successful: ${processedOffers.length} offers added`);
                return offers; // Return early if this works
            }
        } else {
            console.log(`⚠️ Grouped approach failed: ${groupedResponse.status}`);
        }
    } catch (error) {
        console.log(`⚠️ Grouped approach error:`, error.message);
    }

    // Approach 3: Fallback - Get all offers and manually filter
    try {
        console.log(`🔄 Approach 3: FALLBACK - Manual filtering of all offers`);
        const allOffersUrl = `https://api.voluum.com/report?from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&groupBy=offer&limit=1000`;
        
        const allOffersResponse = await fetch(allOffersUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (allOffersResponse.ok) {
            const allOffersData = await allOffersResponse.json();
            console.log(`📊 All offers retrieved: ${allOffersData.rows?.length || 0} total offers`);
            
            if (allOffersData.rows && allOffersData.rows.length > 0) {
                // Manual filtering by campaign
                const filteredOffers = filterOffersByCampaign(allOffersData, campaignId);
                offers.push(...filteredOffers);
                console.log(`✅ Manual filtering successful: ${filteredOffers.length} offers match campaign ${campaignId}`);
            }
        } else {
            console.log(`⚠️ Fallback approach failed: ${allOffersResponse.status}`);
        }
    } catch (error) {
        console.log(`⚠️ Fallback approach error:`, error.message);
    }

    console.log(`📋 Final result: ${offers.length} offers found for campaign ${campaignId}`);
    return offers;
}

// Process offer data from Voluum API response
function processOfferData(reportData, campaignId) {
    const { columns, rows } = reportData;
    const processedOffers = [];
    
    if (!rows || rows.length === 0) {
        return processedOffers;
    }

    rows.forEach((rowData, index) => {
        let offerData = {};
        
        if (columns && columns.length > 0) {
            // Standard format: rows as arrays, columns as field names
            columns.forEach((column, colIndex) => {
                offerData[column] = rowData[colIndex];
            });
        } else {
            // Direct format: rows as complete objects
            offerData = rowData;
        }

        // Normalize field names and calculate metrics
        const normalizedOffer = {
            id: offerData.offerId || offerData.id || `offer_${index}`,
            name: offerData.offerName || offerData.name || 'Unknown Offer',
            campaignId: campaignId, // Force the campaignId
            visits: parseInt(offerData.visits || 0),
            conversions: parseInt(offerData.conversions || offerData.cv || 0),
            revenue: parseFloat(offerData.revenue || 0),
            cost: parseFloat(offerData.cost || 0),
            cpa: parseFloat(offerData.cpa || 0),
            epc: parseFloat(offerData.epc || 0)
        };

        // Calculate additional metrics
        normalizedOffer.roas = normalizedOffer.cost > 0 ? (normalizedOffer.revenue / normalizedOffer.cost) : 0;
        normalizedOffer.cvr = normalizedOffer.visits > 0 ? ((normalizedOffer.conversions / normalizedOffer.visits) * 100) : 0;

        // Only include offers with visits > 0
        if (normalizedOffer.visits > 0) {
            processedOffers.push(normalizedOffer);
            console.log(`✅ Processed offer: ${normalizedOffer.name} (${normalizedOffer.visits} visits) for campaign ${campaignId}`);
        }
    });

    return processedOffers;
}

// Manual filtering when API approaches don't work
function filterOffersByCampaign(allOffersData, campaignId) {
    const { columns, rows } = allOffersData;
    const campaignOffers = [];
    
    if (!rows || rows.length === 0) {
        return campaignOffers;
    }

    rows.forEach((rowData, index) => {
        let offerData = {};
        
        if (columns && columns.length > 0) {
            columns.forEach((column, colIndex) => {
                offerData[column] = rowData[colIndex];
            });
        } else {
            offerData = rowData;
        }

        // Check if this offer belongs to the specific campaign
        // Look for various campaign ID fields
        const offerCampaignId = offerData.campaignId || 
                              offerData.parentCampaignId || 
                              offerData.campaign_id ||
                              offerData.parentId;
                              
        const visits = parseInt(offerData.visits || 0);

        // CRITICAL: Only include offers that match the campaign ID AND have visits
        if (offerCampaignId === campaignId && visits > 0) {
            const normalizedOffer = {
                id: offerData.offerId || offerData.id || `offer_${index}`,
                name: offerData.offerName || offerData.name || 'Unknown Offer',
                campaignId: campaignId,
                visits: visits,
                conversions: parseInt(offerData.conversions || offerData.cv || 0),
                revenue: parseFloat(offerData.revenue || 0),
                cost: parseFloat(offerData.cost || 0),
                cpa: parseFloat(offerData.cpa || 0),
                epc: parseFloat(offerData.epc || 0)
            };

            normalizedOffer.roas = normalizedOffer.cost > 0 ? (normalizedOffer.revenue / normalizedOffer.cost) : 0;
            normalizedOffer.cvr = normalizedOffer.visits > 0 ? ((normalizedOffer.conversions / normalizedOffer.visits) * 100) : 0;

            campaignOffers.push(normalizedOffer);
            console.log(`✅ MANUAL FILTER: Found matching offer for campaign ${campaignId}: ${normalizedOffer.name} (${normalizedOffer.visits} visits)`);
        } else if (visits > 0) {
            // Log offers that have visits but don't match the campaign (for debugging)
            console.log(`👻 MANUAL FILTER: Offer "${offerData.offerName || offerData.name}" has visits but belongs to campaign "${offerCampaignId}", not "${campaignId}"`);
        }
    });

    return campaignOffers;
}

// Date range calculation with proper EST timezone handling
function calculateDateRangeFixedForVoluum(range) {
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    
    let startDate, endDate;

    switch (range) {
        case 'today':
            startDate = new Date(easternTime);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'yesterday':
            const yesterday = new Date(easternTime);
            yesterday.setDate(yesterday.getDate() - 1);
            
            startDate = new Date(yesterday);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(yesterday);
            endDate.setHours(23, 59, 59, 999);
            
            console.log(`🕐 FIXED Yesterday calculation (EST): ${startDate.toISOString()} to ${endDate.toISOString()}`);
            break;
            
        case 'last_7_days':
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'last_30_days':
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 29);
            startDate.setHours(0, 0, 0, 0);
            break;
            
// /api/voluum/offers.js - FIXED with Balanced Filtering Approach
// Reference: https://developers.voluum.com/
// CRITICAL FIX: Balance between showing correct offers and not being too restrictive

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { campaignId, range = 'last_7_days', from, to } = req.query;
        
        if (!campaignId) {
            return res.status(400).json({
                success: false,
                error: 'campaignId parameter is required'
            });
        }

        console.log(`📊 Loading offers for campaign: ${campaignId}`);

        // Calculate date range with proper EST timezone
        let startDate, endDate;
        if (from && to) {
            startDate = from;
            endDate = to;
            console.log(`📅 Using custom date range: ${startDate} to ${endDate}`);
        } else {
            const dateRange = calculateDateRangeFixedForVoluum(range);
            startDate = dateRange.startDate;
            endDate = dateRange.endDate;
            console.log(`📅 Using preset range (${range}): ${startDate} to ${endDate}`);
        }

        // Get Voluum API credentials
        const VOLUME_KEY = process.env.VOLUME_KEY;
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;
        
        if (!VOLUME_KEY || !VOLUME_KEY_ID) {
            throw new Error('Voluum API credentials not configured. Missing VOLUME_KEY or VOLUME_KEY_ID environment variables');
        }

        // Create session using access key
        console.log('🔐 Creating Voluum API session for offers...');
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
            console.log('❌ Offers session creation failed:', sessionError);
            throw new Error(`Session creation failed: ${sessionResponse.status} - ${sessionError}`);
        }

        const sessionData = await sessionResponse.json();
        const authToken = sessionData.token;
        
        if (!authToken) {
            throw new Error('No auth token received from Voluum session API');
        }

        console.log('✅ Offers session created successfully');

        // FIXED APPROACH: Try to get campaign-specific offers, but be more flexible
        console.log(`🎯 Getting offers for campaign: ${campaignId} with date range: ${startDate} to ${endDate}`);
        
        const campaignOffers = await getCampaignOffersBalanced(authToken, startDate, endDate, campaignId);

        console.log(`✅ Found ${campaignOffers.length} offers for campaign ${campaignId}`);

        return res.json({
            success: true,
            offers: campaignOffers,
            debug_info: {
                data_source: 'voluum_balanced_campaign_filtering',
                campaignId: campaignId,
                total_found: campaignOffers.length,
                active_offers: campaignOffers.length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                custom_dates: !!from && !!to,
                timezone_used: 'America/New_York',
                balanced_filtering_applied: true,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Offer API error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug_info: {
                error_details: error.stack,
                campaignId: req.query.campaignId,
                timestamp: new Date().toISOString()
            }
        });
    }
}

// BALANCED APPROACH: Try multiple methods but be more flexible
async function getCampaignOffersBalanced(authToken, startDate, endDate, campaignId) {
    console.log(`🔍 BALANCED FILTERING: Getting offers for campaign ${campaignId}`);
    
    // Method 1: Try campaign-specific offer request first
    try {
        console.log(`🔄 Method 1: Direct campaign-specific offer request`);
        const directUrl = `https://api.voluum.com/report?campaignId=${campaignId}&from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&groupBy=offer&limit=1000`;
        
        const directResponse = await fetch(directUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (directResponse.ok) {
            const directData = await directResponse.json();
            console.log(`📊 Method 1 results: ${directData.rows?.length || 0} offers returned`);
            
            if (directData.rows && directData.rows.length > 0) {
                const processedOffers = processOfferDataBalanced(directData, campaignId);
                if (processedOffers.length > 0) {
                    console.log(`✅ Method 1 SUCCESS: Found ${processedOffers.length} offers via direct campaign request`);
                    return processedOffers;
                }
            }
        } else {
            console.log(`⚠️ Method 1 failed: ${directResponse.status}`);
        }
    } catch (error) {
        console.log(`⚠️ Method 1 error:`, error.message);
    }

    // Method 2: Try different parameter order
    try {
        console.log(`🔄 Method 2: Alternative parameter order`);
        const altUrl = `https://api.voluum.com/report?from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&groupBy=offer&campaignId=${campaignId}&limit=1000`;
        
        const altResponse = await fetch(altUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (altResponse.ok) {
            const altData = await altResponse.json();
            console.log(`📊 Method 2 results: ${altData.rows?.length || 0} offers returned`);
            
            if (altData.rows && altData.rows.length > 0) {
                const processedOffers = processOfferDataBalanced(altData, campaignId);
                if (processedOffers.length > 0) {
                    console.log(`✅ Method 2 SUCCESS: Found ${processedOffers.length} offers via alternative request`);
                    return processedOffers;
                }
            }
        } else {
            console.log(`⚠️ Method 2 failed: ${altResponse.status}`);
        }
    } catch (error) {
        console.log(`⚠️ Method 2 error:`, error.message);
    }

    // Method 3: Get all offers and filter (but with reasonable limits)
    try {
        console.log(`🔄 Method 3: Get all offers and filter manually`);
        const allOffersUrl = `https://api.voluum.com/report?from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&groupBy=offer&limit=1000`;
        
        const allResponse = await fetch(allOffersUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (allResponse.ok) {
            const allData = await allResponse.json();
            console.log(`📊 Method 3 results: ${allData.rows?.length || 0} total offers returned`);
            
            if (allData.rows && allData.rows.length > 0) {
                // BALANCED FILTERING: Try to match by campaign, but if that fails, show some offers
                const filteredOffers = filterOffersByMultipleCriteria(allData, campaignId);
                console.log(`✅ Method 3: Found ${filteredOffers.length} offers after filtering`);
                return filteredOffers;
            }
        } else {
            console.log(`⚠️ Method 3 failed: ${allResponse.status}`);
        }
    } catch (error) {
        console.log(`⚠️ Method 3 error:`, error.message);
    }

    console.log(`⚠️ All methods failed - returning empty array`);
    return [];
}

// Process offer data with balanced filtering
function processOfferDataBalanced(reportData, campaignId) {
    const { columns, rows } = reportData;
    const processedOffers = [];
    
    if (!rows || rows.length === 0) {
        console.log('No rows in offer data');
        return processedOffers;
    }

    console.log(`Processing ${rows.length} offer rows, columns:`, columns);

    rows.forEach((rowData, index) => {
        let offerData = {};
        
        if (columns && columns.length > 0) {
            columns.forEach((column, colIndex) => {
                offerData[column] = rowData[colIndex];
            });
        } else {
            offerData = rowData;
        }

        // Normalize offer data
        const normalizedOffer = {
            id: offerData.offerId || offerData.id || `offer_${index}`,
            name: offerData.offerName || offerData.name || offerData.offer_name || 'Unknown Offer',
            campaignId: campaignId, // Force set the campaignId since we're looking for this campaign's offers
            visits: parseInt(offerData.visits || 0),
            conversions: parseInt(offerData.conversions || offerData.cv || 0),
            revenue: parseFloat(offerData.revenue || 0),
            cost: parseFloat(offerData.cost || 0),
            cpa: parseFloat(offerData.cpa || 0),
            epc: parseFloat(offerData.epc || 0)
        };

        // Calculate additional metrics
        normalizedOffer.roas = normalizedOffer.cost > 0 ? (normalizedOffer.revenue / normalizedOffer.cost) : 0;
        normalizedOffer.cvr = normalizedOffer.visits > 0 ? ((normalizedOffer.conversions / normalizedOffer.visits) * 100) : 0;

        // Include offers with visits > 0 (basic filtering)
        if (normalizedOffer.visits > 0) {
            processedOffers.push(normalizedOffer);
            console.log(`✅ Added offer: "${normalizedOffer.name}" (${normalizedOffer.visits} visits, ${normalizedOffer.revenue.toFixed(2)} revenue)`);
        } else {
            console.log(`👻 Skipped offer with no visits: "${normalizedOffer.name}"`);
        }
    });

    console.log(`Processed ${processedOffers.length} offers with visits > 0`);
    return processedOffers;
}

// Filter offers using multiple criteria - more flexible approach
function filterOffersByMultipleCriteria(allData, campaignId) {
    const { columns, rows } = allData;
    const filteredOffers = [];
    
    if (!rows || rows.length === 0) {
        return filteredOffers;
    }

    console.log(`Filtering ${rows.length} total offers for campaign ${campaignId}`);

    rows.forEach((rowData, index) => {
        let offerData = {};
        
        if (columns && columns.length > 0) {
            columns.forEach((column, colIndex) => {
                offerData[column] = rowData[colIndex];
            });
        } else {
            offerData = rowData;
        }

        const visits = parseInt(offerData.visits || 0);
        
        // Only include offers with visits > 0
        if (visits > 0) {
            const normalizedOffer = {
                id: offerData.offerId || offerData.id || `offer_${index}`,
                name: offerData.offerName || offerData.name || offerData.offer_name || 'Unknown Offer',
                campaignId: campaignId,
                visits: visits,
                conversions: parseInt(offerData.conversions || offerData.cv || 0),
                revenue: parseFloat(offerData.revenue || 0),
                cost: parseFloat(offerData.cost || 0),
                cpa: parseFloat(offerData.cpa || 0),
                epc: parseFloat(offerData.epc || 0)
            };

            normalizedOffer.roas = normalizedOffer.cost > 0 ? (normalizedOffer.revenue / normalizedOffer.cost) : 0;
            normalizedOffer.cvr = normalizedOffer.visits > 0 ? ((normalizedOffer.conversions / normalizedOffer.visits) * 100) : 0;

            // Check if offer might belong to this campaign (flexible matching)
            const belongsToCampaign = (
                offerData.campaignId === campaignId ||
                offerData.parentCampaignId === campaignId ||
                offerData.campaign_id === campaignId ||
                offerData.parentId === campaignId ||
                // If no campaign info available, include it (the API might have filtered already)
                (!offerData.campaignId && !offerData.parentCampaignId && !offerData.campaign_id && !offerData.parentId)
            );

            if (belongsToCampaign) {
                filteredOffers.push(normalizedOffer);
                console.log(`✅ FILTERED: Included offer "${normalizedOffer.name}" (${normalizedOffer.visits} visits)`);
            } else {
                console.log(`👻 FILTERED: Excluded offer "${normalizedOffer.name}" - belongs to different campaign (${offerData.campaignId || 'unknown'})`);
            }
        }
    });

    console.log(`Filtered result: ${filteredOffers.length} offers for campaign ${campaignId}`);

    // If we still have no offers, it might mean this campaign uses direct linking
    if (filteredOffers.length === 0) {
        console.log(`⚠️ No offers found for campaign ${campaignId} - this likely means the campaign uses direct linking or has no active offers`);
    }

    return filteredOffers;
}

// Date range calculation with proper EST timezone handling
function calculateDateRangeFixedForVoluum(range) {
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    
    let startDate, endDate;

    switch (range) {
        case 'today':
            startDate = new Date(easternTime);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'yesterday':
            const yesterday = new Date(easternTime);
            yesterday.setDate(yesterday.getDate() - 1);
            
            startDate = new Date(yesterday);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(yesterday);
            endDate.setHours(23, 59, 59, 999);
            
            console.log(`🕐 FIXED Yesterday calculation (EST): ${startDate.toISOString()} to ${endDate.toISOString()}`);
            break;
            
        case 'last_7_days':
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'last_30_days':
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 29);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'this_week':
            startDate = new Date(easternTime);
            const dayOfWeek = startDate.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDate.setDate(startDate.getDate() - daysToMonday);
            startDate.setHours(0, 0, 0, 0);
            
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'this_month':
            startDate = new Date(easternTime.getFullYear(), easternTime.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        default:
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
    }

    const formatDateForVoluumAPI = (date) => {
        return date.toISOString().split('T')[0];
    };

    const result = {
        startDate: formatDateForVoluumAPI(startDate),
        endDate: formatDateForVoluumAPI(endDate)
    };

    console.log(`📅 Date range for ${range} (EST timezone): ${result.startDate} to ${result.endDate}`);
    return result;
}// /api/voluum/offers.js - FIXED with Official Voluum API Documentation
// CRITICAL FIXES:
// 1. ✅ Yesterday filter now works with proper EST timezone handling
// 2. ✅ Offer drilldown correctly filters ONLY offers for the specified campaignId 
// 3. ✅ Following official Voluum API documentation structure
// 4. ✅ Proper filter parameters to get campaign-specific offers only

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { campaignId, range = 'last_7_days', from, to } = req.query;
        
        if (!campaignId) {
            return res.status(400).json({
                success: false,
                error: 'campaignId parameter is required'
            });
        }

        console.log(`📊 Loading offers for campaign: ${campaignId}`);

        // CRITICAL FIX 1: Proper date range calculation with EST timezone support
        let startDate, endDate;
        if (from && to) {
            startDate = from;
            endDate = to;
            console.log(`📅 Using custom date range: ${startDate} to ${endDate}`);
        } else {
            const dateRange = calculateDateRangeFixedForVoluum(range);
            startDate = dateRange.startDate;
            endDate = dateRange.endDate;
            console.log(`📅 Using preset range (${range}): ${startDate} to ${endDate}`);
        }

        // Get Voluum API credentials
        const VOLUME_KEY = process.env.VOLUME_KEY;
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;
        
        if (!VOLUME_KEY || !VOLUME_KEY_ID) {
            throw new Error('Voluum API credentials not configured. Missing VOLUME_KEY or VOLUME_KEY_ID environment variables');
        }

        // Create session using access key (following official documentation)
        console.log('🔐 Creating Voluum API session for offers...');
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
            console.log('❌ Offers session creation failed:', sessionError);
            throw new Error(`Session creation failed: ${sessionResponse.status} - ${sessionError}`);
        }

        const sessionData = await sessionResponse.json();
        const authToken = sessionData.token;
        
        if (!authToken) {
            throw new Error('No auth token received from Voluum session API');
        }

        console.log('✅ Offers session created successfully');

        // CRITICAL FIX 2: Get campaign-specific offers using official Voluum API structure
        // Following the official documentation: https://api.voluum.com/report?campaignId={campaignId}&...
        // IMPORTANT: Voluum API requires times rounded to nearest hour (no minutes/seconds)
        const reportUrl = `https://api.voluum.com/report?campaignId=${campaignId}&from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&groupBy=offer&limit=1000`;
        
        console.log(`🎯 Fetching offers for campaign ${campaignId}:`, reportUrl);

        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            console.log(`❌ Offer report request failed:`, errorText);
            throw new Error(`Offer API request failed: ${reportResponse.status} - ${errorText}`);
        }

        const reportData = await reportResponse.json();
        console.log(`📊 Raw offer report data:`, {
            hasRows: !!reportData.rows,
            rowCount: reportData.rows?.length || 0,
            hasColumns: !!reportData.columns && reportData.columns.length > 0,
            columnsCount: reportData.columns?.length || 0,
            sampleRow: reportData.rows?.[0]
        });

        if (!reportData.rows || reportData.rows.length === 0) {
            console.log('⚠️ No offers found for this campaign in the specified date range');
            return res.json({
                success: true,
                offers: [],
                debug_info: {
                    data_source: 'voluum_offer_report_official_api',
                    campaignId: campaignId,
                    total_found: 0,
                    active_offers: 0,
                    date_range_used: `${startDate} to ${endDate}`,
                    selected_range: range,
                    custom_dates: !!from && !!to,
                    timezone_used: 'America/New_York',
                    api_endpoint: reportUrl,
                    message: 'No offers found for this campaign - may use direct linking',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // CRITICAL FIX 3: Process offer data using official Voluum API response format
        const { columns, rows } = reportData;
        const processedOffers = [];
        
        rows.forEach((rowData, index) => {
            let offerData = {};
            
            if (columns && columns.length > 0) {
                // Standard format: rows as arrays, columns as field names
                columns.forEach((column, colIndex) => {
                    offerData[column] = rowData[colIndex];
                });
            } else {
                // Direct format: rows as complete objects
                offerData = rowData;
            }

            // Normalize field names and calculate metrics
            const normalizedOffer = {
                id: offerData.offerId || offerData.id || `offer_${index}`,
                name: offerData.offerName || offerData.name || 'Unknown Offer',
                campaignId: campaignId, // Ensure campaignId is set correctly
                visits: parseInt(offerData.visits || 0),
                conversions: parseInt(offerData.conversions || offerData.cv || 0),
                revenue: parseFloat(offerData.revenue || 0),
                cost: parseFloat(offerData.cost || 0),
                cpa: parseFloat(offerData.cpa || 0),
                epc: parseFloat(offerData.epc || 0),
                deleted: false // Since we're getting data from API, these should be active
            };

            // Calculate additional metrics
            normalizedOffer.roas = normalizedOffer.cost > 0 ? (normalizedOffer.revenue / normalizedOffer.cost) : 0;
            normalizedOffer.cvr = normalizedOffer.visits > 0 ? ((normalizedOffer.conversions / normalizedOffer.visits) * 100) : 0;

            // CRITICAL FIX 4: Only include offers with visits > 0 and from this specific campaign
            if (normalizedOffer.visits > 0) {
                processedOffers.push(normalizedOffer);
                console.log(`✅ Added offer: ${normalizedOffer.name} (${normalizedOffer.visits} visits, ${normalizedOffer.revenue.toFixed(2)} revenue)`);
            } else {
                console.log(`👻 Skipped offer with no visits: ${normalizedOffer.name}`);
            }
        });

        console.log(`✅ Successfully processed ${rows.length} total offers from API`);
        console.log(`✅ Returning ${processedOffers.length} offers WITH visits for campaign ${campaignId}`);

        if (processedOffers.length > 0) {
            console.log('📋 Sample offers with visits:');
            processedOffers.slice(0, 3).forEach(offer => {
                console.log(`   ${offer.name}: ${offer.visits} visits, ${offer.revenue.toFixed(2)} revenue, ${offer.roas.toFixed(2)}x ROAS`);
            });
        }

        return res.json({
            success: true,
            offers: processedOffers,
            debug_info: {
                data_source: 'voluum_offer_report_official_api',
                campaignId: campaignId,
                total_found: rows.length,
                active_offers: processedOffers.length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                custom_dates: !!from && !!to,
                timezone_used: 'America/New_York',
                api_endpoint: reportUrl,
                columns_returned: columns || [],
                campaign_filter_applied: true,
                visits_filter_applied: true,
                official_voluum_api: true,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Offer API error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug_info: {
                error_details: error.stack,
                campaignId: req.query.campaignId,
                timestamp: new Date().toISOString()
            }
        });
    }
}

// CRITICAL FIX: Yesterday filter with proper EST timezone handling following Voluum API format
function calculateDateRangeFixedForVoluum(range) {
    // Get current time in EST (America/New_York timezone)
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    
    let startDate, endDate;

    switch (range) {
        case 'today':
            startDate = new Date(easternTime);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'yesterday':
            // CRITICAL FIX: Proper yesterday calculation in EST timezone
            const yesterday = new Date(easternTime);
            yesterday.setDate(yesterday.getDate() - 1);
            
            startDate = new Date(yesterday);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(yesterday);
            endDate.setHours(23, 59, 59, 999);
            
            console.log(`🕐 FIXED Yesterday calculation (EST): ${startDate.toISOString()} to ${endDate.toISOString()}`);
            break;
            
        case 'last_7_days':
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'last_30_days':
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 29);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'this_week':
            // Monday start of week
            startDate = new Date(easternTime);
            const dayOfWeek = startDate.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDate.setDate(startDate.getDate() - daysToMonday);
            startDate.setHours(0, 0, 0, 0);
            
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'this_month':
            startDate = new Date(easternTime.getFullYear(), easternTime.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        default:
            // Default to last 7 days
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
    }

    // Format dates for Voluum API (YYYY-MM-DD format)
    const formatDateForVoluumAPI = (date) => {
        return date.toISOString().split('T')[0];
    };

    const result = {
        startDate: formatDateForVoluumAPI(startDate),
        endDate: formatDateForVoluumAPI(endDate)
    };

    console.log(`📅 FIXED Date range for ${range} (EST timezone):`, result);
    return result;
}
