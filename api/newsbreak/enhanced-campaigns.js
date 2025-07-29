// /api/newsbreak/enhanced-campaigns.js
// Enhanced implementation using full NewsBreak API access

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

        console.log(`[Enhanced NewsBreak API] Fetching comprehensive campaign data for ${startDate} to ${endDate}`);

        // Step 1: Get Campaign List with full details
        const campaigns = await getCampaignList(newsbreakKey);
        
        // Step 2: Get Ads for each campaign
        const campaignsWithAds = await enrichCampaignsWithAds(newsbreakKey, campaigns, campaignFilter);
        
        // Step 3: Get Performance Data via Integrated Report
        const performanceData = await getPerformanceData(newsbreakKey, startDate, endDate, campaignFilter);
        
        // Step 4: Merge and process all data
        const enrichedCampaigns = mergeCampaignData(campaignsWithAds, performanceData);
        
        // Step 5: Calculate summary statistics
        const summary = calculateEnhancedSummary(enrichedCampaigns);

        console.log(`[Enhanced NewsBreak API] Successfully processed ${enrichedCampaigns.length} campaigns with full creative data`);

        return res.status(200).json({
            success: true,
            campaigns: enrichedCampaigns,
            summary: summary,
            metadata: {
                dateRange: { startDate, endDate },
                totalCampaigns: campaigns.length,
                campaignsWithAds: campaignsWithAds.length,
                enrichedCampaigns: enrichedCampaigns.length,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[Enhanced NewsBreak API] Error:', error);
        
        return res.status(500).json({
            success: false,
            error: error.message,
            campaigns: [],
            summary: getEmptySummary()
        });
    }
}

// Get campaign list using NewsBreak API
async function getCampaignList(apiKey) {
    console.log('[NewsBreak API] Fetching campaign list...');
    
    const response = await fetch('https://business.newsbreak.com/business-api/v1/campaigns/getCampaignList', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Access-Token': apiKey
        },
        body: JSON.stringify({
            // Get all campaigns - can add filters if needed
            status: ['ACTIVE', 'PAUSED'], // Get both active and paused campaigns
            limit: 1000 // Increase limit to get all campaigns
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch campaign list: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[NewsBreak API] Retrieved ${data.data?.length || 0} campaigns`);
    
    return data.data || [];
}

// Enrich campaigns with their ads/creatives
async function enrichCampaignsWithAds(apiKey, campaigns, campaignFilter) {
    console.log('[NewsBreak API] Enriching campaigns with ad data...');
    
    const enrichedCampaigns = [];
    
    // Filter campaigns if specific campaign requested
    const targetCampaigns = campaignFilter 
        ? campaigns.filter(c => c.id === campaignFilter)
        : campaigns;

    for (const campaign of targetCampaigns) {
        try {
            // Get ads for this campaign
            const ads = await getAdList(apiKey, campaign.id);
            
            // Get ad sets for additional context
            const adSets = await getAdSetList(apiKey, campaign.id);
            
            const enrichedCampaign = {
                ...campaign,
                ads: ads,
                adSets: adSets,
                adCount: ads.length,
                activeAds: ads.filter(ad => ad.status === 'ACTIVE').length
            };
            
            enrichedCampaigns.push(enrichedCampaign);
            
        } catch (error) {
            console.error(`[NewsBreak API] Error enriching campaign ${campaign.id}:`, error);
            // Include campaign even if we can't get ads
            enrichedCampaigns.push({
                ...campaign,
                ads: [],
                adSets: [],
                adCount: 0,
                activeAds: 0
            });
        }
    }
    
    console.log(`[NewsBreak API] Enriched ${enrichedCampaigns.length} campaigns with creative data`);
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
            limit: 1000
        })
    });

    if (!response.ok) {
        console.warn(`[NewsBreak API] Failed to fetch ads for campaign ${campaignId}: ${response.status}`);
        return [];
    }

    const data = await response.json();
    return data.data || [];
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
            limit: 1000
        })
    });

    if (!response.ok) {
        console.warn(`[NewsBreak API] Failed to fetch ad sets for campaign ${campaignId}: ${response.status}`);
        return [];
    }

    const data = await response.json();
    return data.data || [];
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
            "AD_NAME",
            "ADSET_ID",
            "ADSET_NAME",
            "DATE"
        ],
        metrics: [
            "COST",
            "IMPRESSIONS", 
            "CLICKS",
            "CTR",
            "CONVERSIONS",
            "REVENUE",
            "CPA",
            "CVR"
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
    console.log(`[NewsBreak API] Retrieved performance data with ${data.data?.length || 0} rows`);
    
    return data;
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
                // Column-mapped format
                columns.forEach((column, index) => {
                    rowData[column] = row[index];
                });
            } else {
                // Direct object format
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
        
        // Aggregate performance data
        const aggregatedPerf = aggregatePerformanceData(performanceRows);
        
        // Extract creative information from ads
        const creativeData = extractCreativeData(campaign.ads || []);
        
        return {
            // Campaign metadata
            id: campaign.id,
            name: campaign.name || `Campaign ${campaign.id}`,
            campaignId: campaign.id,
            campaignName: campaign.name,
            status: campaign.status || 'UNKNOWN',
            
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
            
            // Metadata
            trafficSource: 'newsbreak',
            deviceType: 'All', // NewsBreak doesn't separate by device in campaign level
            geo: campaign.targetLocation || 'US',
            
            // Raw data for advanced analysis
            rawCampaignData: campaign,
            rawPerformanceData: performanceRows,
            
            // Additional insights
            adSets: campaign.adSets || [],
            ads: campaign.ads || []
        };
    });
    
    // Filter out campaigns with no data
    const validCampaigns = enrichedCampaigns.filter(campaign => 
        campaign.impressions > 0 || campaign.clicks > 0 || campaign.conversions > 0
    );
    
    console.log(`[NewsBreak API] Merged data for ${validCampaigns.length} campaigns with performance data`);
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
            primaryHeadline: 'No Creative Data',
            primaryDescription: '',
            primaryImageUrl: '',
            totalCreatives: 0
        };
    }
    
    // Get the first active ad or just the first ad
    const primaryAd = ads.find(ad => ad.status === 'ACTIVE') || ads[0];
    
    return {
        primaryHeadline: primaryAd.headline || primaryAd.title || primaryAd.name || 'Untitled Creative',
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

// Calculate enhanced summary with creative insights
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
        
        // Additional insights
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
