// /api/voluum/offers.js - Offer-level performance drill-down

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { campaignId, range = 'last_7_days' } = req.query;
        
        if (!campaignId) {
            return res.status(400).json({
                success: false,
                error: 'campaignId parameter is required'
            });
        }

        console.log(`📊 Loading offers for campaign: ${campaignId}, range: ${range}`);

        // Calculate date range (same logic as campaigns)
        const { startDate, endDate } = calculateDateRange(range);
        console.log(`📅 Using date range: ${startDate} to ${endDate}`);

        // Get Voluum API token
        const VOLUUM_API_TOKEN = process.env.VOLUUM_API_TOKEN;
        if (!VOLUUM_API_TOKEN) {
            throw new Error('Voluum API token not configured');
        }

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

        // Build Voluum API request URL with campaign filter
        const reportUrl = `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=offer&columns=${offerColumns}&tz=America/New_York&campaignId=${campaignId}&limit=100`;
        
        console.log('🎯 Requesting OFFER-level data:', reportUrl);

        // Make API request to Voluum
        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': VOLUUM_API_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            console.log('❌ Offer report failed:', errorText);
            
            // Return empty result with error info
            return res.status(200).json({
                success: true,
                offers: [],
                debug_info: {
                    error: 'Offer API request failed',
                    status: reportResponse.status,
                    response: errorText,
                    campaignId: campaignId,
                    date_range: `${startDate} to ${endDate}`,
                    message: 'This could be due to no offer data available for this campaign or API limitations'
                }
            });
        }

        // Parse the response
        const reportData = await reportResponse.json();
        console.log('📊 Offer report data structure:', {
            hasRows: !!reportData.rows,
            rowCount: reportData.rows?.length || 0,
            hasColumns: !!reportData.columns,
            columnCount: reportData.columns?.length || 0
        });

        const { rows = [], columns = [] } = reportData;

        if (rows.length === 0) {
            console.log('⚠️ No offer data returned for this campaign');
            return res.json({
                success: true,
                offers: [],
                debug_info: {
                    data_source: 'voluum_offer_report',
                    message: 'No offers found for this campaign in the selected date range',
                    campaignId: campaignId,
                    date_range: `${startDate} to ${endDate}`,
                    api_response_rows: 0
                }
            });
        }

        // Process offers from report data
        const offers = rows.map(row => {
            const offerData = {};
            columns.forEach((column, index) => {
                offerData[column] = row[index];
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
        });

        // Filter to only offers with visits
        const activeOffers = offers.filter(offer => offer.visits > 0);

        console.log(`✅ Successfully processed ${offers.length} total offers`);
        console.log(`✅ Returning ${activeOffers.length} offers with visits`);

        if (activeOffers.length > 0) {
            console.log('📋 Sample offers:');
            activeOffers.slice(0, 3).forEach(offer => {
                console.log(`   ${offer.name}: ${offer.visits} visits, £${offer.revenue} revenue, ${offer.roas.toFixed(2)}x ROAS`);
            });
        }

        return res.json({
            success: true,
            offers: activeOffers,
            debug_info: {
                data_source: 'voluum_offer_report',
                campaignId: campaignId,
                total_found: offers.length,
                active_offers: activeOffers.length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                columns_requested: offerColumns.split(',').length,
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

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
}
