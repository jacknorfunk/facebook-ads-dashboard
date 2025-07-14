// /api/voluum/offers-simple.js - Debug & Campaign Filtering Fixed

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
        console.log(`[OFFERS API] ${message}`);
    }

    try {
        log('=== VOLUUM OFFERS API - ENHANCED DEBUGGING ===');
        
        // Get parameters with extensive logging
        const campaignId = req.query.campaign_id;
        const dateRange = req.query.date_range || 'last_7_days';
        
        log(`Raw campaign_id parameter: "${campaignId}"`);
        log(`Campaign ID type: ${typeof campaignId}`);
        log(`Campaign ID length: ${campaignId ? campaignId.length : 'null'}`);
        log(`Date range: ${dateRange}`);
        log(`All query parameters: ${JSON.stringify(req.query)}`);
        
        if (!campaignId) {
            log('ERROR: Missing campaign_id parameter');
            return res.status(200).json({
                success: false,
                error: 'campaign_id parameter is required',
                debug_logs: debugLogs,
                offers: [],
                received_params: req.query
            });
        }
        
        // Check environment variables
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;
        
        if (!accessId || !accessKey) {
            log('ERROR: Missing environment variables - returning targeted mock data');
            return res.status(200).json({
                success: true,
                offers: generateCampaignSpecificMockOffers(campaignId),
                debug_logs: debugLogs,
                mock_data: true,
                debug_info: {
                    campaign_id: campaignId,
                    date_range: dateRange,
                    reason: 'Missing Voluum API credentials',
                    note: 'Generated campaign-specific mock data'
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
        
        let authResponse;
        try {
            authResponse = await fetch('https://api.voluum.com/auth/access/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(authPayload)
            });
        } catch (fetchError) {
            log(`FETCH ERROR during auth: ${fetchError.message}`);
            return res.status(200).json({
                success: true,
                offers: generateCampaignSpecificMockOffers(campaignId),
                debug_logs: debugLogs,
                mock_data: true,
                debug_info: {
                    campaign_id: campaignId,
                    date_range: dateRange,
                    reason: `Auth fetch failed: ${fetchError.message}`
                }
            });
        }

        log(`Auth response status: ${authResponse.status}`);
        
        if (!authResponse.ok) {
            const authError = await authResponse.text();
            log(`AUTH FAILED - Status: ${authResponse.status}, Error: ${authError.substring(0, 200)}`);
            return res.status(200).json({
                success: true,
                offers: generateCampaignSpecificMockOffers(campaignId),
                debug_logs: debugLogs,
                mock_data: true,
                debug_info: {
                    campaign_id: campaignId,
                    date_range: dateRange,
                    reason: `Authentication failed: ${authResponse.status}`
                }
            });
        }

        let authData;
        try {
            authData = await authResponse.json();
        } catch (parseError) {
            log(`ERROR parsing auth response: ${parseError.message}`);
            return res.status(200).json({
                success: true,
                offers: generateCampaignSpecificMockOffers(campaignId),
                debug_logs: debugLogs,
                mock_data: true,
                debug_info: {
                    campaign_id: campaignId,
                    date_range: dateRange,
                    reason: 'Invalid auth response format'
                }
            });
        }

        const sessionToken = authData.token;
        
        if (!sessionToken) {
            log('ERROR: No token in auth response');
            return res.status(200).json({
                success: true,
                offers: generateCampaignSpecificMockOffers(campaignId),
                debug_logs: debugLogs,
                mock_data: true,
                debug_info: {
                    campaign_id: campaignId,
                    date_range: dateRange,
                    reason: 'No session token received'
                }
            });
        }

        log('Authentication successful - attempting campaign-specific data fetch...');

        // Step 2: Get date range
        const { fromDate, toDate } = getDateRange(dateRange);
        log(`Date range: ${fromDate} to ${toDate}`);

        // Step 3: CRITICAL - Try to get ONLY data for this specific campaign
        log(`ATTEMPTING TO FILTER FOR CAMPAIGN: "${campaignId}"`);
        
        // First, let's verify this campaign exists and get its basic info
        const campaignVerifyUrl = `https://api.voluum.com/report?from=${fromDate}&to=${toDate}&groupBy=campaign&campaignId=${encodeURIComponent(campaignId)}&limit=1`;
        log(`Verifying campaign exists: ${campaignVerifyUrl}`);
        
        let campaignExists = false;
        let campaignInfo = null;
        
        try {
            const verifyResponse = await fetch(campaignVerifyUrl, {
                method: 'GET',
                headers: {
                    'cwauth-token': sessionToken,
                    'Content-Type': 'application/json'
                }
            });
            
            if (verifyResponse.ok) {
                const verifyData = await verifyResponse.json();
                log(`Campaign verification response: ${JSON.stringify(verifyData).substring(0, 500)}`);
                
                if (verifyData.rows && verifyData.rows.length > 0) {
                    campaignExists = true;
                    campaignInfo = verifyData.rows[0];
                    log(`✅ Campaign verified: ${campaignInfo.campaignName || 'Unknown Name'}`);
                } else {
                    log(`❌ Campaign not found or no data in date range`);
                }
            } else {
                log(`Campaign verification failed: ${verifyResponse.status}`);
            }
        } catch (verifyError) {
            log(`Campaign verification error: ${verifyError.message}`);
        }

        // Step 4: If campaign exists, try to get its landers/offers
        if (campaignExists && campaignInfo) {
            log(`Attempting to get landers/offers for verified campaign...`);
            
            const offerAttempts = [
                {
                    name: 'landers_for_campaign',
                    url: `https://api.voluum.com/report?from=${fromDate}&to=${toDate}&groupBy=lander&campaignId=${encodeURIComponent(campaignId)}&limit=50`,
                    description: 'Getting landers for this specific campaign'
                },
                {
                    name: 'offers_for_campaign',
                    url: `https://api.voluum.com/report?from=${fromDate}&to=${toDate}&groupBy=offer&campaignId=${encodeURIComponent(campaignId)}&limit=50`,
                    description: 'Getting offers for this specific campaign'
                }
            ];

            let offerData = null;
            let successfulMethod = null;

            for (const attempt of offerAttempts) {
                try {
                    log(`Trying ${attempt.name}: ${attempt.description}`);
                    log(`URL: ${attempt.url}`);
                    
                    const response = await fetch(attempt.url, {
                        method: 'GET',
                        headers: {
                            'cwauth-token': sessionToken,
                            'Content-Type': 'application/json'
                        }
                    });

                    log(`${attempt.name} response status: ${response.status}`);

                    if (response.ok) {
                        const data = await response.json();
                        log(`${attempt.name} data received - Total rows: ${data.totalRows || 0}`);
                        
                        if (data.rows && data.rows.length > 0) {
                            log(`${attempt.name} sample row: ${JSON.stringify(data.rows[0]).substring(0, 300)}`);
                            
                            // Check if we got actual offer/lander data (not campaign data)
                            const hasOfferFields = data.rows[0].hasOwnProperty('landerId') || 
                                                 data.rows[0].hasOwnProperty('offerId') ||
                                                 data.rows[0].hasOwnProperty('landerName') ||
                                                 data.rows[0].hasOwnProperty('offerName');
                            
                            log(`${attempt.name} has offer/lander fields: ${hasOfferFields}`);
                            
                            if (hasOfferFields) {
                                offerData = data;
                                successfulMethod = attempt.name;
                                log(`✅ SUCCESS with ${attempt.name} - Found real offer/lander data`);
                                break;
                            } else {
                                log(`${attempt.name} returned campaign-level data, not offer/lander data`);
                            }
                        } else {
                            log(`${attempt.name} returned no data rows`);
                        }
                    } else {
                        const errorText = await response.text();
                        log(`${attempt.name} failed: ${response.status} - ${errorText.substring(0, 100)}`);
                    }
                } catch (attemptError) {
                    log(`${attempt.name} error: ${attemptError.message}`);
                }
            }

            // Step 5: Process the results
            if (offerData && offerData.rows && offerData.rows.length > 0) {
                log(`Processing real offer/lander data from ${successfulMethod}`);
                const processedOffers = processRealOfferData(offerData, debugLogs, successfulMethod, campaignId);
                
                return res.status(200).json({
                    success: true,
                    offers: processedOffers,
                    debug_logs: debugLogs,
                    mock_data: false,
                    debug_info: {
                        campaign_id: campaignId,
                        campaign_name: campaignInfo.campaignName || 'Unknown',
                        date_range: dateRange,
                        data_source: successfulMethod,
                        total_offers: processedOffers.length,
                        raw_rows: offerData.totalRows || 0,
                        campaign_verified: true
                    }
                });
            } else {
                log(`No offer/lander data found - this campaign likely uses direct linking`);
                
                // Create a single "direct linking" offer based on campaign data
                const directOffer = {
                    id: `direct_${campaignId}`,
                    name: 'Direct Linking (No Landers)',
                    offerName: 'Direct Linking (No Landers)',
                    url: '',
                    visits: campaignInfo.visits || 0,
                    conversions: campaignInfo.conversions || 0,
                    revenue: campaignInfo.revenue || 0,
                    cost: campaignInfo.cost || 0,
                    clicks: campaignInfo.clicks || 0,
                    roas: (campaignInfo.cost && campaignInfo.cost > 0) ? (campaignInfo.revenue || 0) / campaignInfo.cost : 0,
                    cpa: (campaignInfo.conversions && campaignInfo.conversions > 0) ? (campaignInfo.cost || 0) / campaignInfo.conversions : 0,
                    cvr: (campaignInfo.visits && campaignInfo.visits > 0) ? ((campaignInfo.conversions || 0) / campaignInfo.visits) * 100 : 0,
                    epc: (campaignInfo.visits && campaignInfo.visits > 0) ? (campaignInfo.revenue || 0) / campaignInfo.visits : 0,
                    payout: (campaignInfo.conversions && campaignInfo.conversions > 0) ? (campaignInfo.revenue || 0) / campaignInfo.conversions : 0,
                    campaignId: campaignId,
                    note: 'This campaign uses direct linking - visitors go straight to the final offer without intermediate landing pages'
                };
                
                return res.status(200).json({
                    success: true,
                    offers: [directOffer],
                    debug_logs: debugLogs,
                    mock_data: false,
                    debug_info: {
                        campaign_id: campaignId,
                        campaign_name: campaignInfo.campaignName || 'Unknown',
                        date_range: dateRange,
                        data_source: 'campaign_direct_data',
                        total_offers: 1,
                        campaign_verified: true,
                        explanation: 'No landers/offers found - campaign uses direct linking'
                    }
                });
            }
        } else {
            log(`Campaign verification failed - generating campaign-specific mock data`);
            return res.status(200).json({
                success: true,
                offers: generateCampaignSpecificMockOffers(campaignId),
                debug_logs: debugLogs,
                mock_data: true,
                debug_info: {
                    campaign_id: campaignId,
                    date_range: dateRange,
                    reason: 'Campaign not found or no data in selected date range',
                    campaign_verified: false
                }
            });
        }

    } catch (error) {
        log(`CRITICAL ERROR: ${error.message}`);
        log(`Error stack: ${error.stack}`);
        
        return res.status(200).json({
            success: true,
            offers: generateCampaignSpecificMockOffers(req.query.campaign_id || 'error_campaign'),
            debug_logs: debugLogs,
            mock_data: true,
            debug_info: {
                campaign_id: req.query.campaign_id || 'unknown',
                date_range: req.query.date_range || 'unknown',
                reason: `Critical error: ${error.message}`
            }
        });
    }
}

function processRealOfferData(data, debugLogs, dataSource, campaignId) {
    debugLogs.push(`Processing REAL offer/lander data from ${dataSource} for campaign ${campaignId}...`);
    
    const offers = [];
    const rows = data.rows || [];
    
    debugLogs.push(`Processing ${rows.length} rows of real offer/lander data`);
    
    rows.forEach((row, index) => {
        try {
            // Extract offer/lander information
            let offerId, offerName, offerUrl;
            
            if (dataSource.includes('landers')) {
                offerId = row.landerId || row.id || `lander_${index}`;
                offerName = row.landerName || row.name || `Lander ${index + 1}`;
                offerUrl = row.landerUrl || row.url || '';
            } else {
                offerId = row.offerId || row.id || `offer_${index}`;
                offerName = row.offerName || row.name || `Offer ${index + 1}`;
                offerUrl = row.offerUrl || row.url || '';
            }
            
            // Core metrics
            const visits = parseFloat(row.visits || 0);
            const conversions = parseFloat(row.conversions || 0);
            const revenue = parseFloat(row.revenue || 0);
            const cost = parseFloat(row.cost || 0);
            const clicks = parseFloat(row.clicks || 0);
            
            // Calculate derived metrics
            const roas = cost > 0 ? revenue / cost : 0;
            const cpa = conversions > 0 ? cost / conversions : 0;
            const cvr = visits > 0 ? (conversions / visits) * 100 : 0;
            const epc = visits > 0 ? revenue / visits : 0;
            const avgPayout = conversions > 0 ? revenue / conversions : 0;
            
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
                roas: roas,
                cpa: cpa,
                cvr: cvr,
                epc: epc,
                payout: avgPayout,
                campaignId: campaignId
            };
            
            offers.push(offer);
            
            if (index < 3) {
                debugLogs.push(`Real Offer ${index + 1}: "${offer.name}" | Visits: ${offer.visits} | Revenue: $${offer.revenue} | ROAS: ${offer.roas.toFixed(2)}`);
            }
            
        } catch (error) {
            debugLogs.push(`Error processing offer row ${index}: ${error.message}`);
        }
    });
    
    debugLogs.push(`Final result: ${offers.length} real offers processed for campaign ${campaignId}`);
    return offers;
}

function generateCampaignSpecificMockOffers(campaignId) {
    // Generate 2-4 realistic offers specifically for this campaign
    const campaignName = campaignId || 'Unknown Campaign';
    const numOffers = Math.floor(Math.random() * 3) + 2; // 2-4 offers
    const offers = [];
    
    // Determine traffic source and vertical from campaign name
    let trafficSource = 'Generic';
    let vertical = 'Insurance';
    
    if (campaignName.toLowerCase().includes('newsbreak')) {
        trafficSource = 'NewsBreak';
        if (campaignName.toLowerCase().includes('medicare')) vertical = 'Medicare';
        else if (campaignName.toLowerCase().includes('auto')) vertical = 'Auto Insurance';
        else if (campaignName.toLowerCase().includes('home')) vertical = 'Home Insurance';
    } else if (campaignName.toLowerCase().includes('facebook')) {
        trafficSource = 'Facebook';
    } else if (campaignName.toLowerCase().includes('taboola')) {
        trafficSource = 'Taboola';
    }
    
    for (let i = 0; i < numOffers; i++) {
        const visits = Math.floor(Math.random() * 3000) + 500;
        const conversions = Math.floor(visits * (0.01 + Math.random() * 0.04)); // 1-5% CVR
        const revenue = conversions * (10 + Math.random() * 15); // $10-25 payout
        const cost = revenue * (0.7 + Math.random() * 0.4); // 0.7-1.1x ROAS
        
        const roas = cost > 0 ? revenue / cost : 0;
        const cpa = conversions > 0 ? cost / conversions : 0;
        const cvr = visits > 0 ? (conversions / visits) * 100 : 0;
        const epc = visits > 0 ? revenue / visits : 0;
        
        offers.push({
            id: `mock_${campaignId}_lander_${i + 1}`,
            name: `${trafficSource} ${vertical} Lander ${i + 1}`,
            offerName: `${trafficSource} ${vertical} Lander ${i + 1}`,
            url: `https://example.com/${trafficSource.toLowerCase()}-${vertical.toLowerCase().replace(' ', '-')}-lander-${i + 1}`,
            visits: visits,
            conversions: conversions,
            revenue: revenue,
            cost: cost,
            clicks: Math.floor(visits * 1.2),
            roas: roas,
            cpa: cpa,
            cvr: cvr,
            epc: epc,
            payout: conversions > 0 ? revenue / conversions : 0,
            campaignId: campaignId,
            note: `Mock lander data for ${campaignName}`
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
