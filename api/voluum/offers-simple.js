// /api/voluum/offers-simple.js - Fixed Campaign-Specific Offers with Multi-Period Trends

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
        log('=== FIXED VOLUUM OFFERS API START ===');
        
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
            return res.status(400).json({
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
            return res.status(400).json({
                success: false,
                error: `Authentication failed: ${authResponse.status}`,
                debug_logs: debugLogs
            });
        }

        const authData = await authResponse.json();
        const sessionToken = authData.token;
        
        if (!sessionToken) {
            log('ERROR: No token in auth response');
            return res.status(400).json({
                success: false,
                error: 'No session token received',
                debug_logs: debugLogs
            });
        }

        log('Authentication successful - fetching campaign-specific offer data...');

        // Step 2: Verify campaign exists first
        const { fromDate, toDate } = getDateRange(dateRange);
        log(`Date range: ${fromDate} to ${toDate}`);
        
        // First, verify the campaign exists and get its actual ID
        const campaignVerifyUrl = `https://api.voluum.com/report?from=${fromDate}&to=${toDate}&groupBy=campaign&campaignId=${encodeURIComponent(campaignId)}&limit=1`;
        
        log(`Verifying campaign exists: ${campaignVerifyUrl}`);
        
        const campaignVerifyResponse = await fetch(campaignVerifyUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': sessionToken,
                'Content-Type': 'application/json'
            }
        });

        if (!campaignVerifyResponse.ok) {
            log(`Campaign verification failed: ${campaignVerifyResponse.status}`);
            return res.status(400).json({
                success: false,
                error: `Campaign verification failed: ${campaignVerifyResponse.status}`,
                debug_logs: debugLogs
            });
        }

        const campaignVerifyData = await campaignVerifyResponse.json();
        log(`Campaign verification - Total rows: ${campaignVerifyData.totalRows || 0}`);
        
        if (!campaignVerifyData.totalRows || campaignVerifyData.totalRows === 0) {
            log(`Campaign not found or has no data: ${campaignId}`);
            return res.status(200).json({
                success: true,
                offers: [],
                mock_data: false,
                debug_logs: debugLogs,
                debug_info: {
                    reason: 'Campaign not found or has no data',
                    campaign_id: campaignId,
                    total_rows: campaignVerifyData.totalRows
                }
            });
        }

        // Step 3: Fetch multi-period offer data for this specific campaign
        const periods = [
            { name: 'current', ...getDateRange(dateRange) },
            { name: '7d', ...getDateRange('last_7_days') },
            { name: '14d', ...getDateRange('last_14_days') },
            { name: '30d', ...getDateRange('last_30_days') }
        ];

        const multiPeriodOfferData = {};
        
        for (const period of periods) {
            try {
                // CRITICAL: Use campaignId filter to get offers for THIS CAMPAIGN ONLY
                const periodUrl = `https://api.voluum.com/report?from=${period.fromDate}&to=${period.toDate}&groupBy=offer&campaignId=${encodeURIComponent(campaignId)}&limit=1000&columns=offerId,offerName,offerUrl,visits,clicks,conversions,revenue,cost,impressions`;
                
                log(`Fetching ${period.name} offers: ${periodUrl}`);
                
                const periodResponse = await fetch(periodUrl, {
                    method: 'GET',
                    headers: {
                        'cwauth-token': sessionToken,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (periodResponse.ok) {
                    const periodData = await periodResponse.json();
                    multiPeriodOfferData[period.name] = periodData.rows || [];
                    log(`${period.name} data: ${periodData.totalRows || 0} offer rows for campaign ${campaignId}`);
                } else {
                    log(`${period.name} offer data fetch failed: ${periodResponse.status}`);
                    multiPeriodOfferData[period.name] = [];
                }
            } catch (error) {
                log(`Error fetching ${period.name} offer data: ${error.message}`);
                multiPeriodOfferData[period.name] = [];
            }
        }

        // Step 4: Process campaign-specific offer data with multi-period trends
        const processedOffers = processOfferDataWithTrends(multiPeriodOfferData, debugLogs, campaignId);
        
        // Step 5: Filter to ONLY include offers with traffic (visits > 0 OR conversions > 0)
        const offersWithTraffic = processedOffers.filter(offer => {
            const hasTraffic = (offer.visits > 0) || (offer.conversions > 0) || (offer.clicks > 0) || (offer.revenue > 0);
            return hasTraffic;
        });
        
        log(`Processing complete - ${processedOffers.length} total offers, ${offersWithTraffic.length} with traffic for campaign ${campaignId}`);

        // If no offers with traffic found, return empty array
        if (offersWithTraffic.length === 0) {
            log(`No offers with traffic found for campaign ${campaignId}`);
            return res.status(200).json({
                success: true,
                offers: [],
                debug_logs: debugLogs,
                debug_info: {
                    reason: 'No offers with traffic found for this campaign',
                    campaign_id: campaignId,
                    total_offers_found: processedOffers.length,
                    offers_with_traffic: offersWithTraffic.length,
                    periods_checked: Object.keys(multiPeriodOfferData),
                    traffic_filter_applied: true
                }
            });
        }

        return res.status(200).json({
            success: true,
            offers: offersWithTraffic,
            debug_logs: debugLogs,
            debug_info: {
                campaign_id: campaignId,
                date_range: dateRange,
                total_offers_found: processedOffers.length,
                offers_with_traffic: offersWithTraffic.length,
                offers_filtered_out: processedOffers.length - offersWithTraffic.length,
                periods_analyzed: Object.keys(multiPeriodOfferData),
                traffic_filter_applied: true
            }
        });

    } catch (error) {
        log(`CRITICAL ERROR: ${error.message}`);
        log(`Error stack: ${error.stack}`);
        
        return res.status(500).json({
            success: false,
            error: error.message,
            debug_logs: debugLogs
        });
    }
}

function processOfferDataWithTrends(multiPeriodData, debugLogs, campaignId) {
    debugLogs.push(`Processing offer data with trends for campaign: ${campaignId}`);
    
    const offers = [];
    const currentOffers = multiPeriodData.current || [];
    
    debugLogs.push(`Processing ${currentOffers.length} current offers`);
    
    // Create maps for multi-period data lookup by offer ID
    const period7dMap = new Map();
    const period14dMap = new Map();
    const period30dMap = new Map();
    
    (multiPeriodData['7d'] || []).forEach(row => {
        const id = row.offerId || row.offerName;
        if (id) period7dMap.set(id, row);
    });
    
    (multiPeriodData['14d'] || []).forEach(row => {
        const id = row.offerId || row.offerName;
        if (id) period14dMap.set(id, row);
    });
    
    (multiPeriodData['30d'] || []).forEach(row => {
        const id = row.offerId || row.offerName;
        if (id) period30dMap.set(id, row);
    });
    
    debugLogs.push(`Multi-period data: 7D=${period7dMap.size}, 14D=${period14dMap.size}, 30D=${period30dMap.size} offers`);
    
    // Process each current offer with multi-period trends
    currentOffers.forEach((row, index) => {
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
            
            // Get multi-period data for this specific offer
            const data7d = period7dMap.get(offerId) || period7dMap.get(offerName) || {};
            const data14d = period14dMap.get(offerId) || period14dMap.get(offerName) || {};
            const data30d = period30dMap.get(offerId) || period30dMap.get(offerName) || {};
            
            // Calculate current period metrics
            const roas = cost > 0 ? revenue / cost : 0;
            const cpa = conversions > 0 ? cost / conversions : 0;
            const cvr = visits > 0 ? (conversions / visits) * 100 : 0;
            const epc = clicks > 0 ? revenue / clicks : 0; // Earnings Per Click
            const epc_visits = visits > 0 ? revenue / visits : 0; // Alternative EPC based on visits
            
            // Calculate 7-day metrics
            const visits7d = parseFloat(data7d.visits || 0);
            const conversions7d = parseFloat(data7d.conversions || 0);
            const revenue7d = parseFloat(data7d.revenue || 0);
            const cost7d = parseFloat(data7d.cost || 0);
            const clicks7d = parseFloat(data7d.clicks || 0);
            
            const roas_7d = cost7d > 0 ? revenue7d / cost7d : 0;
            const epc_7d = clicks7d > 0 ? revenue7d / clicks7d : 0;
            const cvr_7d = visits7d > 0 ? (conversions7d / visits7d) * 100 : 0;
            
            // Calculate 14-day metrics
            const visits14d = parseFloat(data14d.visits || 0);
            const conversions14d = parseFloat(data14d.conversions || 0);
            const revenue14d = parseFloat(data14d.revenue || 0);
            const cost14d = parseFloat(data14d.cost || 0);
            const clicks14d = parseFloat(data14d.clicks || 0);
            
            const roas_14d = cost14d > 0 ? revenue14d / cost14d : 0;
            const epc_14d = clicks14d > 0 ? revenue14d / clicks14d : 0;
            const cvr_14d = visits14d > 0 ? (conversions14d / visits14d) * 100 : 0;
            
            // Calculate 30-day metrics
            const visits30d = parseFloat(data30d.visits || 0);
            const conversions30d = parseFloat(data30d.conversions || 0);
            const revenue30d = parseFloat(data30d.revenue || 0);
            const cost30d = parseFloat(data30d.cost || 0);
            const clicks30d = parseFloat(data30d.clicks || 0);
            
            const roas_30d = cost30d > 0 ? revenue30d / cost30d : 0;
            const epc_30d = clicks30d > 0 ? revenue30d / clicks30d : 0;
            const cvr_30d = visits30d > 0 ? (conversions30d / visits30d) * 100 : 0;
            
            // Calculate trend percentages
            const epc_trend_7d = epc_7d > 0 && epc > 0 ? ((epc - epc_7d) / epc_7d) * 100 : 0;
            const epc_trend_14d = epc_14d > 0 && epc > 0 ? ((epc - epc_14d) / epc_14d) * 100 : 0;
            const epc_trend_30d = epc_30d > 0 && epc > 0 ? ((epc - epc_30d) / epc_30d) * 100 : 0;
            
            const offer = {
                id: offerId,
                name: offerName,
                offerName: offerName,
                url: offerUrl,
                
                // Current period metrics
                visits: visits,
                conversions: conversions,
                revenue: revenue,
                cost: cost,
                clicks: clicks,
                impressions: impressions,
                roas: roas,
                cpa: cpa,
                cvr: cvr,
                epc: epc,
                epc_visits: epc_visits,
                payout: conversions > 0 ? revenue / conversions : 0,
                
                // 7-day metrics
                visits_7d: visits7d,
                conversions_7d: conversions7d,
                revenue_7d: revenue7d,
                cost_7d: cost7d,
                clicks_7d: clicks7d,
                roas_7d: roas_7d,
                epc_7d: epc_7d,
                cvr_7d: cvr_7d,
                
                // 14-day metrics  
                visits_14d: visits14d,
                conversions_14d: conversions14d,
                revenue_14d: revenue14d,
                cost_14d: cost14d,
                clicks_14d: clicks14d,
                roas_14d: roas_14d,
                epc_14d: epc_14d,
                cvr_14d: cvr_14d,
                
                // 30-day metrics
                visits_30d: visits30d,
                conversions_30d: conversions30d,
                revenue_30d: revenue30d,
                cost_30d: cost30d,
                clicks_30d: clicks30d,
                roas_30d: roas_30d,
                epc_30d: epc_30d,
                cvr_30d: cvr_30d,
                
                // Trend analysis
                epc_trend_7d: epc_trend_7d,
                epc_trend_14d: epc_trend_14d,
                epc_trend_30d: epc_trend_30d,
                
                // Performance flags
                is_trending_up: epc_trend_7d > 10,
                is_trending_down: epc_trend_7d < -10,
                is_profitable: roas > 1.0,
                has_traffic: visits > 0 || clicks > 0 || conversions > 0 || revenue > 0
            };
            
            // Only add offers that have some form of traffic/activity
            if (offer.has_traffic) {
                offers.push(offer);
                
                // Log first few offers for debugging
                if (offers.length <= 3) {
                    debugLogs.push(`Offer ${offers.length}: "${offer.name}" | EPC: ${offer.epc.toFixed(3)} | EPC 7D: ${offer.epc_7d.toFixed(3)} | Trend: ${offer.epc_trend_7d.toFixed(1)}% | ROAS: ${offer.roas.toFixed(2)} | Traffic: ${offer.has_traffic}`);
                }
            } else {
                debugLogs.push(`Filtered out offer "${offerName}" - no traffic (visits: ${visits}, clicks: ${clicks}, conversions: ${conversions}, revenue: ${revenue})`);
            }
            
        } catch (error) {
            debugLogs.push(`Error processing offer ${index}: ${error.message}`);
        }
    });
    
    debugLogs.push(`Final processing result: ${offers.length} offers with traffic processed (filtered from ${currentOffers.length} total offers)`);
    
    return offers;
}

// Remove the entire generateRealisticMockOffers function - we don't want any mock data

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
