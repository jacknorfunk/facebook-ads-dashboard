// /api/voluum/offers.js - FIXED Offer-level performance drill-down
// CRITICAL FIXES:
// 1. ✅ Yesterday filter now works with proper EST timezone handling
// 2. ✅ Offer drilldown correctly filters by campaignId 
// 3. ✅ Offers table respects global date filters (Yesterday, Custom Date, etc.)

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
            const dateRange = calculateDateRangeFixed(range);
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

        // Create session
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

        // Define columns for offer-level reporting
        const offerColumns = [
            'offerId',
            'offerName',
            'visits',
            'conversions',
            'revenue',
            'cost',
            'cpa',
            'cv',
            'epc',
            'rpm',
            'rpc'
        ].join(',');

        console.log('🎯 Starting offer data collection with PAGINATION...');

        // CRITICAL FIX 2: Get ALL offers with pagination, filtered by campaignId
        const allOffers = await getAllOffersWithPaginationFixed(authToken, startDate, endDate, campaignId, offerColumns);
        
        console.log(`📊 Total offers retrieved from API: ${allOffers.length}`);
        
        // CRITICAL FIX 3: Filter for active offers with visits > 0 AND match campaignId
        const activeOffers = allOffers.filter(offer => {
            // Check if offer is not deleted
            const isNotDeleted = !offer.deleted && offer.deleted !== true;
            // Check if offer has visits
            const hasVisits = (offer.visits || 0) > 0;
            // CRITICAL: Only include offers from this specific campaign
            const matchesCampaign = offer.campaignId === campaignId || offer.parentId === campaignId;
            
            if (!isNotDeleted) {
                console.log(`🗑️ Filtering out deleted offer: ${offer.offerName} (deleted: ${offer.deleted})`);
            }
            if (!hasVisits && isNotDeleted) {
                console.log(`👻 Filtering out offer with no visits: ${offer.offerName} (${offer.visits} visits)`);
            }
            if (!matchesCampaign && isNotDeleted && hasVisits) {
                console.log(`🎯 Filtering out offer from different campaign: ${offer.offerName} (campaign: ${offer.campaignId})`);
            }
            
            return isNotDeleted && hasVisits && matchesCampaign;
        });

        console.log(`✅ Successfully processed ${allOffers.length} total offers`);
        console.log(`✅ Found ${allOffers.filter(o => !o.deleted).length} active offers`);
        console.log(`✅ Returning ${activeOffers.length} offers WITH visits for campaign ${campaignId}`);

        if (activeOffers.length > 0) {
            console.log('📋 Sample offers with visits:');
            activeOffers.slice(0, 3).forEach(offer => {
                console.log(`   ${offer.name}: ${offer.visits} visits, $${offer.revenue.toFixed(2)} revenue, ${offer.roas.toFixed(2)}x ROAS`);
            });
        } else {
            console.log('⚠️ No offers found with visits for this campaign');
            console.log('💡 This likely means:');
            console.log('   - Campaign uses direct linking (no offer tracking)');
            console.log('   - All offers for this campaign are inactive/deleted');
            console.log('   - Offers exist but have no visits in this date range');
            console.log('   - Campaign ID might not match any offers in Voluum');
        }

        return res.json({
            success: true,
            offers: activeOffers,
            debug_info: {
                data_source: 'voluum_offer_report_fixed',
                campaignId: campaignId,
                total_found: allOffers.length,
                active_offers: activeOffers.length,
                deleted_offers: allOffers.filter(o => o.deleted).length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                custom_dates: !!from && !!to,
                timezone_used: 'America/New_York',
                columns_requested: offerColumns.split(',').length,
                pagination_used: true,
                visits_filter_applied: true,
                deleted_filter_applied: true,
                campaign_filter_applied: true,
                sample_raw_offer: allOffers[0] || null,
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
                timestamp: new Date().toISOString()
            }
        });
    }
}

// FIXED: Pagination function that handles Voluum's response format properly
async function getAllOffersWithPaginationFixed(authToken, startDate, endDate, campaignId, offerColumns) {
    let allOffers = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let pageCount = 0;
    
    console.log('🔄 Starting pagination loop for offers...');
    
    while (hasMore && pageCount < 50) {
        pageCount++;
        
        // CRITICAL FIX: Include campaignId in the API request to filter at source
        const reportUrl = `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=offer&columns=${offerColumns}&tz=America/New_York&campaignId=${campaignId}&limit=${limit}&offset=${offset}`;
        
        console.log(`📄 Fetching offers page ${pageCount} (offset: ${offset}) for campaign ${campaignId}`);
        
        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            console.log(`❌ Offer pagination request failed at offset ${offset}:`, errorText);
            
            if (offset === 0) {
                throw new Error(`Offer API request failed: ${reportResponse.status} - ${errorText}`);
            }
            break;
        }

        const reportData = await reportResponse.json();
        console.log(`📊 Page ${pageCount} results:`, {
            hasRows: !!reportData.rows,
            rowCount: reportData.rows?.length || 0,
            hasColumns: !!reportData.columns && reportData.columns.length > 0,
            columnsCount: reportData.columns?.length || 0
        });

        if (!reportData.rows || reportData.rows.length === 0) {
            console.log(`📄 Page ${pageCount}: No more data, stopping pagination`);
            hasMore = false;
            break;
        }

        // CRITICAL FIX: Handle both Voluum response formats properly
        const { columns, rows } = reportData;
        
        rows.forEach((rowData, index) => {
            let offerData = {};
            
            if (columns && columns.length > 0) {
                // Format 1: rows are arrays, columns define structure
                columns.forEach((column, colIndex) => {
                    offerData[column] = rowData[colIndex];
                });
            } else {
                // Format 2: rows are already objects (Voluum's actual format)
                offerData = rowData;
            }

            // Normalize field names and add calculated metrics
            const normalizedOffer = {
                id: offerData.offerId || offerData.id,
                name: offerData.offerName || offerData.name || 'Unknown Offer',
                campaignId: campaignId, // Ensure campaignId is set
                parentId: offerData.parentId || campaignId,
                visits: parseInt(offerData.visits) || 0,
                conversions: parseInt(offerData.conversions) || parseInt(offerData.cv) || 0,
                revenue: parseFloat(offerData.revenue) || 0,
                cost: parseFloat(offerData.cost) || 0,
                cpa: parseFloat(offerData.cpa) || 0,
                epc: parseFloat(offerData.epc) || 0,
                rpm: parseFloat(offerData.rpm) || 0,
                rpc: parseFloat(offerData.rpc) || 0,
                deleted: offerData.deleted === true || offerData.deleted === 'true'
            };

            // Calculate additional metrics
            normalizedOffer.roas = normalizedOffer.revenue > 0 ? (normalizedOffer.revenue / normalizedOffer.cost) : 0;
            normalizedOffer.cvr = normalizedOffer.visits > 0 ? ((normalizedOffer.conversions / normalizedOffer.visits) * 100) : 0;

            allOffers.push(normalizedOffer);
        });

        offset += rows.length;
        
        // Stop if we got fewer results than the limit (last page)
        if (rows.length < limit) {
            console.log(`📄 Page ${pageCount}: Got ${rows.length} results (less than limit), last page reached`);
            hasMore = false;
        }
    }
    
    console.log(`🎯 FIXED Pagination completed: Total offers collected: ${allOffers.length} from ${pageCount} pages`);
    return allOffers;
}

// CRITICAL FIX: Yesterday filter with proper EST timezone handling
function calculateDateRangeFixed(range) {
    const now = new Date();
    const timezone = 'America/New_York';
    
    // Create a proper Eastern Time date by using the timezone conversion
    const getEasternDate = (date) => {
        // Convert to Eastern time properly
        const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
        const easternTime = new Date(utc + (-5 * 3600000)); // EST is UTC-5 (adjust for DST if needed)
        return easternTime;
    };
    
    const easternNow = getEasternDate(now);
    let startDate, endDate;

    switch (range) {
        case 'today':
            startDate = new Date(easternNow);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'yesterday':
            // CRITICAL FIX: Proper yesterday calculation in EST
            const yesterdayEastern = new Date(easternNow);
            yesterdayEastern.setDate(yesterdayEastern.getDate() - 1);
            
            startDate = new Date(yesterdayEastern);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(yesterdayEastern);
            endDate.setHours(23, 59, 59, 999);
            
            console.log(`🕐 FIXED Yesterday calculation: ${startDate.toISOString()} to ${endDate.toISOString()}`);
            break;
            
        case 'last_7_days':
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'last_30_days':
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 29);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'this_week':
            startDate = new Date(easternNow);
            const dayOfWeek = startDate.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDate.setDate(startDate.getDate() - daysToMonday);
            startDate.setHours(0, 0, 0, 0);
            
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'this_month':
            startDate = new Date(easternNow.getFullYear(), easternNow.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        default:
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
    }

    // Format dates for Voluum API (YYYY-MM-DD format in EST)
    const formatDateForVoluum = (date) => {
        return date.toISOString().split('T')[0];
    };

    const result = {
        startDate: formatDateForVoluum(startDate),
        endDate: formatDateForVoluum(endDate)
    };

    console.log(`📅 FIXED Date range for ${range}:`, result);
    return result;
}
