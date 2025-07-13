// /api/voluum/offers.js - Voluum Offers API

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const debugLogs = [];
    
    function log(message) {
        const timestamp = new Date().toISOString();
        debugLogs.push(`[${timestamp}] ${message}`);
        console.log(message);
    }

    try {
        log('=== VOLUUM OFFERS API START ===');
        
        // Get parameters
        const campaignId = req.query.campaign_id;
        const dateRange = req.query.date_range || 'last_7_days';
        
        log(`Campaign ID: ${campaignId}, Date range: ${dateRange}`);
        
        if (!campaignId) {
            return res.status(400).json({
                success: false,
                error: 'campaign_id parameter is required',
                debug_logs: debugLogs
            });
        }
        
        // Check environment variables
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;
        
        if (!accessId || !accessKey) {
            log('ERROR: Missing environment variables');
            return res.status(200).json({
                success: false,
                error: 'Missing Voluum API credentials',
                debug_logs: debugLogs
            });
        }

        log(`Credentials found - AccessID: ${accessId.length} chars, AccessKey: ${accessKey.length} chars`);

        // Step 1: Authentication
        log('Starting authentication with Voluum...');
        
        const authPayload = {
            accessId: accessId,
            accessKey: accessKey
        };
        
        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(authPayload)
        });

        log(`Auth response status: ${authResponse.status}`);
        
        if (!authResponse.ok) {
            const authError = await authResponse.text();
            log(`AUTH FAILED - Status: ${authResponse.status}, Error: ${authError.substring(0, 200)}`);
            return res.status(200).json({
                success: false,
                error: `Authentication failed: ${authResponse.status}`,
                debug_logs: debugLogs
            });
        }

        const authData = await authResponse.json();
        const sessionToken = authData.token;
        
        if (!sessionToken) {
            log('ERROR: No token in auth response');
            return res.status(200).json({
                success: false,
                error: 'No session token received',
                debug_logs: debugLogs
            });
        }

        log('Authentication successful - fetching offer data...');

        // Step 2: Get date range
        const { fromDate, toDate } = getDateRange(dateRange);
        log(`Date range: ${fromDate} to ${toDate}`);

        // Step 3: Fetch offer-level data for the campaign
        // Use groupBy=offer and filter by campaignId
        const offerReportUrl = `https://api.voluum.com/report?from=${fromDate}&to=${toDate}&groupBy=offer&campaignId=${campaignId}&limit=1000&columns=offerId,offerName,offerUrl,visits,clicks,conversions,revenue,cost,impressions`;
        
        log(`Fetching offers: ${offerReportUrl}`);
        
        const offerResponse = await fetch(offerReportUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': sessionToken,
                'Content-Type': 'application/json'
            }
        });

        if (!offerResponse.ok) {
            const reportError = await offerResponse.text();
            log(`OFFER REPORT FAILED - Status: ${offerResponse.status}, Error: ${reportError.substring(0, 200)}`);
            return res.status(200).json({
                success: false,
                error: `Offer report fetch failed: ${offerResponse.status}`,
                debug_logs: debugLogs
            });
        }

        const offerData = await offerResponse.json();
        log(`Offer data received - Total rows: ${offerData.totalRows || 0}`);
        log(`Column mappings: ${Object.keys(offerData.columnMappings || {}).join(', ')}`);

        // Step 4: Process offer data
        const processedOffers = processOfferData(offerData, debugLogs);
        
        log(`Processing complete - ${processedOffers.length} offers processed`);

        return res.status(200).json({
            success: true,
            offers: processedOffers,
            debug_logs: debugLogs,
            debug_info: {
                campaign_id: campaignId,
                date_range: dateRange,
                total_offers: processedOffers.length,
                raw_rows: offerData.totalRows || 0
            }
        });

    } catch (error) {
        log(`CRITICAL ERROR: ${error.message}`);
        log(`Error stack: ${error.stack}`);
        
        return res.status(200).json({
            success: false,
            error: error.message,
            debug_logs: debugLogs
        });
    }
}

function processOfferData(offerData, debugLogs) {
    debugLogs.push('Processing offer data...');
    
    const offers = [];
    const rows = offerData.rows || [];
    
    debugLogs.push(`Processing ${rows.length} offer rows`);
    
    // Log structure of first row for debugging
    if (rows[0]) {
        debugLogs.push(`First row keys: ${Object.keys(rows[0]).slice(0, 10).join(', ')}...`);
        debugLogs.push(`Sample values: name="${rows[0].offerName}", visits=${rows[0].visits}, revenue=${rows[0].revenue}`);
    }
    
    // Process each offer row
    rows.forEach((row, index) => {
        try {
            // Extract data directly from object properties
            const offerId = row.offerId || `offer_${index}`;
            const offerName = row.offerName || `Offer ${index + 1}`;
            const offerUrl = row.offerUrl || '';
            
            // Core metrics - directly from object properties
            const visits = parseFloat(row.visits || 0);
            const conversions = parseFloat(row.conversions || 0);
            const revenue = parseFloat(row.revenue || 0);
            const cost = parseFloat(row.cost || 0);
            const clicks = parseFloat(row.clicks || 0);
            const impressions = parseFloat(row.impressions || 0);
            
            // Calculate derived metrics
            const roas = cost > 0 ? revenue / cost : 0;
            const cpa = conversions > 0 ? cost / conversions : 0;
            const cvr = visits > 0 ? (conversions / visits) * 100 : 0;
            const payout = conversions > 0 ? revenue / conversions : 0;
            
            const offer = {
                id: offerId,
                name: offerName,
                offerName: offerName, // Support both field names
                url: offerUrl,
                visits: visits,
                conversions: conversions,
                revenue: revenue,
                cost: cost,
                clicks: clicks,
                impressions: impressions,
                roas: roas,
                cpa: cpa,
                cvr: cvr,
                payout: payout
            };
            
            offers.push(offer);
            
            // Log first few offers for debugging
            if (index < 3) {
                debugLogs.push(`Offer ${index + 1}: "${offer.name}" | Visits: ${offer.visits} | Revenue: $${offer.revenue} | Cost: $${offer.cost} | ROAS: ${offer.roas.toFixed(2)}`);
            }
            
        } catch (error) {
            debugLogs.push(`Error processing offer ${index}: ${error.message}`);
        }
    });
    
    debugLogs.push(`Final processing result: ${offers.length} offers processed`);
    
    return offers;
}

function getDateRange(range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (range) {
        case 'today':
            return {
                fromDate: formatDate(today),
                toDate: formatDate(today)
            };
        case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return {
                fromDate: formatDate(yesterday),
                toDate: formatDate(yesterday)
            };
        case 'last_7_days':
            const week = new Date(today);
            week.setDate(week.getDate() - 7);
            return {
                fromDate: formatDate(week),
                toDate: formatDate(today)
            };
        case 'last_14_days':
            const twoWeeks = new Date(today);
            twoWeeks.setDate(twoWeeks.getDate() - 14);
            return {
                fromDate: formatDate(twoWeeks),
                toDate: formatDate(today)
            };
        case 'last_30_days':
            const month = new Date(today);
            month.setDate(month.getDate() - 30);
            return {
                fromDate: formatDate(month),
                toDate: formatDate(today)
            };
        default:
            const defaultWeek = new Date(today);
            defaultWeek.setDate(defaultWeek.getDate() - 7);
            return {
                fromDate: formatDate(defaultWeek),
                toDate: formatDate(today)
            };
    }
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}
