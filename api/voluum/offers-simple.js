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
            log('ERROR: Missing environment variables - returning realistic mock data');
            return res.status(200).json({
                success: true,
                offers: generateRealisticMockOffers(campaignId),
                mock_data: true,
                debug_logs: debugLogs,
                debug_info: {
                    reason: 'Missing API credentials',
                    campaign_id: campaignId,
                    offers_count: 'mock_generated'
                }
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
                success: true,
                offers: generateRealisticMockOffers(campaignId),
                mock_data: true,
                debug_logs: debugLogs,
                debug_info: {
                    reason: `Authentication failed: ${authResponse.status}`,
                    campaign_id: campaignId,
                    error_preview: authError.substring(0, 100)
                }
            });
        }

        const authData = await authResponse.json();
        const sessionToken = authData.token;
        
        if (!sessionToken) {
            log('ERROR: No token in auth response');
            return res.status(200).json({
                success: true,
                offers: generateRealisticMockOffers(campaignId),
                mock_data: true,
                debug_logs: debugLogs,
                debug_info: {
                    reason: 'No session token received',
                    campaign_id: campaignId
                }
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
            return res.status(200).json({
                success: true,
                offers: generateRealisticMockOffers(campaignId),
                mock_data: true,
                debug_logs: debugLogs,
                debug_info: {
                    reason: `Campaign verification failed: ${campaignVerifyResponse.status}`,
                    campaign_id: campaignId
                }
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
        
        log(`Processing complete - ${processedOffers.length} offers processed for campaign ${campaignId}`);

        // If no real offers found, generate realistic mock data
        if (processedOffers.length === 0) {
            log(`No real offers found for campaign ${campaignId}, generating realistic mock data`);
            return res.status(200).json({
                success: true,
                offers: generateRealisticMockOffers(campaignId),
                mock_data: true,
                debug_logs: debugLogs,
                debug_info: {
                    reason: 'No real offers found for this campaign',
                    campaign_id: campaignId,
                    periods_checked: Object.keys(multiPeriodOfferData),
                    rows_per_period: Object.fromEntries(
                        Object.entries(multiPeriodOfferData).map(([k, v]) => [k, v.length])
                    )
                }
            });
        }

        return res.status(200).json({
            success: true,
            offers: processedOffers,
            mock_data: false,
            debug_logs: debugLogs,
            debug_info: {
                campaign_id: campaignId,
                date_range: dateRange,
                total_offers: processedOffers.length,
                periods_analyzed: Object.keys(multiPeriodOfferData),
                real_data: true
            }
        });

    } catch (error) {
        log(`CRITICAL ERROR: ${error.message}`);
        log(`Error stack: ${error.stack}`);
        
        return res.status(200).json({
            success: true,
            offers: generateRealisticMockOffers(req.query.campaign_id || 'unknown'),
            mock_data: true,
            error: error.message,
            debug_logs: debugLogs,
            debug_info: {
                reason: `Critical error: ${error.message}`,
                campaign_id: req.query.campaign_id
            }
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
                has_traffic: visits > 0 || clicks > 0
            };
            
            offers.push(offer);
            
            // Log first few offers for debugging
            if (index < 3) {
                debugLogs.push(`Offer ${index + 1}: "${offer.name}" | EPC: $${offer.epc.toFixed(3)} | EPC 7D: $${offer.epc_7d.toFixed(3)} | Trend: ${offer.epc_trend_7d.toFixed(1)}% | ROAS: ${offer.roas.toFixed(2)}`);
            }
            
        } catch (error) {
            debugLogs.push(`Error processing offer ${index}: ${error.message}`);
        }
    });
    
    debugLogs.push(`Final processing result: ${offers.length} offers processed with multi-period trends`);
    
    return offers;
}

function generateRealisticMockOffers(campaignId) {
    // Generate realistic mock offers based on campaign name/type
    const campaignName = (campaignId || '').toLowerCase();
    
    // Determine offer types based on campaign
    let offerTypes = [];
    if (campaignName.includes('newsbreak')) {
        offerTypes = [
            'Auto - Home Insurance NewsBreak',
            'Seniors - Medicare NewsBreak', 
            'Native - Insurance NewsBreak',
            'NewsBreak - 9 Dumbest Things Smart People Waste Money On',
            'SENIORS - NATIVE - MOBILE - NEWSBREAK'
        ];
    } else if (campaignName.includes('taboola')) {
        offerTypes = [
            'Taboola - 9 Dumb Ways v2',
            'Taboola Native - Home Insurance',
            'Taboola - Seniors Pics',
            'Taboola - Medicare Guide'
        ];
    } else if (campaignName.includes('facebook')) {
        offerTypes = [
            'Facebook - Seniors - Mobile - B1A1',
            'Facebook - Dumbest Things New',
            'Facebook - Auto Insurance'
        ];
    } else {
        offerTypes = [
            'Generic Insurance Offer',
            'Medicare Lead Gen',
            'Auto Insurance Quote',
            'Home Insurance Lead'
        ];
    }
    
    const numOffers = Math.min(offerTypes.length, Math.floor(Math.random() * 4) + 3); // 3-6 offers
    const offers = [];
    
    for (let i = 0; i < numOffers; i++) {
        const offerName = offerTypes[i] || `Offer ${i + 1}`;
        
        // Generate realistic base metrics
        const baseClicks = Math.floor(Math.random() * 5000) + 100;
        const baseVisits = Math.floor(baseClicks * (0.8 + Math.random() * 0.4)); // 80-120% of clicks
        const baseConversions = Math.floor(baseVisits * (0.01 + Math.random() * 0.08)); // 1-9% CVR
        const basePayout = 8 + Math.random() * 15; // $8-23 payout
        const baseRevenue = baseConversions * basePayout;
        const baseCost = baseRevenue * (0.7 + Math.random() * 0.6); // Variable ROAS 0.7-1.3
        
        // Calculate current metrics
        const currentEpc = baseClicks > 0 ? baseRevenue / baseClicks : 0;
        const currentRoas = baseCost > 0 ? baseRevenue / baseCost : 0;
        const currentCvr = baseVisits > 0 ? (baseConversions / baseVisits) * 100 : 0;
        
        // Generate 7-day historical data (slightly different)
        const variance7d = 0.85 + Math.random() * 0.3; // ±15% variance
        const clicks7d = Math.floor(baseClicks * variance7d);
        const visits7d = Math.floor(baseVisits * variance7d);
        const conversions7d = Math.floor(baseConversions * variance7d);
        const revenue7d = conversions7d * basePayout * (0.95 + Math.random() * 0.1);
        const cost7d = revenue7d * (0.7 + Math.random() * 0.6);
        const epc7d = clicks7d > 0 ? revenue7d / clicks7d : 0;
        
        // Generate 14-day historical data
        const variance14d = 0.8 + Math.random() * 0.4; // ±20% variance
        const clicks14d = Math.floor(baseClicks * variance14d);
        const visits14d = Math.floor(baseVisits * variance14d);
        const conversions14d = Math.floor(baseConversions * variance14d);
        const revenue14d = conversions14d * basePayout * (0.9 + Math.random() * 0.2);
        const cost14d = revenue14d * (0.7 + Math.random() * 0.6);
        const epc14d = clicks14d > 0 ? revenue14d / clicks14d : 0;
        
        // Generate 30-day historical data
        const variance30d = 0.75 + Math.random() * 0.5; // ±25% variance
        const clicks30d = Math.floor(baseClicks * variance30d);
        const visits30d = Math.floor(baseVisits * variance30d);
        const conversions30d = Math.floor(baseConversions * variance30d);
        const revenue30d = conversions30d * basePayout * (0.85 + Math.random() * 0.3);
        const cost30d = revenue30d * (0.7 + Math.random() * 0.6);
        const epc30d = clicks30d > 0 ? revenue30d / clicks30d : 0;
        
        // Calculate trends
        const epcTrend7d = epc7d > 0 ? ((currentEpc - epc7d) / epc7d) * 100 : 0;
        const epcTrend14d = epc14d > 0 ? ((currentEpc - epc14d) / epc14d) * 100 : 0;
        const epcTrend30d = epc30d > 0 ? ((currentEpc - epc30d) / epc30d) * 100 : 0;
        
        offers.push({
            id: `mock_offer_${i + 1}`,
            name: offerName,
            offerName: offerName,
            url: `https://findbestusa.com/lp/${offerName.toLowerCase().replace(/[^a-z0-9]/g, '-')}/index.html`,
            
            // Current metrics
            visits: baseVisits,
            conversions: baseConversions,
            revenue: baseRevenue,
            cost: baseCost,
            clicks: baseClicks,
            impressions: Math.floor(baseClicks * (1.1 + Math.random() * 0.3)),
            roas: currentRoas,
            cpa: baseConversions > 0 ? baseCost / baseConversions : 0,
            cvr: currentCvr,
            epc: currentEpc,
            epc_visits: baseVisits > 0 ? baseRevenue / baseVisits : 0,
            payout: basePayout,
            
            // 7-day metrics
            visits_7d: visits7d,
            conversions_7d: conversions7d,
            revenue_7d: revenue7d,
            cost_7d: cost7d,
            clicks_7d: clicks7d,
            roas_7d: cost7d > 0 ? revenue7d / cost7d : 0,
            epc_7d: epc7d,
            cvr_7d: visits7d > 0 ? (conversions7d / visits7d) * 100 : 0,
            
            // 14-day metrics
            visits_14d: visits14d,
            conversions_14d: conversions14d,
            revenue_14d: revenue14d,
            cost_14d: cost14d,
            clicks_14d: clicks14d,
            roas_14d: cost14d > 0 ? revenue14d / cost14d : 0,
            epc_14d: epc14d,
            cvr_14d: visits14d > 0 ? (conversions14d / visits14d) * 100 : 0,
            
            // 30-day metrics
            visits_30d: visits30d,
            conversions_30d: conversions30d,
            revenue_30d: revenue30d,
            cost_30d: cost30d,
            clicks_30d: clicks30d,
            roas_30d: cost30d > 0 ? revenue30d / cost30d : 0,
            epc_30d: epc30d,
            cvr_30d: visits30d > 0 ? (conversions30d / visits30d) * 100 : 0,
            
            // Trends
            epc_trend_7d: epcTrend7d,
            epc_trend_14d: epcTrend14d,
            epc_trend_30d: epcTrend30d,
            
            // Flags
            is_trending_up: epcTrend7d > 10,
            is_trending_down: epcTrend7d < -10,
            is_profitable: currentRoas > 1.0,
            has_traffic: baseVisits > 0
        });
    }
    
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
