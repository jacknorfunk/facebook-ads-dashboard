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
            log('ERROR: Missing environment variables - returning mock data');
            const mockOffers = generateCampaignSpecificMockOffers(campaignId);
            return res.status(200).json({
                success: true,
                offers: mockOffers,
                mock_data: true,
                debug_logs: debugLogs,
                debug_info: {
                    reason: 'Missing Voluum API credentials',
                    campaign_id: campaignId,
                    offers_count: mockOffers.length
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
            
            const mockOffers = generateCampaignSpecificMockOffers(campaignId);
            return res.status(200).json({
                success: true,
                offers: mockOffers,
                mock_data: true,
                debug_logs: debugLogs,
                debug_info: {
                    reason: `Authentication failed: ${authResponse.status}`,
                    campaign_id: campaignId,
                    offers_count: mockOffers.length
                }
            });
        }

        const authData = await authResponse.json();
        const sessionToken = authData.token;
        
        if (!sessionToken) {
            log('ERROR: No token in auth response');
            const mockOffers = generateCampaignSpecificMockOffers(campaignId);
            return res.status(200).json({
                success: true,
                offers: mockOffers,
                mock_data: true,
                debug_logs: debugLogs,
                debug_info: {
                    reason: 'No session token received',
                    campaign_id: campaignId,
                    offers_count: mockOffers.length
                }
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
            const mockOffers = generateCampaignSpecificMockOffers(campaignId);
            return res.status(200).json({
                success: true,
                offers: mockOffers,
                mock_data: true,
                debug_logs: debugLogs,
                debug_info: {
                    reason: `Campaign verification failed: ${campaignResponse.status}`,
                    campaign_id: campaignId,
                    offers_count: mockOffers.length
                }
            });
        }

        const campaignData = await campaignResponse.json();
        log(`Campaign verification response: ${campaignData.totalRows || 0} campaigns found`);

        if (!campaignData.rows || campaignData.rows.length === 0) {
            log('Campaign not found or no data for date range');
            const mockOffers = generateCampaignSpecificMockOffers(campaignId);
            return res.status(200).json({
                success: true,
                offers: mockOffers,
                mock_data: true,
                debug_logs: debugLogs,
                debug_info: {
                    reason: 'Campaign not found or no data for selected date range',
                    campaign_id: campaignId,
                    offers_count: mockOffers.length
                }
            });
        }

        // Step 4: Fetch offer-level data for this specific campaign
        const offerReportUrl = `https://api.voluum.com/report?from=${fromDate}&to=${toDate}&groupBy=offer&campaignId=${encodeURIComponent(campaignId)}&limit=100&include=ACTIVE,PAUSED`;
        
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
            
            const mockOffers = generateCampaignSpecificMockOffers(campaignId);
            return res.status(200).json({
                success: true,
                offers: mockOffers,
                mock_data: true,
                debug_logs: debugLogs,
                debug_info: {
                    reason: `Offer report fetch failed: ${offerResponse.status}`,
                    campaign_id: campaignId,
                    offers_count: mockOffers.length
                }
            });
        }

        const offerData = await offerResponse.json();
        log(`Offer data received - Total rows: ${offerData.totalRows || 0}`);

        // Step 5: Process offer data
        const processedOffers = processOfferData(offerData, campaignData.rows[0], debugLogs);
        
        log(`Processing complete - ${processedOffers.length} offers processed`);

        // If no real offers found, provide campaign-specific mock data
        if (processedOffers.length === 0) {
            log('No real offers found - generating mock data');
            const mockOffers = generateCampaignSpecificMockOffers(campaignId);
            return res.status(200).json({
                success: true,
                offers: mockOffers,
                mock_data: true,
                debug_logs: debugLogs,
                debug_info: {
                    reason: 'No offers found for this campaign in selected date range',
                    campaign_id: campaignId,
                    offers_count: mockOffers.length
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
                raw_rows: offerData.totalRows || 0
            }
        });

    } catch (error) {
        log(`CRITICAL ERROR: ${error.message}`);
        log(`Error stack: ${error.stack}`);
        
        // Return mock data on any error
        const mockOffers = generateCampaignSpecificMockOffers(req.query.campaign_id || 'unknown');
        
        return res.status(200).json({
            success: true,
            offers: mockOffers,
            mock_data: true,
            debug_logs: debugLogs,
            debug_info: {
                reason: `Critical error: ${error.message}`,
                campaign_id: req.query.campaign_id || 'unknown',
                offers_count: mockOffers.length
            }
        });
    }
}

function processOfferData(offerData, campaignInfo, debugLogs) {
    debugLogs.push('Processing offer data...');
    
    const offers = [];
    const rows = offerData.rows || [];
    
    debugLogs.push(`Processing ${rows.length} offer rows`);
    
    // Process each offer row
    rows.forEach((row, index) => {
        try {
            // Extract data directly from object properties
            const offerId = row.offerId || row.id || `offer_${index}`;
            const offerName = row.offerName || row.name || `Offer ${index + 1}`;
            const offerUrl = row.offerUrl || row.url || '';
            
            // Core metrics - ensure we get revenue/cost from Voluum, not traffic source
            const visits = parseFloat(row.visits || 0);
            const conversions = parseFloat(row.conversions || 0);
            const revenue = parseFloat(row.revenue || 0); // Voluum revenue
            const cost = parseFloat(row.cost || 0); // Voluum cost
            const clicks = parseFloat(row.clicks || 0);
            const impressions = parseFloat(row.impressions || 0);
            
            // Calculate derived metrics
            const roas = cost > 0 ? revenue / cost : 0;
            const cpa = conversions > 0 ? cost / conversions : 0;
            const cvr = visits > 0 ? (conversions / visits) * 100 : 0;
            const epc = visits > 0 ? revenue / visits : 0;
            const payout = conversions > 0 ? revenue / conversions : 0;
            
            // Only include offers with some activity
            if (visits > 0 || conversions > 0 || revenue > 0 || cost > 0) {
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
                    payout: payout
                };
                
                offers.push(offer);
                
                // Log first few offers for debugging
                if (index < 3) {
                    debugLogs.push(`Offer ${index + 1}: "${offer.name}" | Visits: ${offer.visits} | Revenue: $${offer.revenue} | Cost: $${offer.cost} | ROAS: ${offer.roas.toFixed(2)}`);
                }
            }
            
        } catch (error) {
            debugLogs.push(`Error processing offer ${index}: ${error.message}`);
        }
    });
    
    debugLogs.push(`Final processing result: ${offers.length} active offers processed`);
    
    return offers;
}

function generateCampaignSpecificMockOffers(campaignId) {
    // Generate realistic offers based on campaign name/ID
    const campaignName = decodeURIComponent(campaignId || '');
    
    let mockOffers = [];
    
    if (campaignName.toLowerCase().includes('newsbreak')) {
        // NewsBreak-specific offers
        mockOffers = [
            {
                id: 'offer_nb_1',
                name: 'NewsBreak Native - Home Insurance Lead',
                offerName: 'NewsBreak Native - Home Insurance Lead',
                url: 'https://offers.newsbreak.com/insurance/home-lead',
                visits: 15420,
                conversions: 387,
                revenue: 4644.00, // Voluum revenue
                cost: 4201.50, // Voluum cost
                clicks: 14892,
                impressions: 45230,
                roas: 1.11,
                cpa: 10.86,
                cvr: 2.51,
                epc: 0.301,
                payout: 12.00
            },
            {
                id: 'offer_nb_2', 
                name: 'NewsBreak Display - Insurance Quote',
                offerName: 'NewsBreak Display - Insurance Quote',
                url: 'https://offers.newsbreak.com/insurance/quote',
                visits: 8920,
                conversions: 156,
                revenue: 2184.00,
                cost: 2456.30,
                clicks: 8445,
                impressions: 28450,
                roas: 0.89,
                cpa: 15.74,
                cvr: 1.75,
                epc: 0.245,
                payout: 14.00
            }
        ];
    } else if (campaignName.toLowerCase().includes('taboola')) {
        // Taboola-specific offers
        mockOffers = [
            {
                id: 'offer_tab_1',
                name: 'Taboola Native - Insurance CPA',
                offerName: 'Taboola Native - Insurance CPA',
                url: 'https://ads.taboola.com/insurance/cpa-offer',
                visits: 12350,
                conversions: 234,
                revenue: 3510.00,
                cost: 3892.45,
                clicks: 11890,
                impressions: 67890,
                roas: 0.90,
                cpa: 16.64,
                cvr: 1.89,
                epc: 0.284,
                payout: 15.00
            },
            {
                id: 'offer_tab_2',
                name: 'Taboola Content - Lead Generation', 
                offerName: 'Taboola Content - Lead Generation',
                url: 'https://ads.taboola.com/leadgen/form',
                visits: 6789,
                conversions: 89,
                revenue: 1335.00,
                cost: 1567.23,
                clicks: 6234,
                impressions: 34567,
                roas: 0.85,
                cpa: 17.61,
                cvr: 1.31,
                epc: 0.197,
                payout: 15.00
            }
        ];
    } else if (campaignName.toLowerCase().includes('facebook')) {
        // Facebook-specific offers
        mockOffers = [
            {
                id: 'offer_fb_1',
                name: 'Facebook Lead Ad - Medicare Supplement',
                offerName: 'Facebook Lead Ad - Medicare Supplement',
                url: 'https://facebook.com/tr/medicare-supplement',
                visits: 9870,
                conversions: 445,
                revenue: 6675.00,
                cost: 4321.15,
                clicks: 9456,
                impressions: 45670,
                roas: 1.54,
                cpa: 9.71,
                cvr: 4.51,
                epc: 0.676,
                payout: 15.00
            },
            {
                id: 'offer_fb_2',
                name: 'Facebook Video Ad - Insurance Quote',
                offerName: 'Facebook Video Ad - Insurance Quote', 
                url: 'https://facebook.com/tr/insurance-quote',
                visits: 5432,
                conversions: 178,
                revenue: 2492.00,
                cost: 2134.67,
                clicks: 5123,
                impressions: 23450,
                roas: 1.17,
                cpa: 11.99,
                cvr: 3.28,
                epc: 0.459,
                payout: 14.00
            }
        ];
    } else {
        // Generic offers for unknown campaigns
        mockOffers = [
            {
                id: 'offer_gen_1',
                name: 'Generic Offer - Insurance Lead',
                offerName: 'Generic Offer - Insurance Lead',
                url: 'https://example.com/insurance-lead',
                visits: 5000,
                conversions: 125,
                revenue: 1875.00,
                cost: 1750.00,
                clicks: 4750,
                impressions: 15000,
                roas: 1.07,
                cpa: 14.00,
                cvr: 2.50,
                epc: 0.375,
                payout: 15.00
            },
            {
                id: 'offer_gen_2',
                name: 'Generic Offer - Quote Form',
                offerName: 'Generic Offer - Quote Form',
                url: 'https://example.com/quote-form',
                visits: 3200,
                conversions: 64,
                revenue: 896.00,
                cost: 1024.00,
                clicks: 3100,
                impressions: 9600,
                roas: 0.88,
                cpa: 16.00,
                cvr: 2.00,
                epc: 0.280,
                payout: 14.00
            }
        ];
    }
    
    return mockOffers;
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
