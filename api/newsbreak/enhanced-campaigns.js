// /api/newsbreak/enhanced-campaigns.js
// Enhanced NewsBreak API that gets REAL data (no mock data)

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Access-Token');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const newsbreakKey = process.env.NEWSBREAK_KEY;
        
        if (!newsbreakKey) {
            return res.status(500).json({ 
                success: false, 
                error: 'NewsBreak API key not configured'
            });
        }

        // Get parameters
        const dateRange = req.query.date_range || 'last7days';
        const campaignFilter = req.query.campaign_id;
        const { startDate, endDate } = getDateRange(dateRange);

        console.log(`[Enhanced NewsBreak API] Fetching real campaign data for ${startDate} to ${endDate}`);

        // Step 1: Try to get campaign list using getCampaignList
        let campaigns = [];
        try {
            campaigns = await getCampaignList(newsbreakKey);
            console.log(`[NewsBreak API] Retrieved ${campaigns.length} campaigns from getCampaignList`);
        } catch (error) {
            console.log(`[NewsBreak API] getCampaignList failed: ${error.message}, trying getIntegratedReport`);
        }

        // Step 2: Get performance data via Integrated Report
        const performanceData = await getPerformanceData(newsbreakKey, startDate, endDate, campaignFilter);
        console.log(`[NewsBreak API] Retrieved performance data with ${performanceData.data?.length || 0} rows`);

        // Step 3: If we have campaign list, enrich with ads
        if (campaigns.length > 0) {
            const enrichedCampaigns = await enrichCampaignsWithAds(newsbreakKey, campaigns, campaignFilter);
            const finalCampaigns = mergeCampaignData(enrichedCampaigns, performanceData);
            
            if (finalCampaigns.length > 0) {
                const summary = calculateEnhancedSummary(finalCampaigns);
                return res.status(200).json({
                    success: true,
                    campaigns: finalCampaigns,
                    summary: summary,
                    source: 'enhanced_api_with_campaigns',
                    metadata: {
                        dateRange: { startDate, endDate },
                        totalCampaigns: campaigns.length,
                        enrichedCampaigns: finalCampaigns.length,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        }

        // Step 4: If no campaigns from list, use performance data directly
        if (performanceData.data && performanceData.data.length > 0) {
            const campaignsFromPerformance = processPerformanceDataOnly(performanceData);
            
            if (campaignsFromPerformance.length > 0) {
                const summary = calculateEnhancedSummary(campaignsFromPerformance);
                return res.status(200).json({
                    success: true,
                    campaigns: campaignsFromPerformance,
                    summary: summary,
                    source: 'performance_data_only',
                    metadata: {
                        dateRange: { startDate, endDate },
                        dataRows: performanceData.data.length,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        }

        // Step 5: If still no data, return empty result (NO MOCK DATA)
        console.log('[NewsBreak API] No real data available - returning empty result');
        return res.status(200).json({
            success: true,
            campaigns: [],
            summary: getEmptySummary(),
            source: 'no_data_available',
            message: 'No campaign data available for the selected date range. This may be because:\n1. No campaigns are running\n2. Date range has no data\n3. API permissions may be limited\n4. Contact your NewsBreak account manager',
            metadata: {
                dateRange: { startDate, endDate },
                timestamp: new Date().toISOString(),
                apiKeyLength: newsbreakKey.length,
                attemptedEndpoints: ['getCampaignList', 'getIntegratedReport']
            }
        });

    } catch (error) {
        console.error('[Enhanced NewsBreak API] Error:', error);
        
        return res.status(500).json({
            success: false,
            error: error.message,
            campaigns: [],
            summary: getEmptySummary(),
            source: 'api_error',
            debug: {
                timestamp: new Date().toISOString(),
                errorType: error.name,
                errorMessage: error.message
            }
        });
    }
}

// Get campaign list using NewsBreak API
async function getCampaignList(apiKey) {
    console.log('[NewsBreak API] Attempting getCampaignList...');
    
    const response = await fetch('https://business.newsbreak.com/business-api/v1/campaigns/getCampaignList', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Access-Token': apiKey
        },
        body: JSON.stringify({
            status: ['ACTIVE', 'PAUSED'],
            limit: 1000
        })
    });

    if (!response.ok) {
        throw new Error(`getCampaignList failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.code !== 0) {
        throw new Error(`getCampaignList API error: ${data.errMsg || 'Unknown error'}`);
    }

    return data.data || [];
}

// Enrich campaigns with their ads/creatives
async function enrichCampaignsWithAds(apiKey, campaigns, campaignFilter) {
    console.log('[NewsBreak API] Enriching campaigns with ad data...');
    
    const enrichedCampaigns = [];
    const targetCampaigns = campaignFilter 
        ? campaigns.filter(c => c.id === campaignFilter)
        : campaigns.slice(0, 20); // Limit to prevent timeout

    for (const campaign of targetCampaigns) {
        try {
            const ads = await getAdList(apiKey, campaign.id);
            const adSets = await getAdSetList(apiKey, campaign.id);
            
            enrichedCampaigns.push({
                ...campaign,
                ads: ads,
                adSets: adSets,
                adCount: ads.length,
                activeAds: ads.filter(ad => ad.status === 'ACTIVE').length
            });
            
        } catch (error) {
            console.error(`[NewsBreak API] Error enriching campaign ${campaign.id}:`, error);
            enrichedCampaigns.push({
                ...campaign,
                ads: [],
                adSets: [],
                adCount: 0,
                activeAds: 0
            });
        }
    }
    
    return enrichedCampaigns;
}

// Get ad list for a campaign
async function getAdList(apiKey, campaignId) {
    const response = await fetch('https://business.newsbreak.com/business-api/v1/ads/getAdList', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Access-Token': apiKey
        },
        body: JSON.stringify({
            campaignId: campaignId,
            limit: 100
        })
    });

    if (!response.ok) {
        return []; // Return empty array instead of throwing
    }

    const data = await response.json();
    return (data.code === 0) ? (data.data || []) : [];
}

// Get ad set list for a campaign
async function getAdSetList(apiKey, campaignId) {
    const response = await fetch('https://business.newsbreak.com/business-api/v1/adsets/getAdSetList', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Access-Token': apiKey
        },
        body: JSON.stringify({
            campaignId: campaignId,
            limit: 100
        })
    });

    if (!response.ok) {
        return [];
    }

    const data = await response.json();
    return (data.code === 0) ? (data.data || []) : [];
}

// Get performance data using integrated report
async function getPerformanceData(apiKey, startDate, endDate, campaignFilter) {
    console.log('[NewsBreak API] Fetching performance data...');
    
    const requestPayload = {
        name: `Enhanced Performance Report ${Date.now()}`,
        dateRange: "FIXED",
        startDate: startDate,
        endDate: endDate,
        filter: campaignFilter ? { campaignIds: [campaignFilter] } : null,
        filterIds: campaignFilter ? [campaignFilter] : [],
        dimensions: [
            "CAMPAIGN_ID",
            "CAMPAIGN_NAME",
            "AD_ID", 
            "AD_NAME"
        ],
        metrics: [
            "COST",
            "IMPRESSIONS",
            "CLICKS", 
            "CTR",
            "CONVERSIONS",
            "REVENUE"
        ],
        emails: [],
        editors: []
    };

    const response = await fetch('https://business.newsbreak.com/business-api/v1/reports/getIntegratedReport', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Access-Token': apiKey
        },
        body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
        console.warn(`[NewsBreak API] Performance data request failed: ${response.status}`);
        return { columns: [], data: [] };
    }

    const data = await response.json();
    
    if (data.code !== 0) {
        console.warn(`[NewsBreak API] Performance data API error: ${data.errMsg}`);
        return { columns: [], data: [] };
    }
    
    return data;
}

// Process performance data when no campaign list available
function processPerformanceDataOnly(performanceData) {
    console.log('[NewsBreak API] Processing performance data only...');
    
    const { columns, data: performanceRows } = performanceData;
    
    if (!performanceRows || performanceRows.length === 0) {
        return [];
    }

    // Group by campaign
    const campaignMap = new Map();
    
    performanceRows.forEach(row => {
        let rowData = {};
        if (columns && columns.length > 0) {
            columns.forEach((column, index) => {
                rowData[column] = row[index];
            });
        } else {
            rowData = row;
        }
        
        const campaignId = rowData.CAMPAIGN_ID || rowData.campaignId;
        const campaignName = rowData.CAMPAIGN_NAME || rowData.campaignName || `Campaign ${campaignId}`;
        
        if (campaignId) {
            if (!campaignMap.has(campaignId)) {
                campaignMap.set(campaignId, {
                    id: campaignId,
                    name: campaignName,
                    performanceRows: []
                });
            }
            campaignMap.get(campaignId).performanceRows.push(rowData);
        }
    });

    // Convert to campaign format
    const campaigns = Array.from(campaignMap.values()).map(campaign => {
        const aggregatedPerf = aggregatePerformanceData(campaign.performanceRows);
        
        return {
            id: campaign.id,
            name: campaign.name,
            campaignId: campaign.id,
            campaignName: campaign.name,
            status: 'ACTIVE',
            
            // Extract headline from ad data if available
            headline: extractHeadlineFromPerformanceData(campaign.performanceRows),
            description: '',
            imageUrl: '',
            creativeCount: campaign.performanceRows.length,
            
            // Performance metrics
            spend: aggregatedPerf.cost,
            revenue: aggregatedPerf.revenue,
            impressions: aggregatedPerf.impressions,
            clicks: aggregatedPerf.clicks,
            conversions: aggregatedPerf.conversions,
            ctr: aggregatedPerf.ctr,
            cpa: aggregatedPerf.cpa,
            roas: aggregatedPerf.roas,
            cvr: aggregatedPerf.cvr,
            
            trafficSource: 'newsbreak',
            deviceType: 'All',
            geo: 'US',
            
            rawPerformanceData: campaign.performanceRows
        };
    });

    // Filter out campaigns with no meaningful data
    return campaigns.filter(campaign => 
        campaign.impressions > 0 || campaign.clicks > 0 || campaign.spend > 0
    );
}

function extractHeadlineFromPerformanceData(performanceRows) {
    // Try to get headline from ad name
    for (const row of performanceRows) {
        const adName = row.AD_NAME || row.adName;
        if (adName && adName.length > 10) {
            return adName.length > 80 ? adName.substring(0, 80) + '...' : adName;
        }
    }
    
    // Fallback to campaign name
    const campaignName = performanceRows[0]?.CAMPAIGN_NAME || performanceRows[0]?.campaignName;
    if (campaignName) {
        return campaignName.length > 80 ? campaignName.substring(0, 80) + '...' : campaignName;
    }
    
    return 'NewsBreak Campaign';
}

// Merge campaign metadata with performance data
function mergeCampaignData(campaigns, performanceData) {
    console.log('[NewsBreak API] Merging campaign and performance data...');
    
    const { columns, data: performanceRows } = performanceData;
    
    // Create performance lookup by campaign ID
    const performanceLookup = new Map();
    
    if (columns && performanceRows) {
        performanceRows.forEach(row => {
            let rowData = {};
            if (columns.length > 0) {
                columns.forEach((column, index) => {
                    rowData[column] = row[index];
                });
            } else {
                rowData = row;
            }
            
            const campaignId = rowData.CAMPAIGN_ID || rowData.campaignId;
            if (campaignId) {
                if (!performanceLookup.has(campaignId)) {
                    performanceLookup.set(campaignId, []);
                }
                performanceLookup.get(campaignId).push(rowData);
            }
        });
    }
    
    // Merge data
    const enrichedCampaigns = campaigns.map(campaign => {
        const performanceRows = performanceLookup.get(campaign.id) || [];
        const aggregatedPerf = aggregatePerformanceData(performanceRows);
        const creativeData = extractCreativeData(campaign.ads || []);
        
        return {
            id: campaign.id,
            name: campaign.name || `Campaign ${campaign.id}`,
            campaignId: campaign.id,
            campaignName: campaign.name,
            status: campaign.status || 'ACTIVE',
            
            // Creative data
            headline: creativeData.primaryHeadline,
            description: creativeData.primaryDescription,
            imageUrl: creativeData.primaryImageUrl,
            creativeCount: creativeData.totalCreatives,
            
            // Performance metrics
            spend: aggregatedPerf.cost,
            revenue: aggregatedPerf.revenue,
            impressions: aggregatedPerf.impressions,
            clicks: aggregatedPerf.clicks,
            conversions: aggregatedPerf.conversions,
            ctr: aggregatedPerf.ctr,
            cpa: aggregatedPerf.cpa,
            roas: aggregatedPerf.roas,
            cvr: aggregatedPerf.cvr,
            
            trafficSource: 'newsbreak',
            deviceType: 'All',
            geo: campaign.targetLocation || 'US',
            
            rawCampaignData: campaign,
            rawPerformanceData: performanceRows,
            
            adSets: campaign.adSets || [],
            ads: campaign.ads || []
        };
    });
    
    // Filter out campaigns with no data
    const validCampaigns = enrichedCampaigns.filter(campaign => 
        campaign.impressions > 0 || campaign.clicks > 0 || campaign.conversions > 0 || campaign.spend > 0
    );
    
    return validCampaigns;
}

// Aggregate performance data for a campaign
function aggregatePerformanceData(performanceRows) {
    if (!performanceRows.length) {
        return {
            cost: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0,
            ctr: 0, cpa: 0, roas: 0, cvr: 0
        };
    }
    
    const totals = performanceRows.reduce((acc, row) => {
        acc.cost += parseFloat(row.COST || row.cost || 0);
        acc.revenue += parseFloat(row.REVENUE || row.revenue || 0);
        acc.impressions += parseInt(row.IMPRESSIONS || row.impressions || 0);
        acc.clicks += parseInt(row.CLICKS || row.clicks || 0);
        acc.conversions += parseInt(row.CONVERSIONS || row.conversions || 0);
        return acc;
    }, { cost: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0 });
    
    // Calculate derived metrics
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) : 0;
    const cpa = totals.conversions > 0 ? (totals.cost / totals.conversions) : 0;
    const roas = totals.cost > 0 ? (totals.revenue / totals.cost) : 0;
    const cvr = totals.clicks > 0 ? (totals.conversions / totals.clicks) : 0;
    
    return {
        ...totals,
        ctr,
        cpa,
        roas,
        cvr
    };
}

// Extract creative data from ads
function extractCreativeData(ads) {
    if (!ads.length) {
        return {
            primaryHeadline: 'No Creative Data Available',
            primaryDescription: '',
            primaryImageUrl: '',
            totalCreatives: 0
        };
    }
    
    const primaryAd = ads.find(ad => ad.status === 'ACTIVE') || ads[0];
    
    return {
        primaryHeadline: primaryAd.headline || primaryAd.title || primaryAd.name || 'NewsBreak Creative',
        primaryDescription: primaryAd.description || primaryAd.body || '',
        primaryImageUrl: primaryAd.imageUrl || primaryAd.image || '',
        totalCreatives: ads.length,
        allCreatives: ads.map(ad => ({
            id: ad.id,
            headline: ad.headline || ad.title || ad.name,
            description: ad.description || ad.body,
            imageUrl: ad.imageUrl || ad.image,
            status: ad.status
        }))
    };
}

// Calculate enhanced summary
function calculateEnhancedSummary(campaigns) {
    if (!campaigns.length) {
        return getEmptySummary();
    }
    
    const totals = campaigns.reduce((acc, campaign) => {
        acc.spend += campaign.spend || 0;
        acc.revenue += campaign.revenue || 0;
        acc.impressions += campaign.impressions || 0;
        acc.clicks += campaign.clicks || 0;
        acc.conversions += campaign.conversions || 0;
        acc.creativeCount += campaign.creativeCount || 0;
        return acc;
    }, {
        spend: 0, revenue: 0, impressions: 0, clicks: 0, conversions: 0, creativeCount: 0
    });
    
    const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length;
    const avgCTR = totals.impressions > 0 ? (totals.clicks / totals.impressions) : 0;
    const avgROAS = totals.spend > 0 ? (totals.revenue / totals.spend) : 0;
    
    return {
        totalCampaigns: campaigns.length,
        activeCampaigns: activeCampaigns,
        activeCreatives: totals.creativeCount,
        avgCTR: avgCTR,
        avgROAS: avgROAS,
        totalSpend: totals.spend,
        totalRevenue: totals.revenue,
        totalConversions: totals.conversions,
        totalImpressions: totals.impressions,
        totalClicks: totals.clicks,
        
        averageCreativesPerCampaign: campaigns.length > 0 ? (totals.creativeCount / campaigns.length) : 0,
        topPerformingCampaigns: campaigns
            .filter(c => c.roas > 0)
            .sort((a, b) => b.roas - a.roas)
            .slice(0, 5)
            .map(c => ({ id: c.id, name: c.name, roas: c.roas }))
    };
}

function getEmptySummary() {
    return {
        totalCampaigns: 0,
        activeCampaigns: 0,
        activeCreatives: 0,
        avgCTR: 0,
        avgROAS: 0,
        totalSpend: 0,
        totalRevenue: 0,
        totalConversions: 0,
        totalImpressions: 0,
        totalClicks: 0,
        averageCreativesPerCampaign: 0,
        topPerformingCampaigns: []
    };
}

// Helper function to get date range
function getDateRange(range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (range) {
        case 'today':
            return {
                startDate: formatDate(today),
                endDate: formatDate(today)
            };
        case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return {
                startDate: formatDate(yesterday),
                endDate: formatDate(yesterday)
            };
        case 'last7days':
            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            return {
                startDate: formatDate(weekAgo),
                endDate: formatDate(today)
            };
        case 'last30days':
            const monthAgo = new Date(today);
            monthAgo.setDate(monthAgo.getDate() - 30);
            return {
                startDate: formatDate(monthAgo),
                endDate: formatDate(today)
            };
        default:
            const defaultWeekAgo = new Date(today);
            defaultWeekAgo.setDate(defaultWeekAgo.getDate() - 7);
            return {
                startDate: formatDate(defaultWeekAgo),
                endDate: formatDate(today)
            };
    }
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}
