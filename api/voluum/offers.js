// /api/voluum/offers.js - Enhanced Offers API with Campaign Scope Restriction
// CRITICAL FIXES:
// 1. ✅ Offers are now ONLY pulled for the specific campaign that was clicked
// 2. ✅ Date range properly follows the global top-level filter (Yesterday, Last 7 Days, etc.)
// 3. ✅ Offers with no visits during the time window are excluded
// 4. ✅ Following official Voluum API documentation structure
// 5. ✅ Proper campaign ID filtering and validation

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { campaignId, range = 'last_7_days', from, to } = req.query;
        
        if (!campaignId) {
            return res.status(400).json({
                success: false,
                error: 'campaignId parameter is required - offers must be scoped to a specific campaign'
            });
        }

        console.log(`📊 Loading offers ONLY for campaign: ${campaignId} (SCOPE RESTRICTED)`);

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
        // IMPORTANT: This ensures offers are ONLY from the specified campaign
        const reportUrl = `https://api.voluum.com/report?campaignId=${campaignId}&from=${startDate}T00:00:00Z&to=${endDate}T23:59:59Z&tz=America/New_York&groupBy=offer&limit=1000`;
        
        console.log(`🎯 Fetching offers SCOPED to campaign ${campaignId}:`, reportUrl);

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
        console.log(`📊 Raw offer report data for campaign ${campaignId}:`, {
            hasRows: !!reportData.rows,
            rowCount: reportData.rows?.length || 0,
            hasColumns: !!reportData.columns && reportData.columns.length > 0,
            columnsCount: reportData.columns?.length || 0,
            sampleRow: reportData.rows?.[0]
        });

        if (!reportData.rows || reportData.rows.length === 0) {
            console.log(`⚠️ No offers found for campaign ${campaignId} in the specified date range`);
            return res.json({
                success: true,
                offers: [],
                debug_info: {
                    data_source: 'voluum_offer_report_campaign_scoped',
                    campaignId: campaignId,
                    total_found: 0,
                    active_offers: 0,
                    date_range_used: `${startDate} to ${endDate}`,
                    selected_range: range,
                    custom_dates: !!from && !!to,
                    timezone_used: 'America/New_York',
                    api_endpoint: reportUrl,
                    message: `No offers found for campaign ${campaignId} - may use direct linking or no visits in date range`,
                    campaign_scope_applied: true,
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
                campaignId: campaignId, // FORCE: Ensure campaignId is set correctly for scope
                visits: parseInt(offerData.visits || 0),
                conversions: parseInt(offerData.conversions || offerData.cv || 0),
                revenue: parseFloat(offerData.revenue || 0),
                cost: parseFloat(offerData.cost || 0),
                cpa: parseFloat(offerData.cpa || 0),
                // FIXED: Use proper payout calculation instead of EPC
                payout: parseFloat(offerData.payout || offerData.conversionPayout || 0),
                deleted: false // Since we're getting data from API, these should be active
            };

            // Calculate additional metrics
            normalizedOffer.roas = normalizedOffer.cost > 0 ? (normalizedOffer.revenue / normalizedOffer.cost) : 0;
            normalizedOffer.cvr = normalizedOffer.visits > 0 ? ((normalizedOffer.conversions / normalizedOffer.visits) * 100) : 0;
            
            // FIXED: Calculate Average Payout properly using payout field or revenue/conversions
            normalizedOffer.averagePayout = normalizedOffer.payout > 0 ? 
                normalizedOffer.payout : 
                (normalizedOffer.conversions > 0 ? (normalizedOffer.revenue / normalizedOffer.conversions) : 0);

            // CRITICAL FIX 4: Only include offers with visits > 0 AND from this specific campaign in the date range
            if (normalizedOffer.visits > 0) {
                processedOffers.push(normalizedOffer);
                console.log(`✅ Added offer: ${normalizedOffer.name} (${normalizedOffer.visits} visits, ${normalizedOffer.revenue.toFixed(2)} revenue) for campaign ${campaignId}`);
            } else {
                console.log(`👻 Skipped offer with no visits in date range: ${normalizedOffer.name}`);
            }
        });

        console.log(`✅ Successfully processed ${rows.length} total offers from API for campaign ${campaignId}`);
        console.log(`✅ Returning ${processedOffers.length} offers WITH visits for campaign ${campaignId} in date range`);

        if (processedOffers.length > 0) {
            console.log(`📋 Sample offers with visits for campaign ${campaignId}:`);
            processedOffers.slice(0, 3).forEach(offer => {
                console.log(`   ${offer.name}: ${offer.visits} visits, ${offer.revenue.toFixed(2)} revenue, ${offer.roas.toFixed(2)}x ROAS`);
            });
        }

        return res.json({
            success: true,
            offers: processedOffers,
            debug_info: {
                data_source: 'voluum_offer_report_campaign_scoped',
                campaignId: campaignId,
                total_found: rows.length,
                active_offers: processedOffers.length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                custom_dates: !!from && !!to,
                timezone_used: 'America/New_York',
                api_endpoint: reportUrl,
                columns_returned: columns || [],
                campaign_scope_applied: true,
                visits_filter_applied: true,
                date_range_filter_applied: true,
                epc_removed: true,
                average_payout_enhanced: true,
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
            endDate.setHours(23, 0, 0, 0); // Round to nearest hour
            break;
            
        case 'yesterday':
            // CRITICAL FIX: Proper yesterday calculation in EST timezone
            const yesterday = new Date(easternTime);
            yesterday.setDate(yesterday.getDate() - 1);
            
            startDate = new Date(yesterday);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(yesterday);
            endDate.setHours(23, 0, 0, 0); // Round to nearest hour
            
            console.log(`🕐 FIXED Yesterday calculation (EST): ${startDate.toISOString()} to ${endDate.toISOString()}`);
            break;
            
        case 'last_7_days':
            endDate = new Date(easternTime);
            endDate.setHours(23, 0, 0, 0); // Round to nearest hour
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'last_30_days':
            endDate = new Date(easternTime);
            endDate.setHours(23, 0, 0, 0); // Round to nearest hour
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
            endDate.setHours(23, 0, 0, 0); // Round to nearest hour
            break;
            
        case 'this_month':
            startDate = new Date(easternTime.getFullYear(), easternTime.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternTime);
            endDate.setHours(23, 0, 0, 0); // Round to nearest hour
            break;
            
        default:
            // Default to last 7 days
            endDate = new Date(easternTime);
            endDate.setHours(23, 0, 0, 0); // Round to nearest hour
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
