// /api/voluum/offers.js - COMPLETE FIX for Offer-level performance drill-down

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

        // Calculate date range - support both preset ranges and custom dates
        let startDate, endDate;
        if (from && to) {
            // Custom date range
            startDate = from;
            endDate = to;
            console.log(`📅 Using custom date range: ${startDate} to ${endDate}`);
        } else {
            // Preset range
            const dateRange = calculateDateRange(range);
            startDate = dateRange.startDate;
            endDate = dateRange.endDate;
            console.log(`📅 Using preset range (${range}): ${startDate} to ${endDate}`);
        }

        // Get Voluum API credentials from environment variables
        const VOLUME_KEY = process.env.VOLUME_KEY;        // Secret Access Key
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;  // Access Key ID
        
        if (!VOLUME_KEY || !VOLUME_KEY_ID) {
            throw new Error('Voluum API credentials not configured. Missing VOLUME_KEY or VOLUME_KEY_ID environment variables');
        }

        // Step 1: Create a session using the access key
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

        // FIXED: Get ALL offers with pagination (this was the main issue!)
        const allOffers = await getAllOffersWithPagination(authToken, startDate, endDate, campaignId, offerColumns);
        
        console.log(`📊 Total offers retrieved from API: ${allOffers.length}`);
        
        // Filter to only offers with visits > 0 (strict filtering)
        const activeOffers = allOffers.filter(offer => {
            const hasVisits = (offer.visits || 0) > 0;
            if (!hasVisits) {
                console.log(`👻 Filtering out offer with no visits: ${offer.name} (${offer.visits} visits)`);
            }
            return hasVisits;
        });

        console.log(`✅ Successfully processed ${allOffers.length} total offers`);
        console.log(`✅ Returning ${activeOffers.length} offers WITH visits`);

        if (activeOffers.length > 0) {
            console.log('📋 Sample offers with visits:');
            activeOffers.slice(0, 3).forEach(offer => {
                console.log(`   ${offer.name}: ${offer.visits} visits, $${offer.revenue.toFixed(2)} revenue, ${offer.roas.toFixed(2)}x ROAS`);
            });
        } else {
            console.log('⚠️ No offers found with visits for this campaign in the selected date range');
            console.log('💡 This could mean:');
            console.log('   - Campaign uses direct linking (no offer tracking)');
            console.log('   - Offers exist but have no visits in this date range');
            console.log('   - Campaign ID does not match any offers');
        }

        return res.json({
            success: true,
            offers: activeOffers,
            debug_info: {
                data_source: 'voluum_offer_report_with_pagination',
                campaignId: campaignId,
                total_found: allOffers.length,
                active_offers: activeOffers.length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                custom_dates: !!from && !!to,
                columns_requested: offerColumns.split(',').length,
                pagination_used: true,
                visits_filter_applied: true,
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
                timestamp: new Date().toISOString(),
                troubleshooting: {
                    step1: 'Check if campaignId exists in Voluum',
                    step2: 'Verify date range is not in the future',
                    step3: 'Ensure campaign has offers configured',
                    step4: 'Check if offers have visits in the selected period'
                }
            }
        });
    }
}

// CRITICAL: This function was missing - it handles pagination to get ALL offers
async function getAllOffersWithPagination(authToken, startDate, endDate, campaignId, offerColumns) {
    let allOffers = [];
    let offset = 0;
    const limit = 100; // Voluum API limit per request
    let hasMore = true;
    let pageCount = 0;
    
    console.log('🔄 Starting pagination loop for offers...');
    
    while (hasMore && pageCount < 50) { // Safety limit to prevent infinite loops
        pageCount++;
        const reportUrl = `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=offer&columns=${offerColumns}&tz=America/New_York&campaignId=${campaignId}&limit=${limit}&offset=${offset}`;
        
        console.log(`📄 Fetching offers page ${pageCount} (offset: ${offset})`);
        console.log(`🔗 URL: ${reportUrl}`);
        
        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            console.log(`❌ Offer pagination request failed at offset ${offset}:`, {
                status: reportResponse.status,
                statusText: reportResponse.statusText,
                error: errorText,
                page: pageCount
            });
            
            // If it's the first page and fails, throw error
            if (offset === 0) {
                throw new Error(`Offer API request failed: ${reportResponse.status} - ${errorText}`);
            }
            // Otherwise, break the loop (partial data is better than none)
            console.log('⚠️ Breaking pagination loop due to API error');
            break;
        }

        const reportData = await reportResponse.json();
        console.log(`📊 Page ${pageCount} results:`, {
            hasRows: !!reportData.rows,
            rowCount: reportData.rows?.length || 0,
            hasColumns: !!reportData.columns,
            totalSoFar: allOffers.length
        });

        const { rows = [], columns = [] } = reportData;

        if (rows.length === 0) {
            console.log(`⚠️ No more offers at page ${pageCount} (offset ${offset})`);
            hasMore = false;
            break;
        }

        // Process offers from this page
        console.log(`🔄 Processing ${rows.length} offers from page ${pageCount}...`);
        const pageOffers = rows.map((row, index) => {
            try {
                const offerData = {};
                columns.forEach((column, colIndex) => {
                    offerData[column] = row[colIndex];
                });

                const visits = parseInt(offerData.visits || 0);
                const conversions = parseInt(offerData.conversions || 0);
                const revenue = parseFloat(offerData.revenue || 0);
                const spend = parseFloat(offerData.cost || 0);

                // Calculate metrics
                const roas = spend > 0 ? revenue / spend : 0;
                const epc = visits > 0 ? revenue / visits : 0;
                const cvr = visits > 0 ? (conversions / visits) * 100 : 0;
                const aov = conversions > 0 ? revenue / conversions : 0;

                return {
                    id: offerData.offerId || Math.random().toString(36).substr(2, 9),
                    name: offerData.offerName || 'Unnamed Offer',
                    visits: visits,
                    conversions: conversions,
                    revenue: revenue,
                    spend: spend,
                    roas: roas,
                    epc: epc,
                    cvr: cvr,
                    aov: aov,
                    cpa: parseFloat(offerData.cpa || 0)
                };
            } catch (error) {
                console.error(`❌ Error processing offer at index ${index}:`, error);
                return null;
            }
        }).filter(Boolean);

        // Add this page's offers to our collection
        allOffers = allOffers.concat(pageOffers);
        console.log(`✅ Page ${pageCount} processed: ${pageOffers.length} offers added (total: ${allOffers.length})`);
        
        // Check if we got fewer results than the limit (last page)
        if (rows.length < limit) {
            console.log(`🏁 Reached last page (got ${rows.length} < ${limit} results)`);
            hasMore = false;
        } else {
            offset += limit;
            console.log(`➡️ Moving to next page (offset: ${offset})`);
        }
    }

    console.log(`🎉 Pagination complete! Total offers collected: ${allOffers.length} from ${pageCount} pages`);
    return allOffers;
}

// FIXED: Date calculation function with proper "Yesterday" handling
function calculateDateRange(range) {
    const now = new Date();
    const timezone = 'America/New_York'; // Eastern Time to match Voluum account
    
    // Helper to get date in Eastern Time
    const getEasternDate = (date) => {
        return new Date(date.toLocaleString("en-US", { timeZone: timezone }));
    };
    
    // Current date in Eastern Time
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
            // FIXED: Proper yesterday calculation
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
            
            console.log('📅 Yesterday calculation:', {
                easternNow: easternNow.toISOString(),
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });
            break;
            
        case 'last_7_days':
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 6); // 7 days including today
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'last_30_days':
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 29); // 30 days including today
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'this_week':
            // Monday to Sunday
            startDate = new Date(easternNow);
            const dayOfWeek = startDate.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
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
            // Default to last 7 days
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
    }

    // Convert to ISO strings for Voluum API (YYYY-MM-DD format) 
    const formatDate = (date) => {
        return date.toISOString().split('T')[0];
    };

    const result = {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
    
    console.log(`📅 Date range calculation for "${range}":`, result);
    
    return result;
}
