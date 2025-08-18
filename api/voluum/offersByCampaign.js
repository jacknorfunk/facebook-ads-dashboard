// /api/voluum/offersByCampaign.js - Enhanced Offers with 7-Day ROAS
// Implements offer drilldown with both UI range and strict "Last 7 Days" ROAS
// Makes separate API calls as required - no client-side computation

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { campaignId, range = 'last_7_days', from, to } = req.query;
        
        if (!campaignId) {
            return res.status(400).json({
                success: false,
                error: 'Campaign ID is required'
            });
        }

        console.log(`🎯 Loading offers for campaign ${campaignId} with range: ${range}`);

        // Calculate date ranges using same logic as campaigns API
        let uiStartDate, uiEndDate;
        if (from && to) {
            uiStartDate = from;
            uiEndDate = to;
            console.log(`📅 Using custom UI date range: ${uiStartDate} to ${uiEndDate}`);
        } else {
            const uiDateRange = calculateDateRangeFixedForVoluum(range);
            uiStartDate = uiDateRange.startDate;
            uiEndDate = uiDateRange.endDate;
            console.log(`📅 Using preset UI range (${range}): ${uiStartDate} to ${uiEndDate}`);
        }

        // Always calculate strict "Last 7 Days" for comparison
        const last7DaysRange = calculateDateRangeFixedForVoluum('last_7_days');
        const last7StartDate = last7DaysRange.startDate;
        const last7EndDate = last7DaysRange.endDate;
        console.log(`📅 Strict Last 7 Days range: ${last7StartDate} to ${last7EndDate}`);

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

        // Make TWO separate API calls as required by the specifications:
        // 1. Get offers for UI date range
        // 2. Get offers for strict "Last 7 Days" (if different from UI range)
        
        console.log(`🔄 API Call 1: Getting offers for UI range (${uiStartDate} to ${uiEndDate})`);
        const uiRangeOffers = await getOffersForDateRange(authToken, campaignId, uiStartDate, uiEndDate, 'UI_Range');
        
        let last7DaysOffers = [];
        let needsSeparate7DayCall = true;
        
        // Check if UI range is exactly the same as last 7 days
        if (uiStartDate === last7StartDate && uiEndDate === last7EndDate) {
            console.log(`ℹ️ UI range matches Last 7 Days exactly - using same data`);
            last7DaysOffers = uiRangeOffers;
            needsSeparate7DayCall = false;
        } else {
            console.log(`🔄 API Call 2: Getting offers for strict Last 7 Days (${last7StartDate} to ${last7EndDate})`);
            last7DaysOffers = await getOffersForDateRange(authToken, campaignId, last7StartDate, last7EndDate, 'Last_7_Days');
        }

        // Merge the data to create combined offer metrics
        const combinedOffers = mergeOfferDataWithDualRanges(uiRangeOffers, last7DaysOffers);

        console.log(`✅ Enhanced offers loaded: ${combinedOffers.length} offers with dual ROAS metrics`);

        return res.json({
            success: true,
            offers: combinedOffers,
            debug_info: {
                data_source: 'voluum_enhanced_offers_with_7d_roas',
                campaignId: campaignId,
                ui_range: `${uiStartDate} to ${uiEndDate}`,
                last_7_days_range: `${last7StartDate} to ${last7EndDate}`,
                total_offers_found: combinedOffers.length,
                separate_7day_call_made: needsSeparate7DayCall,
                api_calls_made: needsSeparate7DayCall ? 2 : 1,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Enhanced offers API error:', error);
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

// Helper function to get offers for a specific date range
async function getOffersForDateRange(authToken, campaignId, startDate, endDate, rangeName) {
    console.log(`📊 Fetching offers for ${rangeName}: ${startDate} to ${endDate}, campaign: ${campaignId}`);
    
    // CRITICAL FIX: Use campaignId parameter to filter offers for this specific campaign only
    const reportUrl = `https://api.voluum.com/report?campaignId=${campaignId}&from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&groupBy=offer&limit=1000`;
    
    console.log(`🔗 Offers API URL: ${reportUrl}`);
    
    const reportResponse = await fetch(reportUrl, {
        headers: {
            'cwauth-token': authToken,
            'Content-Type': 'application/json'
        }
    });

    if (!reportResponse.ok) {
        const errorText = await reportResponse.text();
        console.log(`❌ Offer report request failed for ${rangeName}:`, errorText);
        
        // Handle rate limits with backoff
        if (reportResponse.status === 429) {
            console.log(`⏰ Rate limit hit for ${rangeName}, implementing backoff...`);
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000)); // 1-2 second delay
            
            // Retry once
            const retryResponse = await fetch(reportUrl, {
                headers: {
                    'cwauth-token': authToken,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!retryResponse.ok) {
                throw new Error(`Offer API retry failed for ${rangeName}: ${retryResponse.status}`);
            }
            
            const retryData = await retryResponse.json();
            return processOfferData(retryData, campaignId, rangeName);
        }
        
        throw new Error(`Offer API request failed for ${rangeName}: ${reportResponse.status} - ${errorText}`);
    }

    const reportData = await reportResponse.json();
    return processOfferData(reportData, campaignId, rangeName);
}

// Process offer data from Voluum API response
function processOfferData(reportData, campaignId, rangeName) {
    console.log(`📊 Processing ${rangeName} offer data for campaign ${campaignId}:`, {
        hasRows: !!reportData.rows,
        rowCount: reportData.rows?.length || 0,
        hasColumns: !!reportData.columns && reportData.columns.length > 0
    });

    if (!reportData.rows || reportData.rows.length === 0) {
        console.log(`ℹ️ No offer data found for ${rangeName} in campaign ${campaignId}`);
        return [];
    }

    const offers = [];
    const columns = reportData.columns || [];

    reportData.rows.forEach((rowData, index) => {
        try {
            let offerData = {};
            
            // Handle both column-mapped arrays and direct objects
            if (columns && columns.length > 0) {
                // Format 1: rows are arrays, columns define structure
                columns.forEach((column, colIndex) => {
                    offerData[column] = rowData[colIndex];
                });
            } else {
                // Format 2: rows are already objects (Voluum's actual format)
                offerData = rowData;
            }
            
            // CRITICAL FIX: Filter out deleted offers and offers with no visits
            const isNotDeleted = !offerData.deleted && offerData.deleted !== true;
            const hasVisits = (offerData.visits || 0) > 0;
            
            if (!isNotDeleted || !hasVisits) {
                console.log(`⚠️ Skipping offer ${index}: deleted=${offerData.deleted}, visits=${offerData.visits}`);
                return; // Skip this offer
            }
            
            // CRITICAL FIX: Double-check campaign ID match
            const offerCampaignId = offerData.campaignId || offerData.campaign_id || offerData.campaign;
            if (offerCampaignId && offerCampaignId !== campaignId) {
                console.log(`⚠️ Skipping offer ${index}: belongs to campaign ${offerCampaignId}, not ${campaignId}`);
                return; // Skip offers from other campaigns
            }
            
            // Normalize offer data structure
            const normalizedOffer = {
                id: offerData.id || offerData.offerId || offerData.offer_id || `offer_${index}`,
                name: offerData.name || offerData.offerName || offerData.offer_name || `Offer ${index + 1}`,
                campaignId: campaignId, // Ensure campaign ID is set
                visits: parseInt(offerData.visits || 0),
                conversions: parseInt(offerData.conversions || 0),
                revenue: parseFloat(offerData.revenue || 0),
                cost: parseFloat(offerData.cost || 0),
                
                // Calculate metrics
                roas: 0, // Will be calculated below
                cvr: 0,  // Will be calculated below
                averagePayout: 0, // Will be calculated below
                
                // Meta info
                rangeName: rangeName,
                deleted: false,
                active: true
            };
            
            // Calculate derived metrics with divide-by-zero protection
            normalizedOffer.roas = normalizedOffer.cost > 0 ? (normalizedOffer.revenue / normalizedOffer.cost) : 0;
            normalizedOffer.cvr = normalizedOffer.visits > 0 ? ((normalizedOffer.conversions / normalizedOffer.visits) * 100) : 0;
            normalizedOffer.averagePayout = normalizedOffer.conversions > 0 ? (normalizedOffer.revenue / normalizedOffer.conversions) : 0;
            
            console.log(`✅ Processed offer: ${normalizedOffer.name} (${normalizedOffer.visits} visits, ${normalizedOffer.conversions} conversions)`);
            offers.push(normalizedOffer);
            
        } catch (offerError) {
            console.error(`⚠️ Error processing offer ${index} for ${rangeName}:`, offerError);
        }
    });

    console.log(`✅ Processed ${offers.length} valid offers for ${rangeName} in campaign ${campaignId}`);
    return offers;
}

// Merge UI range and Last 7 Days data into combined offer objects
function mergeOfferDataWithDualRanges(uiRangeOffers, last7DaysOffers) {
    const combinedOffers = [];
    const last7DaysMap = new Map();
    
    // Create a map of Last 7 Days offers for quick lookup
    last7DaysOffers.forEach(offer => {
        last7DaysMap.set(offer.id, offer);
    });
    
    // Process UI range offers and merge with Last 7 Days data
    uiRangeOffers.forEach(uiOffer => {
        const last7DaysOffer = last7DaysMap.get(uiOffer.id);
        
        const combinedOffer = {
            // Base offer info from UI range
            id: uiOffer.id,
            name: uiOffer.name,
            campaignId: uiOffer.campaignId,
            
            // UI Range metrics (current selection)
            visits: uiOffer.visits,
            conversions: uiOffer.conversions,
            revenue: uiOffer.revenue,
            cost: uiOffer.cost,
            roas: uiOffer.roas,
            cvr: uiOffer.cvr,
            averagePayout: uiOffer.averagePayout,
            
            // Last 7 Days metrics (for comparison)
            visits_7d: last7DaysOffer ? last7DaysOffer.visits : 0,
            conversions_7d: last7DaysOffer ? last7DaysOffer.conversions : 0,
            revenue_7d: last7DaysOffer ? last7DaysOffer.revenue : 0,
            cost_7d: last7DaysOffer ? last7DaysOffer.cost : 0,
            roas_7d: last7DaysOffer ? last7DaysOffer.roas : 0,
            cvr_7d: last7DaysOffer ? last7DaysOffer.cvr : 0,
            averagePayout_7d: last7DaysOffer ? last7DaysOffer.averagePayout : 0,
            
            // Meta info
            deleted: false,
            active: true,
            hasLast7DaysData: !!last7DaysOffer
        };
        
        combinedOffers.push(combinedOffer);
        
        // Remove from map to track processed offers
        last7DaysMap.delete(uiOffer.id);
    });
    
    // Add any offers that exist in Last 7 Days but not in UI range
    last7DaysMap.forEach(last7DaysOffer => {
        const combinedOffer = {
            // Base offer info from Last 7 Days
            id: last7DaysOffer.id,
            name: last7DaysOffer.name,
            campaignId: last7DaysOffer.campaignId,
            
            // UI Range metrics (empty since not in UI range)
            visits: 0,
            conversions: 0,
            revenue: 0,
            cost: 0,
            roas: 0,
            cvr: 0,
            averagePayout: 0,
            
            // Last 7 Days metrics
            visits_7d: last7DaysOffer.visits,
            conversions_7d: last7DaysOffer.conversions,
            revenue_7d: last7DaysOffer.revenue,
            cost_7d: last7DaysOffer.cost,
            roas_7d: last7DaysOffer.roas,
            cvr_7d: last7DaysOffer.cvr,
            averagePayout_7d: last7DaysOffer.averagePayout,
            
            // Meta info
            deleted: false,
            active: true,
            hasLast7DaysData: true,
            onlyInLast7Days: true // Flag to indicate this offer is only active in last 7 days
        };
        
        combinedOffers.push(combinedOffer);
    });
    
    return combinedOffers;
}

// Date calculation function (same as campaigns API)
function calculateDateRangeFixedForVoluum(range) {
    const now = new Date();
    let startDate, endDate;
    
    // Always use Eastern Time as per existing implementation
    const easternOffset = -5; // EST offset (adjust for DST if needed)
    
    switch (range) {
        case 'today':
            startDate = new Date(now);
            endDate = new Date(now);
            break;
            
        case 'yesterday':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            endDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
            
        case 'last_7_days':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            endDate = new Date(now);
            break;
            
        case 'last_30_days':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            endDate = new Date(now);
            break;
            
        case 'this_week':
            const dayOfWeek = now.getDay();
            startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
            endDate = new Date(now);
            break;
            
        case 'this_month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now);
            break;
            
        default:
            // Default to last 7 days
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            endDate = new Date(now);
    }
    
    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
}
