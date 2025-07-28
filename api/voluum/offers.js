// /api/voluum/offers.js - CORRECTED Offer-level performance drill-down

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
            startDate = from;
            endDate = to;
            console.log(`📅 Using custom date range: ${startDate} to ${endDate}`);
        } else {
            const dateRange = calculateDateRange(range);
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

        // Get ALL offers with pagination
        const allOffers = await getAllOffersWithPagination(authToken, startDate, endDate, campaignId, offerColumns);
        
        console.log(`📊 Total offers retrieved from API: ${allOffers.length}`);
        
        // CRITICAL FIX: Filter for active offers with visits > 0
        const activeOffers = allOffers.filter(offer => {
            // Check if offer is not deleted
            const isNotDeleted = !offer.deleted && offer.deleted !== true;
            // Check if offer has visits
            const hasVisits = (offer.visits || 0) > 0;
            
            if (!isNotDeleted) {
                console.log(`🗑️ Filtering out deleted offer: ${offer.offerName} (deleted: ${offer.deleted})`);
            }
            if (!hasVisits && isNotDeleted) {
                console.log(`👻 Filtering out offer with no visits: ${offer.offerName} (${offer.visits} visits)`);
            }
            
            return isNotDeleted && hasVisits;
        });

        console.log(`✅ Successfully processed ${allOffers.length} total offers`);
        console.log(`✅ Found ${allOffers.filter(o => !o.deleted).length} active offers`);
        console.log(`✅ Returning ${activeOffers.length} offers WITH visits`);

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
                data_source: 'voluum_offer_report_corrected',
                campaignId: campaignId,
                total_found: allOffers.length,
                active_offers: activeOffers.length,
                deleted_offers: allOffers.filter(o => o.deleted).length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                custom_dates: !!from && !!to,
                columns_requested: offerColumns.split(',').length,
                pagination_used: true,
                visits_filter_applied: true,
                deleted_filter_applied: true,
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

// CORRECTED: Pagination function that handles Voluum's response format properly
async function getAllOffersWithPagination(authToken, startDate, endDate, campaignId, offerColumns) {
    let allOffers = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let pageCount = 0;
    
    console.log('🔄 Starting pagination loop for offers...');
    
    while (hasMore && pageCount < 50) {
        pageCount++;
        const reportUrl = `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=offer&columns=${offerColumns}&tz=America/New_York&campaignId=${campaignId}&limit=${limit}&offset=${offset}`;
        
        console.log(`📄 Fetching offers page ${pageCount} (offset: ${offset})`);
        
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
            hasColumns: !!reportData.columns,
            columnCount: reportData.columns?.length || 0,
            totalSoFar: allOffers.length
        });

        const { rows = [], columns = [] } = reportData;

        if (rows.length === 0) {
            console.log(`⚠️ No more offers at page ${pageCount}`);
            hasMore = false;
            break;
        }

        // CRITICAL FIX: Process offers based on actual Voluum API response format
        console.log(`🔄 Processing ${rows.length} offers from page ${pageCount}...`);
        const pageOffers = rows.map((rowData, index) => {
            try {
                let offerData;
                
                // Handle different response formats from Voluum API
                if (columns && columns.length > 0) {
                    // Format 1: rows are arrays, columns define the structure
                    offerData = {};
                    columns.forEach((column, colIndex) => {
                        offerData[column] = rowData[colIndex];
                    });
                } else {
                    // Format 2: rows are already objects (this is what your debug shows)
                    offerData = rowData;
                }

                // Extract values (handling both formats)
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
                    cpa: parseFloat(offerData.cpa || 0),
                    deleted: offerData.deleted || false,  // Include deleted status
                    // Keep raw data for debugging
                    rawData: offerData
                };
            } catch (error) {
                console.error(`❌ Error processing offer at index ${index}:`, error);
                return null;
            }
        }).filter(Boolean);

        allOffers = allOffers.concat(pageOffers);
        console.log(`✅ Page ${pageCount} processed: ${pageOffers.length} offers added (total: ${allOffers.length})`);
        
        if (rows.length < limit) {
            console.log(`🏁 Reached last page (got ${rows.length} < ${limit} results)`);
            hasMore = false;
        } else {
            offset += limit;
        }
    }

    console.log(`🎉 Pagination complete! Total offers collected: ${allOffers.length} from ${pageCount} pages`);
    return allOffers;
}

function calculateDateRange(range) {
    const now = new Date();
    const timezone = 'America/New_York';
    
    const getEasternDate = (date) => {
        return new Date(date.toLocaleString("en-US", { timeZone: timezone }));
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
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
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

    const formatDate = (date) => {
        return date.toISOString().split('T')[0];
    };

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
}
