// /api/voluum/campaigns-enhanced.js - Enhanced Voluum API with Multi-Period Analysis

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
        log('=== ENHANCED VOLUUM API WITH MULTI-PERIOD DATA ===');
        
        // Get parameters
        const dateRange = req.query.date_range || 'last_7_days';
        const campaignId = req.query.campaign_id; // For individual campaign details
        
        log(`Date range requested: ${dateRange}`);
        if (campaignId) log(`Specific campaign requested: ${campaignId}`);
        
        // Check environment variables
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;
        
        if (!accessId || !accessKey) {
            log('ERROR: Missing environment variables - using enhanced mock data');
            return res.status(200).json({
                success: false,
                error: 'Missing Voluum API credentials',
                debug_logs: debugLogs,
                data: getEnhancedMockDataWithPeriods()
            });
        }

        log(`Credentials found - AccessID: ${accessId.length} chars, AccessKey: ${accessKey.length} chars`);

        // Step 1: Authenticate with Voluum
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
                data: getEnhancedMockDataWithPeriods()
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
                data: getEnhancedMockDataWithPeriods()
            });
        }

        log('Authentication successful - proceeding with multi-period data fetch');

        // Step 2: Fetch multi-period campaign data
        const multiPeriodData = await fetchMultiPeriodData(sessionToken, dateRange, campaignId, log);
        
        // Step 3: Process and enhance the data
        const processedData = processMultiPeriodData(multiPeriodData, debugLogs);
        
        log(`Multi-period processing complete - ${processedData.campaigns.length} campaigns with enhanced analytics`);

        return res.status(200).json({
            success: true,
            data: processedData,
            debug_logs: debugLogs,
            metadata: {
                total_campaigns: processedData.campaigns.length,
                active_campaigns: processedData.overview.activeCampaigns,
                data_periods: ['current', '7d', '14d', '30d'],
                last_updated: new Date().toISOString()
            }
        });

    } catch (error) {
        log(`CRITICAL ERROR: ${error.message}`);
        log(`Error stack: ${error.stack}`);
        
        return res.status(500).json({
            success: false,
            error: error.message,
            debug_logs: debugLogs,
            data: getEnhancedMockDataWithPeriods()
        });
    }
}

async function fetchMultiPeriodData(sessionToken, dateRange, campaignId, log) {
    const periods = getMultipleDateRanges(dateRange);
    const multiPeriodData = {};
    
    log(`Fetching data for ${Object.keys(periods).length} time periods`);
    
    // Fetch data for each time period
    for (const [periodName, dateObj] of Object.entries(periods)) {
        try {
            log(`Fetching ${periodName} data: ${dateObj.fromDate} to ${dateObj.toDate}`);
            
            let reportUrl = `https://api.voluum.com/report?from=${dateObj.fromDate}&to=${dateObj.toDate}&groupBy=campaign&limit=1000`;
            
            // Add campaign filter if specific campaign requested
            if (campaignId) {
                reportUrl += `&filter=campaignId:${campaignId}`;
            }
            
            const reportResponse = await fetch(reportUrl, {
                method: 'GET',
                headers: {
                    'cwauth-token': sessionToken,
                    'Content-Type': 'application/json'
                }
            });

            if (!reportResponse.ok) {
                log(`WARNING: ${periodName} data fetch failed - Status: ${reportResponse.status}`);
                multiPeriodData[periodName] = { rows: [], totalRows: 0 };
                continue;
            }

            const reportData = await reportResponse.json();
            multiPeriodData[periodName] = reportData;
            
            log(`${periodName} data: ${reportData.totalRows || 0} campaigns received`);
            
            // If fetching offers for specific campaign, also get offer-level data
            if (campaignId) {
                const offersData = await fetchCampaignOffers(sessionToken, campaignId, dateObj, log);
                multiPeriodData[`${periodName}_offers`] = offersData;
            }
            
        } catch (error) {
            log(`ERROR fetching ${periodName} data: ${error.message}`);
            multiPeriodData[periodName] = { rows: [], totalRows: 0 };
        }
    }
    
    return multiPeriodData;
}

async function fetchCampaignOffers(sessionToken, campaignId, dateObj, log) {
    try {
        log(`Fetching offers for campaign ${campaignId} for period ${dateObj.fromDate} to ${dateObj.toDate}`);
        
        const offersUrl = `https://api.voluum.com/report?from=${dateObj.fromDate}&to=${dateObj.toDate}&groupBy=offer&filter=campaignId:${campaignId}&limit=100`;
        
        const offersResponse = await fetch(offersUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': sessionToken,
                'Content-Type': 'application/json'
            }
        });

        if (!offersResponse.ok) {
            log(`WARNING: Offers data fetch failed - Status: ${offersResponse.status}`);
            return { rows: [], totalRows: 0 };
        }

        const offersData = await offersResponse.json();
        log(`Offers data: ${offersData.totalRows || 0} offers received`);
        
        return offersData;
        
    } catch (error) {
        log(`ERROR fetching offers data: ${error.message}`);
        return { rows: [], totalRows: 0 };
    }
}

function processMultiPeriodData(multiPeriodData, debugLogs) {
    debugLogs.push('Processing multi-period campaign data...');
    
    const campaigns = [];
    const currentData = multiPeriodData.current || { rows: [] };
    const data7d = multiPeriodData.period_7d || { rows: [] };
    const data14d = multiPeriodData.period_14d || { rows: [] };
    const data30d = multiPeriodData.period_30d || { rows: [] };
    
    debugLogs.push(`Data periods available: Current(${currentData.rows.length}), 7D(${data7d.rows.length}), 14D(${data14d.rows.length}), 30D(${data30d.rows.length})`);
    
    // Create a map of campaigns by ID for easier lookup
    const campaignMap = new Map();
    
    // Process current period data (primary dataset)
    currentData.rows.forEach((row, index) => {
        try {
            const campaignId = row.campaignId || `camp_${index}`;
            const campaignName = row.campaignName || `Campaign ${index + 1}`;
            
            // Core metrics from current period
            const visits = parseFloat(row.visits || 0);
            const conversions = parseFloat(row.conversions || 0);
            const revenue = parseFloat(row.revenue || 0);
            const cost = parseFloat(row.cost || 0);
            const clicks = parseFloat(row.clicks || 0);
            
            // Calculate derived metrics
            const currentRoas = cost > 0 ? revenue / cost : 0;
            const currentCpa = conversions > 0 ? cost / conversions : 0;
            const currentCtr = visits > 0 ? (conversions / visits) * 100 : 0;
            
            const campaign = {
                id: campaignId,
                name: campaignName,
                trafficSource: extractTrafficSource(campaignName, row.trafficSourceName),
                
                // Current period metrics
                visits: visits,
                conversions: conversions,
                revenue: revenue,
                cost: cost,
                clicks: clicks,
                roas: currentRoas,
                cpa: currentCpa,
                ctr: currentCtr,
                
                // Multi-period metrics (will be filled from other periods)
                roas_7d: currentRoas,
                roas_14d: currentRoas,
                roas_30d: currentRoas,
                
                revenue_7d: revenue,
                revenue_14d: revenue,
                revenue_30d: revenue,
                
                conversions_7d: conversions,
                conversions_14d: conversions,
                conversions_30d: conversions,
                
                // Status and trends (calculated later)
                hasTraffic: visits > 0 || conversions > 0 || cost > 0 || revenue > 0,
                status: 'STABLE',
                trend_direction: 'stable',
                trend_percentage: 0,
                
                // Offers data (if available)
                offers: []
            };
            
            campaignMap.set(campaignId, campaign);
            
        } catch (error) {
            debugLogs.push(`Error processing current period row ${index}: ${error.message}`);
        }
    });
    
    // Enhance with 7-day data
    data7d.rows.forEach(row => {
        const campaignId = row.campaignId;
        if (campaignMap.has(campaignId)) {
            const campaign = campaignMap.get(campaignId);
            const revenue7d = parseFloat(row.revenue || 0);
            const cost7d = parseFloat(row.cost || 0);
            
            campaign.roas_7d = cost7d > 0 ? revenue7d / cost7d : 0;
            campaign.revenue_7d = revenue7d;
            campaign.conversions_7d = parseFloat(row.conversions || 0);
        }
    });
    
    // Enhance with 14-day data
    data14d.rows.forEach(row => {
        const campaignId = row.campaignId;
        if (campaignMap.has(campaignId)) {
            const campaign = campaignMap.get(campaignId);
            const revenue14d = parseFloat(row.revenue || 0);
            const cost14d = parseFloat(row.cost || 0);
            
            campaign.roas_14d = cost14d > 0 ? revenue14d / cost14d : 0;
            campaign.revenue_14d = revenue14d;
            campaign.conversions_14d = parseFloat(row.conversions || 0);
        }
    });
    
    // Enhance with 30-day data
    data30d.rows.forEach(row => {
        const campaignId = row.campaignId;
        if (campaignMap.has(campaignId)) {
            const campaign = campaignMap.get(campaignId);
            const revenue30d = parseFloat(row.revenue || 0);
            const cost30d = parseFloat(row.cost || 0);
            
            campaign.roas_30d = cost30d > 0 ? revenue30d / cost30d : 0;
            campaign.revenue_30d = revenue30d;
            campaign.conversions_30d = parseFloat(row.conversions || 0);
        }
    });
    
    // Calculate trends and status for each campaign
    campaignMap.forEach((campaign, campaignId) => {
        // Calculate trend (7D vs 30D comparison)
        if (campaign.roas_30d > 0) {
            campaign.trend_percentage = ((campaign.roas_7d - campaign.roas_30d) / campaign.roas_30d) * 100;
        } else {
            campaign.trend_percentage = 0;
        }
        
        // Determine trend direction
        if (campaign.trend_percentage >= 10) {
            campaign.trend_direction = 'up';
        } else if (campaign.trend_percentage <= -10) {
            campaign.trend_direction = 'down';
        } else {
            campaign.trend_direction = 'stable';
        }
        
        // Determine campaign status based on current performance
        if (campaign.hasTraffic) {
            if (campaign.roas >= 1.5) {
                campaign.status = 'UP';
            } else if (campaign.roas < 0.8 && campaign.cost > 50) {
                campaign.status = 'DOWN';
            } else {
                campaign.status = 'STABLE';
            }
        } else {
            campaign.status = 'PAUSED';
        }
        
        // Add offers data if available
        const offersCurrentData = multiPeriodData.current_offers;
        const offers7dData = multiPeriodData.period_7d_offers;
        const offers14dData = multiPeriodData.period_14d_offers;
        const offers30dData = multiPeriodData.period_30d_offers;
        
        if (offersCurrentData && offersCurrentData.rows) {
            campaign.offers = processOffersData(
                offersCurrentData.rows,
                offers7dData?.rows || [],
                offers14dData?.rows || [],
                offers30dData?.rows || []
            );
        }
        
        campaigns.push(campaign);
    });
    
    // Calculate enhanced overview statistics
    const activeCampaigns = campaigns.filter(c => c.hasTraffic);
    const trendingUp = campaigns.filter(c => c.trend_direction === 'up').length;
    const trendingDown = campaigns.filter(c => c.trend_direction === 'down').length;
    
    const overview = {
        liveCampaigns: campaigns.length,
        activeCampaigns: activeCampaigns.length,
        totalRevenue: campaigns.reduce((sum, c) => sum + c.revenue, 0),
        totalSpend: campaigns.reduce((sum, c) => sum + c.cost, 0),
        averageRoas: activeCampaigns.length > 0 ? 
            activeCampaigns.reduce((sum, c) => sum + c.roas, 0) / activeCampaigns.length : 0,
        totalConversions: campaigns.reduce((sum, c) => sum + c.conversions, 0),
        totalVisits: campaigns.reduce((sum, c) => sum + c.visits, 0),
        trendingUp: trendingUp,
        trendingDown: trendingDown,
        
        // Multi-period overview
        totalRevenue7d: campaigns.reduce((sum, c) => sum + c.revenue_7d, 0),
        totalRevenue14d: campaigns.reduce((sum, c) => sum + c.revenue_14d, 0),
        totalRevenue30d: campaigns.reduce((sum, c) => sum + c.revenue_30d, 0)
    };
    
    debugLogs.push(`Final processing: ${campaigns.length} campaigns with multi-period data`);
    debugLogs.push(`Active: ${overview.activeCampaigns}, Trending Up: ${overview.trendingUp}, Trending Down: ${overview.trendingDown}`);
    
    return {
        campaigns: campaigns,
        overview: overview,
        metadata: {
            totalRows: campaigns.length,
            dateRange: 'multi_period',
            lastUpdated: new Date().toISOString(),
            trafficSources: [...new Set(campaigns.map(c => c.trafficSource))],
            periods: ['current', '7d', '14d', '30d']
        }
    };
}

function processOffersData(currentOffers, offers7d, offers14d, offers30d) {
    const offersMap = new Map();
    
    // Process current offers
    currentOffers.forEach(offer => {
        const offerId = offer.offerId || offer.id;
        const offerName = offer.offerName || offer.name || 'Unknown Offer';
        
        const conversions = parseFloat(offer.conversions || 0);
        const revenue = parseFloat(offer.revenue || 0);
        const cost = parseFloat(offer.cost || 0);
        
        offersMap.set(offerId, {
            id: offerId,
            name: offerName,
            conversions: conversions,
            revenue: revenue,
            cost: cost,
            roas_current: cost > 0 ? revenue / cost : 0,
            roas_7d: cost > 0 ? revenue / cost : 0,
            roas_14d: cost > 0 ? revenue / cost : 0,
            roas_30d: cost > 0 ? revenue / cost : 0,
            status: conversions > 0 ? 'Active' : 'Paused'
        });
    });
    
    // Enhance with 7d data
    offers7d.forEach(offer => {
        const offerId = offer.offerId || offer.id;
        if (offersMap.has(offerId)) {
            const offerData = offersMap.get(offerId);
            const revenue7d = parseFloat(offer.revenue || 0);
            const cost7d = parseFloat(offer.cost || 0);
            offerData.roas_7d = cost7d > 0 ? revenue7d / cost7d : 0;
        }
    });
    
    // Enhance with 14d data
    offers14d.forEach(offer => {
        const offerId = offer.offerId || offer.id;
        if (offersMap.has(offerId)) {
            const offerData = offersMap.get(offerId);
            const revenue14d = parseFloat(offer.revenue || 0);
            const cost14d = parseFloat(offer.cost || 0);
            offerData.roas_14d = cost14d > 0 ? revenue14d / cost14d : 0;
        }
    });
    
    // Enhance with 30d data
    offers30d.forEach(offer => {
        const offerId = offer.offerId || offer.id;
        if (offersMap.has(offerId)) {
            const offerData = offersMap.get(offerId);
            const revenue30d = parseFloat(offer.revenue || 0);
            const cost30d = parseFloat(offer.cost || 0);
            offerData.roas_30d = cost30d > 0 ? revenue30d / cost30d : 0;
        }
    });
    
    // Calculate trends for each offer
    Array.from(offersMap.values()).forEach(offer => {
        if (offer.roas_30d > 0) {
            const trendPercentage = ((offer.roas_7d - offer.roas_30d) / offer.roas_30d) * 100;
            
            if (trendPercentage >= 10) {
                offer.trend_direction = 'up';
            } else if (trendPercentage <= -10) {
                offer.trend_direction = 'down';
            } else {
                offer.trend_direction = 'stable';
            }
        } else {
            offer.trend_direction = 'stable';
        }
    });
    
    return Array.from(offersMap.values());
}

function getMultipleDateRanges(baseRange) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return {
        current: getDateRange(baseRange),
        period_7d: getDateRange('last_7_days'),
        period_14d: getDateRange('last_14_days'),
        period_30d: getDateRange('last_30_days')
    };
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

function extractTrafficSource(campaignName, apiTrafficSource) {
    // Use API traffic source if available
    if (apiTrafficSource && apiTrafficSource !== 'Unknown') {
        return apiTrafficSource;
    }
    
    // Extract from campaign name
    const name = (campaignName || '').toLowerCase();
    
    if (name.includes('newsbreak')) return 'NewsBreak';
    if (name.includes('taboola')) return 'Taboola';
    if (name.includes('facebook') || name.includes('fb')) return 'Facebook';
    if (name.includes('google')) return 'Google';
    if (name.includes('evadav')) return 'EvaDav';
    if (name.includes('propellerads') || name.includes('propeller')) return 'PropellerAds';
    if (name.includes('richhads') || name.includes('richads')) return 'RichAds';
    if (name.includes('rollerads') || name.includes('roller')) return 'RollerAds';
    if (name.includes('pushnami')) return 'Pushnami';
    if (name.includes('outbrain')) return 'Outbrain';
    if (name.includes('mgid')) return 'MGID';
    if (name.includes('revcontent')) return 'Revcontent';
    if (name.includes('tiktok')) return 'TikTok';
    if (name.includes('pinterest')) return 'Pinterest';
    if (name.includes('yahoo')) return 'Yahoo';
    if (name.includes('zeropark')) return 'Zeropark';
    
    return 'Other';
}

function getEnhancedMockDataWithPeriods() {
    const mockCampaigns = [
        {
            id: 'camp_1',
            name: 'NewsBreak ROAS - Global - SENIORS - MOBILE',
            trafficSource: 'NewsBreak',
            visits: 124261,
            conversions: 1620,
            revenue: 25872.34,
            cost: 21169.71,
            roas: 1.22,
            roas_7d: 1.18,
            roas_14d: 1.15,
            roas_30d: 1.09,
            cpa: 13.07,
            status: 'UP',
            hasTraffic: true,
            trend_direction: 'up',
            trend_percentage: 8.3,
            offers: [
                {
                    id: 'offer_1',
                    name: 'Home Insurance - NewsBreak Seniors V1',
                    conversions: 820,
                    revenue: 13245.67,
                    roas_7d: 1.25,
                    roas_14d: 1.20,
                    roas_30d: 1.15,
                    trend_direction: 'up',
                    status: 'Active'
                },
                {
                    id: 'offer_2',
                    name: 'Auto Insurance - NewsBreak Seniors V2',
                    conversions: 545,
                    revenue: 8932.12,
                    roas_7d: 1.12,
                    roas_14d: 1.08,
                    roas_30d: 1.03,
                    trend_direction: 'up',
                    status: 'Active'
                }
            ]
        },
        {
            id: 'camp_2',
            name: 'Taboola - Global - 9 Dumb Ways - v2',
            trafficSource: 'Taboola',
            visits: 47407,
            conversions: 534,
            revenue: 8420.15,
            cost: 9156.23,
            roas: 0.92,
            roas_7d: 0.95,
            roas_14d: 0.88,
            roas_30d: 1.12,
            cpa: 17.15,
            status: 'DOWN',
            hasTraffic: true,
            trend_direction: 'down',
            trend_percentage: -15.2,
            offers: [
                {
                    id: 'offer_3',
                    name: 'Life Insurance - Taboola Native V1',
                    conversions: 334,
                    revenue: 5420.89,
                    roas_7d: 0.89,
                    roas_14d: 0.92,
                    roas_30d: 1.18,
                    trend_direction: 'down',
                    status: 'Active'
                }
            ]
        },
        {
            id: 'camp_3',
            name: 'Facebook - B1A1 - Global - Seniors - Mobile',
            trafficSource: 'Facebook',
            visits: 9396,
            conversions: 369,
            revenue: 7125.67,
            cost: 4892.33,
            roas: 1.46,
            roas_7d: 1.52,
            roas_14d: 1.43,
            roas_30d: 1.38,
            cpa: 13.26,
            status: 'UP',
            hasTraffic: true,
            trend_direction: 'up',
            trend_percentage: 10.1,
            offers: [
                {
                    id: 'offer_4',
                    name: 'Medicare Plans - Facebook Seniors V1',
                    conversions: 189,
                    revenue: 3567.23,
                    roas_7d: 1.58,
                    roas_14d: 1.47,
                    roas_30d: 1.41,
                    trend_direction: 'up',
                    status: 'Active'
                },
                {
                    id: 'offer_5',
                    name: 'Health Insurance - Facebook Seniors V2',
                    conversions: 180,
                    revenue: 3558.44,
                    roas_7d: 1.46,
                    roas_14d: 1.39,
                    roas_30d: 1.35,
                    trend_direction: 'up',
                    status: 'Active'
                }
            ]
        }
    ];

    return {
        campaigns: mockCampaigns,
        overview: {
            liveCampaigns: 513,
            activeCampaigns: 59,
            totalRevenue: 102738.48,
            totalSpend: 100226.24,
            averageRoas: 2.03,
            totalConversions: 8126,
            totalVisits: 181064,
            trendingUp: 23,
            trendingDown: 15,
            totalRevenue7d: 98234.56,
            totalRevenue14d: 195432.78,
            totalRevenue30d: 312567.89
        },
        metadata: {
            totalRows: 513,
            dateRange: 'enhanced_mock_multi_period',
            lastUpdated: new Date().toISOString(),
            trafficSources: ['NewsBreak', 'Taboola', 'Facebook', 'EvaDav', 'PropellerAds', 'RichAds', 'Outbrain'],
            periods: ['current', '7d', '14d', '30d']
        }
    };
}
