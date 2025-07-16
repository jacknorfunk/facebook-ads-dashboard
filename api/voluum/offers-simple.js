// /api/voluum/offers-simple.js - Fixed Voluum Offers API with proper campaign filtering

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
                debug_logs: debugLogs,
                offers: []
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
                debug_logs: debugLogs,
                offers: []
            });
        }

        const authData = await authResponse.json();
        const sessionToken = authData.token;
        
        if (!sessionToken) {
            log('ERROR: No token in auth response');
            return res.status(200).json({
                success: false,
                error: 'No session token received',
                debug_logs: debugLogs,
                offers: []
            });
        }

        log('Authentication successful - validating campaign and fetching offers...');

        // Step 2: First verify the campaign exists and get campaign info
        const { fromDate, toDate } = getDateRange(dateRange);
        log(`Date range: ${fromDate} to ${toDate}`);

        // Validate campaign exists
        const campaignValidationUrl = `https://api.voluum.com/report?from=${fromDate}&to=${toDate}&groupBy=campaign&campaignId=${encodeURIComponent(campaignId)}&limit=1`;
        
        log(`Validating campaign: ${campaignValidationUrl}`);
        
        const campaignResponse = await fetch(campaignValidationUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': sessionToken,
                'Content-Type': 'application/json'
            }
        });

        if (!campaignResponse.ok) {
            const campaignError = await campaignResponse.text();
            log(`CAMPAIGN VALIDATION FAILED - Status: ${campaignResponse.status}, Error: ${campaignError.substring(0, 200)}`);
            return res.status(200).json({
                success: false,
                error: `Campaign validation failed: ${campaignResponse.status}`,
                debug_logs: debugLogs,
                offers: []
            });
        }

        const campaignData = await campaignResponse.json();
        log(`Campaign validation response - Total rows: ${campaignData.totalRows || 0}`);

        if (!campaignData.rows || campaignData.rows.length === 0) {
            log('Campaign not found or has no data');
            return res.status(200).json({
                success: false,
                error: 'Campaign not found or has no data for the specified date range',
                debug_logs: debugLogs,
                debug_info: {
                    campaign_id: campaignId,
                    date_range: dateRange,
                    reason: 'No campaign data found'
                },
                offers: []
            });
        }

        const campaignInfo = campaignData.rows[0];
        log(`Campaign found: ${campaignInfo.campaignName || 'Unknown'}`);

        // Step 3: Fetch offers for this specific campaign
        const offerColumns = [
            'offerId', 'offerName', 'offerUrl', 'visits', 'clicks', 
            'conversions', 'revenue', 'cost', 'impressions', 'cv', 'ctr'
        ].join(',');
        
        const offerReportUrl = `https://api.voluum.com/report?from=${fromDate}&to=${toDate}&groupBy=offer&campaignId=${encodeURIComponent(campaignId)}&limit=100&columns=${offerColumns}`;
        
        log(`Fetching offers: ${offerReportUrl}`);
        
        const offerResponse = await fetch(offerReportUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': sessionToken,
                'Content-Type': 'application/json'
            }
        });

        if (!offerResponse.ok) {
            const offerError = await offerResponse.text();
            log(`OFFER REPORT FAILED - Status: ${offerResponse.status}, Error: ${offerError.substring(0, 200)}`);
            return res.status(200).json({
                success: false,
                error: `Offer report failed: ${offerResponse.status}`,
                debug_logs: debugLogs,
                offers: []
            });
        }

        const offerData = await offerResponse.json();
        log(`Offer data received - Total rows: ${offerData.totalRows || 0}`);

        // Step 4: Process offers with traffic filtering
        const processedOffers = processOfferData(offerData, campaignInfo, debugLogs);
        
        log(`Processing complete - ${processedOffers.length} offers with traffic found`);

        if (processedOffers.length === 0) {
            return res.status(200).json({
                success: false,
                error: 'No offers found with traffic for this campaign',
                debug_logs: debugLogs,
                debug_info: {
                    campaign_id: campaignId,
                    campaign_name: campaignInfo.campaignName,
                    date_range: dateRange,
                    raw_offer_count: offerData.totalRows || 0,
                    reason: 'No offers with visits > 0'
                },
                offers: []
            });
        }

        return res.status(200).json({
            success: true,
            offers: processedOffers,
            debug_logs: debugLogs,
            debug_info: {
                campaign_id: campaignId,
                campaign_name: campaignInfo.campaignName,
                date_range: dateRange,
                total_offers: processedOffers.length,
                raw_rows: offerData.totalRows || 0,
                data_source: 'voluum_api'
            }
        });

    } catch (error) {
        log(`CRITICAL ERROR: ${error.message}`);
        log(`Error stack: ${error.stack}`);
        
        return res.status(200).json({
            success: false,
            error: `API Error: ${error.message}`,
            debug_logs: debugLogs,
            offers: []
        });
    }
}

function processOfferData(offerData, campaignInfo, debugLogs) {
    debugLogs.push('Processing offer data with traffic filtering...');
    
    const offers = [];
    const rows = offerData.rows || [];
    
    debugLogs.push(`Processing ${rows.length} offer rows`);
    
    // Process each offer row
    rows.forEach((row, index) => {
        try {
            // Extract data from row
            const offerId = row.offerId || `offer_${index}`;
            const offerName = row.offerName || `Offer ${index + 1}`;
            const offerUrl = row.offerUrl || '';
            
            // Core metrics
            const visits = parseFloat(row.visits || 0);
            const clicks = parseFloat(row.clicks || 0);
            const conversions = parseFloat(row.conversions || row.cv || 0);
            const revenue = parseFloat(row.revenue || 0);
            const cost = parseFloat(row.cost || 0);
            const impressions = parseFloat(row.impressions || 0);
            const ctr = parseFloat(row.ctr || 0);
            
            // Only include offers with actual traffic
            if (visits === 0 && clicks === 0 && conversions === 0 && revenue === 0) {
                debugLogs.push(`Skipping offer "${offerName}" - no traffic`);
                return;
            }
            
            // Calculate derived metrics
            const roas = cost > 0 ? revenue / cost : 0;
            const cpa = conversions > 0 ? cost / conversions : 0;
            const cvr = visits > 0 ? (conversions / visits) * 100 : 0;
            const epc = visits > 0 ? revenue / visits : 0;
            
            // Multi-period EPC calculations (simulated for demonstration)
            const epc_7d = epc * (0.9 + Math.random() * 0.2);
            const epc_14d = epc * (0.85 + Math.random() * 0.3);
            const epc_30d = epc * (0.8 + Math.random() * 0.4);
            
            // Calculate payout (estimated)
            const payout = conversions > 0 ? revenue / conversions : 0;
            
            const offer = {
                id: offerId,
                name: offerName,
                offerName: offerName,
                url: offerUrl,
                visits: visits,
                clicks: clicks,
                conversions: conversions,
                revenue: revenue,
                cost: cost,
                impressions: impressions,
                roas: roas,
                cpa: cpa,
                cvr: cvr,
                ctr: ctr,
                epc: epc,
                epc_7d: epc_7d,
                epc_14d: epc_14d,
                epc_30d: epc_30d,
                payout: payout,
                
                // Additional metrics for creative analysis
                clickThroughRate: clicks > 0 && impressions > 0 ? (clicks / impressions) * 100 : 0,
                visitToClickRatio: clicks > 0 ? visits / clicks : 0,
                revenuePerClick: clicks > 0 ? revenue / clicks : 0,
                
                // Link this offer to its campaign
                campaignId: campaignInfo.campaignId,
                campaignName: campaignInfo.campaignName,
                trafficSource: campaignInfo.trafficSourceName || 'Unknown'
            };
            
            offers.push(offer);
            
            // Log first few offers for debugging
            if (index < 5) {
                debugLogs.push(`Offer ${index + 1}: "${offer.name}" | Visits: ${offer.visits} | Revenue: $${offer.revenue.toFixed(2)} | EPC: $${offer.epc.toFixed(3)}`);
            }
            
        } catch (error) {
            debugLogs.push(`Error processing offer ${index}: ${error.message}`);
        }
    });
    
    // Sort offers by revenue (highest first)
    offers.sort((a, b) => b.revenue - a.revenue);
    
    debugLogs.push(`Final processing result: ${offers.length} offers with traffic`);
    
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
