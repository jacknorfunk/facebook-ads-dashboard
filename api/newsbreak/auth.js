// /api/newsbreak/auth.js
// Authentication endpoint for NewsBreak API
export default async function handler(req, res) {
    try {
        // Get API key from Vercel environment variables
        const newsbreakKey = process.env.newsbreak_key;
        
        if (!newsbreakKey) {
            return res.status(500).json({
                success: false,
                error: 'NewsBreak API key not found in environment variables'
            });
        }

        return res.json({
            success: true,
            apiKey: newsbreakKey
        });
    } catch (error) {
        console.error('NewsBreak auth error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// /api/newsbreak/campaigns.js
// Main campaigns endpoint with creative data
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const newsbreakKey = process.env.newsbreak_key;
        
        if (!newsbreakKey) {
            throw new Error('NewsBreak API key not found');
        }

        const { date_range = 'last7days', campaign_id, device_type, geo } = req.query;
        
        // Calculate date range
        const { startDate, endDate } = calculateDateRange(date_range);
        
        console.log('🔍 Fetching NewsBreak campaigns:', {
            dateRange: date_range,
            startDate,
            endDate,
            campaignId: campaign_id
        });

        // NewsBreak API request for campaigns
        const campaignParams = new URLSearchParams({
            start_date: startDate,
            end_date: endDate,
            ...(campaign_id && { campaign_id }),
            ...(device_type && { device_type }),
            ...(geo && { geo }),
            include_creatives: 'true',
            include_performance: 'true',
            limit: '1000'
        });

        const campaignResponse = await fetch(
            `https://business.newsbreak.com/business-api/v1/campaigns?${campaignParams}`,
            {
                headers: {
                    'Authorization': `Bearer ${newsbreakKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        if (!campaignResponse.ok) {
            const errorData = await campaignResponse.text();
            console.error('NewsBreak API error:', errorData);
            throw new Error(`NewsBreak API error: ${campaignResponse.status} - ${errorData}`);
        }

        const campaignData = await campaignResponse.json();
        console.log(`📊 Retrieved ${campaignData.data?.length || 0} campaigns from NewsBreak`);

        // Fetch detailed creative performance for each campaign
        const campaignsWithCreatives = await Promise.all(
            (campaignData.data || []).map(async (campaign) => {
                try {
                    const creativeData = await fetchCampaignCreatives(campaign.id, startDate, endDate, newsbreakKey);
                    return {
                        ...campaign,
                        creatives: creativeData
                    };
                } catch (error) {
                    console.error(`Error fetching creatives for campaign ${campaign.id}:`, error);
                    return {
                        ...campaign,
                        creatives: []
                    };
                }
            })
        );

        // Transform to our standard format
        const transformedData = transformNewsBreakData(campaignsWithCreatives);
        
        return res.json({
            success: true,
            campaigns: transformedData.campaigns,
            summary: transformedData.summary,
            debug_info: {
                source: 'newsbreak_api',
                date_range: date_range,
                start_date: startDate,
                end_date: endDate,
                total_campaigns: campaignsWithCreatives.length,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ NewsBreak campaigns API error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug_info: {
                error_stack: error.stack,
                timestamp: new Date().toISOString()
            }
        });
    }
}

async function fetchCampaignCreatives(campaignId, startDate, endDate, apiKey) {
    try {
        const creativeParams = new URLSearchParams({
            campaign_id: campaignId,
            start_date: startDate,
            end_date: endDate,
            include_performance: 'true',
            include_images: 'true'
        });

        const response = await fetch(
            `https://business.newsbreak.com/business-api/v1/creatives?${creativeParams}`,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            console.warn(`Creative fetch failed for campaign ${campaignId}: ${response.status}`);
            return [];
        }

        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error(`Creative fetch error for campaign ${campaignId}:`, error);
        return [];
    }
}

function transformNewsBreakData(campaigns) {
    const transformedCampaigns = [];
    let totalSpend = 0;
    let totalConversions = 0;
    let totalImpressions = 0;
    let totalClicks = 0;

    campaigns.forEach(campaign => {
        // Process each creative within the campaign
        (campaign.creatives || []).forEach(creative => {
            const metrics = creative.performance || campaign.performance || {};
            
            const transformedCreative = {
                id: creative.id || `${campaign.id}_creative`,
                name: creative.title || campaign.name,
                headline: creative.headline || creative.title || campaign.name,
                description: creative.description || creative.body || '',
                imageUrl: creative.image_url || creative.images?.[0]?.url || '',
                campaignId: campaign.id,
                campaignName: campaign.name,
                
                // Performance metrics
                spend: parseFloat(metrics.spend || 0),
                ctr: parseFloat(metrics.ctr || 0) / 100, // Convert percentage to decimal
                roas: parseFloat(metrics.roas || 0),
                cpa: parseFloat(metrics.cpa || 0),
                conversions: parseInt(metrics.conversions || 0),
                impressions: parseInt(metrics.impressions || 0),
                clicks: parseInt(metrics.clicks || 0),
                
                // Targeting info
                deviceType: campaign.targeting?.device_types?.[0] || 'Unknown',
                geo: campaign.targeting?.locations?.[0]?.name || 'Unknown',
                status: creative.status || campaign.status || 'Active',
                
                // Additional fields for analysis
                createdDate: creative.created_at || campaign.created_at,
                lastModified: creative.updated_at || campaign.updated_at
            };

            // Accumulate totals for summary
            totalSpend += transformedCreative.spend;
            totalConversions += transformedCreative.conversions;
            totalImpressions += transformedCreative.impressions;
            totalClicks += transformedCreative.clicks;

            transformedCampaigns.push(transformedCreative);
        });

        // If no creatives, add campaign-level data
        if (!campaign.creatives || campaign.creatives.length === 0) {
            const metrics = campaign.performance || {};
            
            const campaignAsCreative = {
                id: campaign.id,
                name: campaign.name,
                headline: campaign.name,
                description: campaign.description || '',
                imageUrl: '',
                campaignId: campaign.id,
                campaignName: campaign.name,
                
                spend: parseFloat(metrics.spend || 0),
                ctr: parseFloat(metrics.ctr || 0) / 100,
                roas: parseFloat(metrics.roas || 0),
                cpa: parseFloat(metrics.cpa || 0),
                conversions: parseInt(metrics.conversions || 0),
                impressions: parseInt(metrics.impressions || 0),
                clicks: parseInt(metrics.clicks || 0),
                
                deviceType: campaign.targeting?.device_types?.[0] || 'Unknown',
                geo: campaign.targeting?.locations?.[0]?.name || 'Unknown',
                status: campaign.status || 'Active',
                
                createdDate: campaign.created_at,
                lastModified: campaign.updated_at
            };

            totalSpend += campaignAsCreative.spend;
            totalConversions += campaignAsCreative.conversions;
            totalImpressions += campaignAsCreative.impressions;
            totalClicks += campaignAsCreative.clicks;

            transformedCampaigns.push(campaignAsCreative);
        }
    });

    // Calculate summary statistics
    const activeCreatives = transformedCampaigns.filter(c => c.status === 'Active').length;
    const avgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgROAS = totalSpend > 0 ? (totalConversions * avgRevPerConversion()) / totalSpend : 0;

    return {
        campaigns: transformedCampaigns,
        summary: {
            totalCampaigns: campaigns.length,
            activeCreatives: activeCreatives,
            avgCTR: avgCTR,
            avgROAS: avgROAS,
            totalSpend: totalSpend,
            totalConversions: totalConversions,
            totalImpressions: totalImpressions
        }
    };
}

function avgRevPerConversion() {
    // This should be configurable or fetched from NewsBreak
    // Default assumption for calculation purposes
    return 50; // $50 average revenue per conversion
}

function calculateDateRange(range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let startDate, endDate;
    
    switch (range) {
        case 'today':
            startDate = formatDate(today);
            endDate = formatDate(today);
            break;
        case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            startDate = formatDate(yesterday);
            endDate = formatDate(yesterday);
            break;
        case 'last7days':
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 7);
            startDate = formatDate(sevenDaysAgo);
            endDate = formatDate(today);
            break;
        case 'last30days':
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 30);
            startDate = formatDate(thirtyDaysAgo);
            endDate = formatDate(today);
            break;
        default:
            // Default to last 7 days
            const defaultStart = new Date(today);
            defaultStart.setDate(today.getDate() - 7);
            startDate = formatDate(defaultStart);
            endDate = formatDate(today);
    }
    
    return { startDate, endDate };
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// /api/newsbreak/test.js
// Test endpoint to verify API connectivity
export default async function handler(req, res) {
    try {
        const newsbreakKey = process.env.newsbreak_key;
        
        if (!newsbreakKey) {
            return res.status(500).json({
                success: false,
                error: 'NewsBreak API key not configured'
            });
        }

        // Test API connectivity
        const testResponse = await fetch(
            'https://business.newsbreak.com/business-api/v1/account',
            {
                headers: {
                    'Authorization': `Bearer ${newsbreakKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!testResponse.ok) {
            const errorText = await testResponse.text();
            return res.status(testResponse.status).json({
                success: false,
                error: `NewsBreak API test failed: ${testResponse.status} - ${errorText}`
            });
        }

        const accountData = await testResponse.json();
        
        return res.json({
            success: true,
            message: 'NewsBreak API connection successful',
            account: {
                id: accountData.id,
                name: accountData.name,
                status: accountData.status
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('NewsBreak test error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// /api/newsbreak/creative-analysis.js
// Advanced creative analysis endpoint
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { creativeId, imageUrl, headline, analysisType = 'full' } = req.body;
        
        if (!creativeId) {
            return res.status(400).json({
                success: false,
                error: 'Creative ID required'
            });
        }

        const analysisResults = {};

        // Image analysis if URL provided
        if (imageUrl && analysisType.includes('image')) {
            try {
                const imageAnalysis = await analyzeCreativeImage(imageUrl, headline);
                analysisResults.image = imageAnalysis;
            } catch (error) {
                console.error('Image analysis error:', error);
                analysisResults.image = { error: error.message };
            }
        }

        // Headline analysis
        if (headline && analysisType.includes('headline')) {
            try {
                const headlineAnalysis = await analyzeCreativeHeadline(headline);
                analysisResults.headline = headlineAnalysis;
            } catch (error) {
                console.error('Headline analysis error:', error);
                analysisResults.headline = { error: error.message };
            }
        }

        return res.json({
            success: true,
            creativeId,
            analysis: analysisResults,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Creative analysis error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

async function analyzeCreativeImage(imageUrl, headline) {
    // This would integrate with Claude API for image analysis
    // For now, return structured analysis based on common patterns
    
    const analysis = {
        visual_elements: [],
        emotional_tone: '',
        layout_assessment: '',
        text_overlay: false,
        color_scheme: '',
        face_detection: false,
        recommendations: []
    };

    // Add basic pattern detection
    if (headline.toLowerCase().includes('save') || headline.toLowerCase().includes('money')) {
        analysis.recommendations.push('Consider green color scheme to reinforce savings message');
    }
    
    if (headline.includes('?')) {
        analysis.recommendations.push('Use curious or concerned facial expression in image');
    }

    return analysis;
}

async function analyzeCreativeHeadline(headline) {
    const analysis = {
        length: headline.length,
        word_count: headline.split(' ').length,
        emotional_triggers: [],
        structural_elements: [],
        readability_score: 0,
        recommendations: []
    };

    // Detect emotional triggers
    const emotions = {
        fear: ['warning', 'danger', 'risk', 'avoid', 'mistake', 'problem'],
        greed: ['save', 'money', 'earn', 'profit', 'free', 'deal'],
        curiosity: ['secret', 'unknown', 'discover', 'reveal', 'hidden'],
        urgency: ['now', 'today', 'limited', 'hurry', 'quick', 'immediate']
    };

    Object.entries(emotions).forEach(([emotion, words]) => {
        if (words.some(word => headline.toLowerCase().includes(word))) {
            analysis.emotional_triggers.push(emotion);
        }
    });

    // Detect structural elements
    if (/\d+/.test(headline)) analysis.structural_elements.push('numbers');
    if (headline.includes('?')) analysis.structural_elements.push('question');
    if (headline.includes('!')) analysis.structural_elements.push('exclamation');
    if (headline.length > 50) analysis.structural_elements.push('long_form');

    // Basic readability (simplified)
    const avgWordsPerSentence = headline.split(/[.!?]/).length;
    analysis.readability_score = Math.max(0, 100 - (avgWordsPerSentence * 5) - (analysis.word_count * 2));

    // Generate recommendations
    if (analysis.length > 80) {
        analysis.recommendations.push('Consider shortening headline for better mobile display');
    }
    
    if (analysis.emotional_triggers.length === 0) {
        analysis.recommendations.push('Add emotional trigger words to increase engagement');
    }

    return analysis;
}
