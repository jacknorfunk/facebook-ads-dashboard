// /api/voluum/offers.js - FIXED Offer-level performance drill-down

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
            'profit',
            'cpv',
            'ctr',
            'cr',
            'cv',
            'roi',
            'epv',
            'epc',
            'ap',
            'errors'
        ].join(',');

        console.log('🎯 Starting offer data collection with PAGINATION...');

        // Get ALL offers with pagination - CRITICAL FIX: Pass campaignId properly
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

        // Process offers to calculate additional metrics
        const processedOffers = activeOffers.map(offer => {
            const revenue = offer.revenue || 0;
            const cost = offer.cost || 0;
            const visits = offer.visits || 0;
            const conversions = offer.conversions || 0;
            
            return {
                id: offer.offerId,
                name: offer.offerName || 'Unknown Offer',
                revenue: revenue,
                spend: cost,
                profit: revenue - cost,
                roas: cost > 0 ? revenue / cost : 0,
                cpa: conversions > 0 ? cost / conversions : 0,
                cvr: visits > 0 ? (conversions / visits) * 100 : 0,
                visits: visits,
                conversions: conversions,
                aov: conversions > 0 ? revenue / conversions : 0,
                epc: visits > 0 ? revenue / visits : 0
            };
        });

        console.log(`✅ Successfully processed ${allOffers.length} total offers`);
        console.log(`✅ Found ${allOffers.filter(o => !o.deleted).length} active offers`);
        console.log(`✅ Returning ${processedOffers.length} offers WITH visits`);

        if (processedOffers.length > 0) {
            console.log('📋 Sample offers with visits:');
            processedOffers.slice(0, 3).forEach(offer => {
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
            offers: processedOffers,
            debug_info: {
                data_source: 'voluum_offer_report_fixed',
                campaignId: campaignId,
                total_found: allOffers.length,
                active_offers: processedOffers.length,
                deleted_offers: allOffers.filter(o => o.deleted).length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                custom_dates: !!from && !!to,
                columns_requested: offerColumns.split(',').length,
                pagination_used: true,
                visits_filter_applied: true,
                deleted_filter_applied: true,
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

// FIXED: Pagination function that properly filters by campaignId
async function getAllOffersWithPagination(authToken, startDate, endDate, campaignId, offerColumns) {
    let allOffers = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let pageCount = 0;
    
    console.log(`🔄 Starting pagination loop for offers (campaignId: ${campaignId})...`);
    
    while (hasMore && pageCount < 50) {
        pageCount++;
        
        // CRITICAL FIX: Properly filter by campaignId in the API request
        const reportUrl = `https://api.voluum.com/report?` + new URLSearchParams({
            from: startDate,
            to: endDate,
            groupBy: 'offer',
            columns: offerColumns,
            tz: 'America/New_York',
            filter: JSON.stringify({
                campaignId: campaignId  // FIXED: Proper campaign filtering
            }),
            limit: limit.toString(),
            offset: offset.toString()
        }).toString();
        
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
            hasColumns: !!reportData.columns,
            columnCount: reportData.columns?.length || 0
        });

        if (reportData.rows && reportData.rows.length > 0) {
            const { columns, rows } = reportData;
            
            // FIXED: Handle both column-mapped and direct object formats
            const pageOffers = rows.map(rowData => {
                let offerData;
                
                if (columns && columns.length > 0) {
                    // Format 1: rows are arrays, columns define structure
                    offerData = {};
                    columns.forEach((column, colIndex) => {
                        offerData[column] = rowData[colIndex];
                    });
                } else {
                    // Format 2: rows are already objects (Voluum's actual format)
                    offerData = rowData;
                }
                
                return offerData;
            });
            
            allOffers = allOffers.concat(pageOffers);
            console.log(`✅ Added ${pageOffers.length} offers from page ${pageCount}. Total so far: ${allOffers.length}`);
            
            // Check if we should continue pagination
            if (rows.length < limit) {
                hasMore = false;
                console.log('📋 Reached end of data (less than limit returned)');
            } else {
                offset += limit;
            }
        } else {
            hasMore = false;
            console.log('📋 No more offers to fetch');
        }
    }
    
    console.log(`✅ Pagination complete. Total offers retrieved: ${allOffers.length}`);
    return allOffers;
}

// FIXED: Proper date calculation for EST timezone
function calculateDateRange(range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let startDate, endDate;
    
    // Convert to EST timezone offset
    const estOffset = -5; // EST is UTC-5
    const localOffset = now.getTimezoneOffset() / 60;
    const offsetDiff = localOffset + estOffset;
    
    switch (range) {
        case 'today':
            startDate = new Date(today);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'yesterday':
            // FIXED: Proper yesterday calculation
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 1);
            endDate = new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
            console.log('📅 Yesterday calculation:', {
                today: today.toISOString(),
                yesterdayStart: startDate.toISOString(),
                yesterdayEnd: endDate.toISOString()
            });
            break;
            
        case 'last_7_days':
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 7);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'last_14_days':
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 14);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'last_30_days':
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 30);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        default:
            // Default to last 7 days
            startDate = new Date(today);
            startDate.setDate(startDate.getDate() - 7);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59, 999);
    }
    
    // Apply timezone offset adjustment
    startDate.setHours(startDate.getHours() + offsetDiff);
    endDate.setHours(endDate.getHours() + offsetDiff);
    
    // Format dates as YYYY-MM-DD
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
}
