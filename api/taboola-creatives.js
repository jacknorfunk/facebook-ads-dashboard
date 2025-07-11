// api/taboola-creatives.js - Taboola Creative Performance Data
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { date_range = 'last_30d', campaign_id } = req.query;
    const ACCOUNT_ID = process.env.TABOOLA_ACCOUNT_ID;

    console.log('=== TABOOLA CREATIVES API CALLED ===');
    console.log('Date range:', date_range, 'Campaign ID:', campaign_id);

    // First, get OAuth token
    const authResponse = await fetch(`${req.headers.origin || 'https://facebook-ads-dashboard-git-main-jacks-projects-e0e84f4f.vercel.app'}/api/taboola-auth`);
    
    if (!authResponse.ok) {
      throw new Error('Failed to get Taboola auth token');
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    console.log('Got Taboola access token');

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch(date_range) {
      case 'yesterday':
        startDate.setDate(startDate.getDate() - 1);
        endDate.setDate(endDate.getDate() - 1);
        break;
      case 'last_7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last_30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'last_90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`Fetching Taboola creative data from ${startDateStr} to ${endDateStr}`);

    // Get creative performance from Taboola - by item breakdown
    const performanceUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/reports/campaign-summary/dimensions/item_breakdown`;
    
    const performanceParams = new URLSearchParams({
      start_date: startDateStr,
      end_date: endDateStr,
      format: 'json'
    });

    // Add campaign filter if specified
    if (campaign_id) {
      performanceParams.append('filter', `campaign_id=${campaign_id}`);
    }

    console.log('Requesting Taboola creative performance...');

    const performanceResponse = await fetch(`${performanceUrl}?${performanceParams}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!performanceResponse.ok) {
      const errorText = await performanceResponse.text();
      console.error('Taboola creative performance API error:', errorText);
      throw new Error(`Taboola API error: ${performanceResponse.status} - ${errorText}`);
    }

    const performanceData = await performanceResponse.json();
    console.log('Taboola creative performance data received:', performanceData.results?.length || 0, 'items');

    // Get campaign details for context
    const campaignsUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/campaigns`;
    
    const campaignsResponse = await fetch(campaignsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    let campaignsData = { results: [] };
    if (campaignsResponse.ok) {
      campaignsData = await campaignsResponse.json();
    }

    // Process and format creative data
    const creativeData = [];

    if (performanceData.results) {
      for (const item of performanceData.results) {
        try {
          // Find campaign details
          const campaignDetails = campaignsData.results?.find(c => c.id === item.campaign) || {};

          const spend = parseFloat(item.spent || 0);
          const impressions = parseInt(item.impressions || 0);
          const clicks = parseInt(item.clicks || 0);
          const conversions = parseInt(item.actions || 0); // Taboola uses 'actions' for conversions
          const revenue = parseFloat(item.conversions_value || 0);
          
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const cpc = clicks > 0 ? spend / clicks : 0;
          const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
          const cpa = conversions > 0 ? spend / conversions : 0;

          // Estimate hook rate based on CTR (Taboola doesn't have video metrics like Facebook)
          const hookRate = ctr * 8.5; // Estimation factor

          // Performance scoring (0-100)
          let performanceScore = 0;
          if (ctr >= 2) performanceScore += 30;
          else if (ctr >= 1) performanceScore += 15;
          
          if (cpc <= 0.5) performanceScore += 25; // Taboola typically has lower CPCs
          else if (cpc <= 1) performanceScore += 15;
          
          if (hookRate >= 20) performanceScore += 25;
          else if (hookRate >= 10) performanceScore += 15;
          
          if (conversions > 0) performanceScore += 20;

          // Generate insights
          const insights_recommendations = [];
          
          if (ctr < 0.5) {
            insights_recommendations.push({
              type: 'warning',
              message: 'Low CTR for Taboola - Consider more compelling headlines or thumbnails'
            });
          }
          
          if (cpc > 1.5) {
            insights_recommendations.push({
              type: 'error',
              message: 'High CPC - Creative may not be relevant to Taboola audience'
            });
          }
          
          if (conversions === 0 && spend > 20) {
            insights_recommendations.push({
              type: 'error',
              message: 'No conversions - Check landing page or tracking setup'
            });
          }
          
          if (performanceScore >= 70) {
            insights_recommendations.push({
              type: 'success',
              message: 'Strong Taboola performer - Consider scaling or creating similar content'
            });
          }

          // Determine creative type (Taboola is mostly image-based)
          const creativeType = 'image'; // Taboola primarily uses images, though video is possible

          creativeData.push({
            id: item.item || `${item.campaign}_${Date.now()}`,
            name: item.item_name || `Creative ${item.item}`,
            platform: 'taboola',
            campaign_id: item.campaign,
            campaign_name: campaignDetails.name || `Campaign ${item.campaign}`,
            creative_type: creativeType,
            status: 'ACTIVE', // Taboola doesn't provide individual item status in reports
            
            // Performance metrics
            spend,
            revenue,
            conversions,
            clicks,
            impressions,
            ctr,
            cpc,
            cpm,
            cpa,
            hook_rate: hookRate,
            performance_score: performanceScore,
            insights: insights_recommendations,
            
            // Taboola-specific data
            taboola_metrics: {
              item_id: item.item,
              campaign_id: item.campaign,
              actions: item.actions,
              conversions_value: item.conversions_value,
              visible_impressions: item.visible_impressions,
              viewability_rate: item.viewability_rate
            },

            // Video metrics (estimated/simulated since Taboola doesn't provide detailed video analytics)
            completion_rate: Math.min(100, hookRate * 0.4), // Simulated
            avg_watch_time: 0, // Not available in Taboola
            video_views: 0, // Not available in Taboola
            thru_plays: 0, // Not available in Taboola
            
            // Retention metrics (simulated)
            retention_25pct: Math.min(100, hookRate * 0.8),
            retention_50pct: Math.min(100, hookRate * 0.6),
            retention_75pct: Math.min(100, hookRate * 0.4),
            retention_100pct: Math.min(100, hookRate * 0.3),

            // Debug info
            debug_info: {
              raw_performance: item,
              raw_campaign: campaignDetails,
              platform: 'taboola'
            }
          });

        } catch (error) {
          console.error(`Error processing Taboola item ${item.item}:`, error.message);
        }
      }
    }

    // Sort by performance score descending
    creativeData.sort((a, b) => b.performance_score - a.performance_score);

    console.log('Taboola creative data summary:', {
      totalCreatives: creativeData.length,
      withConversions: creativeData.filter(c => c.conversions > 0).length,
      totalSpend: creativeData.reduce((sum, c) => sum + c.spend, 0),
      avgPerformanceScore: creativeData.length > 0 ? 
        creativeData.reduce((sum, c) => sum + c.performance_score, 0) / creativeData.length : 0
    });

    res.json(creativeData);

  } catch (error) {
    console.error('Error fetching Taboola creatives:', error);
    res.status(500).json({
      error: error.message,
      platform: 'taboola'
    });
  }
}
