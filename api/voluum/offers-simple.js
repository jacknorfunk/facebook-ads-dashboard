// /api/voluum/offers-simple.js - Fixed Voluum Offers API

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

        // Step 3: First verify the campaign exists and get its details
        const campaignVerifyUrl = `https://api.voluum.com/report?from=${fromDate}&to=${toDate}&groupBy=campaign&campaignId=${encodeURIComponent(campaignId)}&limit=1`;
        
        log(`Verifying campaign exists: ${campaignVerifyUrl}`);
        
        const campaignResponse = await fetch(campaignVerifyUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': sessionToken,
                'Content-Type': 'application/json'
            }
        });

        if (!campaignResponse.ok) {
            log(`Campaign verification failed: ${campaignResponse.status}`);
            return res.status(200).json({
                success: false,
                error: `Campaign verification failed: ${campaignResponse.status}`,
                debug_logs: debugLogs
            });
        }

        const campaignData = await campaignResponse.json();
        log(`Campaign verification response: ${campaignData.totalRows || 0} campaigns found`);

        if (!campaignData.rows || campaignData.rows.length === 0) {
            log('Campaign not found or no data for date range');
            return res.status(200).json({
                success: false,
                error: 'Campaign not found or no data for selected date range',
                debug_logs: debugLogs
            });
        }

        // Step 4: Fetch offer-level data for this specific campaign - enhanced with multi-period data
        const { fromDate: from7d, toDate: to7d } = getDateRange('last_7_days');
        const { fromDate: from14d, toDate: to14d } = getDateRange('last_14_days');
        const { fromDate: from30d, toDate: to30d } = getDateRange('last_30_days');
        
        // Fetch current period offers
        const offerReportUrl = `https://api.voluum.com/report?from=${fromDate}&to=${toDate}&groupBy=offer&campaignId=${encodeURIComponent(campaignId)}&limit=100&columns=offerId,offerName,offerUrl,visits,clicks,conversions,revenue,cost,impressions&include=ACTIVE,PAUSED`;
        
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

        // Fetch multi-period data for EPC trending
        const multiPeriodData = {};
        const periods = [
            { name: '7d', from: from7d, to: to7d },
            { name: '14d', from: from14d, to: to14d },
            { name: '30d', from: from30d, to: to30d }
        ];

        for (const period of periods) {
            try {
                const periodUrl = `https://api.voluum.com/report?from=${period.from}&to=${period.to}&groupBy=offer&campaignId=${encodeURIComponent(campaignId)}&limit=100&columns=offerId,offerName,visits,clicks,conversions,revenue,cost`;
                
                const periodResponse = await fetch(periodUrl, {
                    method: 'GET',
                    headers: {
                        'cwauth-token': sessionToken,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (periodResponse.ok) {
                    const periodData = await periodResponse.json();
                    multiPeriodData[period.name] = periodData.rows || [];
                    log(`${period.name} data: ${periodData.totalRows || 0} rows`);
                } else {
                    log(`${period.name} data fetch failed: ${periodResponse.status}`);
                    multiPeriodData[period.name] = [];
                }
            } catch (error) {
                log(`Error fetching ${period.name} data: ${error.message}`);
                multiPeriodData[period.name] = [];
            }
        }

        // Step 5: Process offer data with multi-period EPC trending
        const processedOffers = processOfferDataWithTrending(offerData, multiPeriodData, debugLogs);
        
        log(`Processing complete - ${processedOffers.length} offers processed`);

        // Only return offers that have had visits
        const offersWithVisits = processedOffers.filter(offer => offer.visits > 0);
        
        if (offersWithVisits.length === 0) {
            log('No offers found with visits');
            return res.status(200).json({
                success: false,
                error: 'No offers found with visits for this campaign',
                debug_logs: debugLogs
            });
        }

        return res.status(200).json({
            success: true,
            offers: offersWithVisits,
            debug_logs: debugLogs,
            debug_info: {
                campaign_id: campaignId,
                date_range: dateRange,
                total_offers: offersWithVisits.length,
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

function processOfferDataWithTrending(offerData, multiPeriodData, debugLogs) {
    debugLogs.push('Processing offer data with EPC trending...');
    
    const offers = [];
    const rows = offerData.rows || [];
    
    debugLogs.push(`Processing ${rows.length} offer rows`);
    
    // Create maps for multi-period data lookup
    const period7dMap = new Map();
    const period14dMap = new Map();
    const period30dMap = new Map();
    
    multiPeriodData['7d']?.forEach(row => {
        const id = row.offerId || row.offerName;
        if (id) period7dMap.set(id, row);
    });
    
    multiPeriodData['14d']?.forEach(row => {
        const id = row.offerId || row.offerName;
        if (id) period14dMap.set(id, row);
    });
    
    multiPeriodData['30d']?.forEach(row => {
        const id = row.offerId || row.offerName;
        if (id) period30dMap.set(id, row);
    });
    
    // Process each offer row
    rows.forEach((row, index) => {
        try {
            // Extract data directly from object properties
            const offerId = row.offerId || row.id || `offer_${index}`;
            const offerName = row.offerName || row.name || `Offer ${index + 1}`;
            const offerUrl = row.offerUrl || row.url || '';
            
            // Core metrics - ensure we get revenue/cost from Voluum
            const visits = parseFloat(row.visits || 0);
            const conversions = parseFloat(row.conversions || 0);
            const revenue = parseFloat(row.revenue || 0); // Voluum revenue
            const cost = parseFloat(row.cost || 0); // Voluum cost
            const clicks = parseFloat(row.clicks || 0);
            const impressions = parseFloat(row.impressions || 0);
            
            // Get multi-period data
            const data7d = period7dMap.get(offerId) || period7dMap.get(offerName) || {};
            const data14d = period14dMap.get(offerId) || period14dMap.get(offerName) || {};
            const data30d = period30dMap.get(offerId) || period30dMap.get(offerName) || {};
            
            // Calculate current period metrics
            const roas = cost > 0 ? revenue / cost : 0;
            const cpa = conversions > 0 ? cost / conversions : 0;
            const cvr = visits > 0 ? (conversions / visits) * 100 : 0;
            const epc = visits > 0 ? revenue / visits : 0;
            const payout = conversions > 0 ? revenue / conversions : 0;
            
            // Calculate multi-period EPC trending
            const visits7d = parseFloat(data7d.visits || 0);
            const revenue7d = parseFloat(data7d.revenue || 0);
            const epc_7d = visits7d > 0 ? revenue7d / visits7d : 0;
            
            const visits14d = parseFloat(data14d.visits || 0);
            const revenue14d = parseFloat(data14d.revenue || 0);
            const epc_14d = visits14d > 0 ? revenue14d / visits14d : 0;
            
            const visits30d = parseFloat(data30d.visits || 0);
            const revenue30d = parseFloat(data30d.revenue || 0);
            const epc_30d = visits30d > 0 ? revenue30d / visits30d : 0;
            
            const offer = {
                id: offerId,
                name: offerName,
                offerName: offerName,
                url: offerUrl,
                visits: visits,
                conversions: conversions,
                revenue: revenue, // From Voluum
                cost: cost, // From Voluum  
                clicks: clicks,
                impressions: impressions,
                roas: roas,
                cpa: cpa,
                cvr: cvr,
                epc: epc,
                epc_7d: epc_7d,
                epc_14d: epc_14d,
                epc_30d: epc_30d,
                payout: payout
            };
            
            offers.push(offer);
            
            // Log first few offers for debugging
            if (index < 3) {
                debugLogs.push(`Offer ${index + 1}: "${offer.name}" | Visits: ${offer.visits} | Revenue: ${offer.revenue} | Cost: ${offer.cost} | EPC: ${offer.epc.toFixed(3)} | EPC 7D: ${offer.epc_7d.toFixed(3)}`);
            }
            
        } catch (error) {
            debugLogs.push(`Error processing offer ${index}: ${error.message}`);
        }
    });
    
    debugLogs.push(`Final processing result: ${offers.length} offers processed with EPC trending`);
    
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
