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

        // Step 3: Fetch offer-level data for multiple periods
        const { fromDate, toDate } = getDateRange(dateRange);
        const { fromDate: prev7From, toDate: prev7To } = getDateRange('last_7_days');
        const { fromDate: prev14From, toDate: prev14To } = getDateRange('last_14_days');
        const { fromDate: prev30From, toDate: prev30To } = getDateRange('last_30_days');
        
        log(`Current period: ${fromDate} to ${toDate}`);
        log(`7D period: ${prev7From} to ${prev7To}`);
        log(`14D period: ${prev14From} to ${prev14To}`);
        log(`30D period: ${prev30From} to ${prev30To}`);

        // Fetch current period offer data
        const offerReportUrl = `https://api.voluum.com/report?from=${fromDate}&to=${toDate}&groupBy=offer&campaignId=${campaignId}&limit=1000&columns=offerId,offerName,offerUrl,visits,clicks,conversions,revenue,cost,impressions`;
        
        log(`Fetching current offers: ${offerReportUrl}`);
        
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

        // Fetch multi-period data for comparison
        const periods = [
            { name: '7d', from: prev7From, to: prev7To },
            { name: '14d', from: prev14From, to: prev14To },
            { name: '30d', from: prev30From, to: prev30To }
        ];

        const multiPeriodData = {};
        
        for (const period of periods) {
            try {
                const periodUrl = `https://api.voluum.com/report?from=${period.from}&to=${period.to}&groupBy=offer&campaignId=${campaignId}&limit=1000&columns=offerId,offerName,visits,clicks,conversions,revenue,cost`;
                
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

        // Step 4: Process offer data with multi-period information
        const processedOffers = processOfferDataWithPeriods(offerData, multiPeriodData, debugLogs);
        
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

function processOfferDataWithPeriods(offerData, multiPeriodData, debugLogs) {
    debugLogs.push('Processing offer data with multi-period analysis...');
    
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
    
    // Process each offer row with multi-period data
    rows.forEach((row, index) => {
        try {
            // Extract data directly from object properties
            const offerId = row.offerId || `offer_${index}`;
            const offerName = row.offerName || `Offer ${index + 1}`;
            const offerUrl = row.offerUrl || '';
            
            // Core metrics - current period
            const visits = parseFloat(row.visits || 0);
            const conversions = parseFloat(row.conversions || 0);
            const revenue = parseFloat(row.revenue || 0);
            const cost = parseFloat(row.cost || 0);
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
            
            // Calculate multi-period metrics
            const visits7d = parseFloat(data7d.visits || 0);
            const revenue7d = parseFloat(data7d.revenue || 0);
            const cost7d = parseFloat(data7d.cost || 0);
            const roas_7d = cost7d > 0 ? revenue7d / cost7d : 0;
            const epc_7d = visits7d > 0 ? revenue7d / visits7d : 0;
            
            const visits14d = parseFloat(data14d.visits || 0);
            const revenue14d = parseFloat(data14d.revenue || 0);
            const cost14d = parseFloat(data14d.cost || 0);
            const roas_14d = cost14d > 0 ? revenue14d / cost14d : 0;
            const epc_14d = visits14d > 0 ? revenue14d / visits14d : 0;
            
            const visits30d = parseFloat(data30d.visits || 0);
            const revenue30d = parseFloat(data30d.revenue || 0);
            const cost30d = parseFloat(data30d.cost || 0);
            const roas_30d = cost30d > 0 ? revenue30d / cost30d : 0;
            const epc_30d = visits30d > 0 ? revenue30d / visits30d : 0;
            
            const offer = {
                id: offerId,
                name: offerName,
                offerName: offerName,
                url: offerUrl,
                visits: visits,
                conversions: conversions,
                revenue: revenue,
                cost: cost,
                clicks: clicks,
                impressions: impressions,
                roas: roas,
                roas_7d: roas_7d,
                roas_14d: roas_14d,
                roas_30d: roas_30d,
                cpa: cpa,
                cvr: cvr,
                epc: epc,
                epc_7d: epc_7d,
                epc_14d: epc_14d,
                epc_30d: epc_30d,
                payout: conversions > 0 ? revenue / conversions : 0
            };
            
            offers.push(offer);
            
            // Log first few offers for debugging
            if (index < 3) {
                debugLogs.push(`Offer ${index + 1}: "${offer.name}" | Visits: ${offer.visits} | ROAS: ${offer.roas.toFixed(2)} | 7D ROAS: ${offer.roas_7d.toFixed(2)} | EPC: ${offer.epc.toFixed(3)}`);
            }
            
        } catch (error) {
            debugLogs.push(`Error processing offer ${index}: ${error.message}`);
        }
    });
    
    debugLogs.push(`Final processing result: ${offers.length} offers processed with multi-period data`);
    
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
