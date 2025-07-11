// api/taboola-creatives.js - Enhanced Taboola Creative Performance Data
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { date_preset = 'last_30d', campaign_id } = req.query;

    console.log('=== TABOOLA CREATIVES API CALLED ===');
    console.log('Date preset:', date_preset);
    console.log('Campaign ID filter:', campaign_id);

    // Check environment variables
    const CLIENT_ID = process.env.TABOOLA_CLIENT_ID;
    const CLIENT_SECRET = process.env.TABOOLA_CLIENT_SECRET;
    const ACCOUNT_ID = process.env.TABOOLA_ACCOUNT_ID;

    if (!CLIENT_ID || !CLIENT_SECRET || !ACCOUNT_ID) {
      console.error('Missing Taboola environment variables');
      return res.status(500).json({ 
        error: 'Taboola API credentials not configured',
        debug: {
          hasClientId: !!CLIENT_ID,
          hasClientSecret: !!CLIENT_SECRET,
          hasAccountId: !!ACCOUNT_ID
        }
      });
    }

    // Get access token
    const tokenResponse = await fetch('https://backstage.taboola.com/backstage/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      console.error('Taboola token error:', tokenError);
      return res.status(500).json({ 
        error: 'Failed to authenticate with Taboola',
        details: tokenError
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // First, get campaigns to map creative data
    let campaignsUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/campaigns/`;
    if (campaign_id) {
      campaignsUrl += `${campaign_id}/`;
    }

    const campaignsResponse = await fetch(campaignsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!campaignsResponse.ok) {
      const campaignError = await campaignsResponse.text();
      console.error('Taboola campaigns API error:', campaignError);
      return res.status(500).json({ 
        error: 'Failed to fetch Taboola campaigns',
        details: campaignError
      });
    }

    const campaignData = await campaignsResponse.json();
    const campaigns = Array.isArray(campaignData.results) ? campaignData.results : 
                     campaignData.id ? [campaignData] : [];

    console.log(`Found ${campaigns.length} Taboola campaigns`);

    // Now get creatives for each campaign
    const allCreatives = [];

    for (const campaign of campaigns.slice(0, 10)) { // Limit to prevent timeout
      try {
        // Get campaign items (creatives)
        const itemsUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/campaigns/${campaign.id}/items/`;
        
        const itemsResponse = await fetch(itemsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!itemsResponse.ok) {
          console.error(`Failed to fetch items for campaign ${campaign.id}:`, itemsResponse.status);
          continue;
        }

        const itemsData = await itemsResponse.json();
        const items = Array.isArray(itemsData.results) ? itemsData.results : [];

        console.log(`Campaign ${campaign.id}: ${items.length} items found`);

        // Get performance data for this campaign
        const performanceUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/reports/campaign-summary/dimensions/campaign_breakdown`;
        
        const startDate = getDateForPreset(date_preset).start;
        const endDate = getDateForPreset(date_preset).end;

        const performanceResponse = await fetch(performanceUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            start_date: startDate,
            end_date: endDate,
            campaign: campaign.id,
            dimensions: ["campaign_breakdown"],
            filters: [
              {
                "field": "campaign",
                "operator": "IN",
                "values": [campaign.id]
              }
            ]
          })
        });

        let performanceData = {};
        if (performanceResponse.ok) {
          const perfData = await performanceResponse.json();
          if (perfData.results && perfData.results.length > 0) {
            performanceData = perfData.results[0];
          }
        }

        // Process each creative item
        items.forEach((item, index) => {
          if (index >= 20) return; // Limit creatives per campaign

          // Calculate performance metrics
          const impressions = parseInt(performanceData.impressions) || 0;
          const clicks = parseInt(performanceData.clicks) || 0;
          const spend = parseFloat(performanceData.spent) || 0;
          const conversions = parseInt(performanceData.actions_num) || 0;
          const revenue = parseFloat(performanceData.conversions_value) || 0;

          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const cpc = clicks > 0 ? spend / clicks : 0;
          const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
          const cpa = conversions > 0 ? spend / conversions : 0;
          const roas = revenue > 0 ? revenue / spend : 0;

          // Calculate performance score
          const performanceScore = Math.min(100, Math.max(0,
            (ctr * 15) + // CTR weight
            (conversions * 10) + // Conversion weight
            (roas > 1 ? roas * 20 : 0) + // ROAS weight
            (clicks > 10 ? 20 : clicks * 2) // Click volume weight
          ));

          // Determine creative type
          const creativeType = item.thumbnail_url || item.url?.includes('video') ? 'video' : 'image';

          // Generate insights based on performance
          const insights = [];
          if (performanceScore >= 70) {
            insights.push({
              type: 'success',
              message: 'Strong performer - Consider scaling or using as creative template'
            });
          } else if (performanceScore < 30) {
            insights.push({
              type: 'warning',
              message: 'Low performance - Consider pausing or optimizing'
            });
          }

          if (ctr >= 1.5) {
            insights.push({
              type: 'success',
              message: 'High CTR indicates strong hook and targeting'
            });
          }

          if (conversions === 0 && spend > 50) {
            insights.push({
              type: 'warning',
              message: 'No conversions with significant spend - check conversion tracking'
            });
          }

          allCreatives.push({
            id: `taboola_${campaign.id}_${item.id}`,
            name: item.content?.description || item.content?.title || `Taboola Creative ${index + 1}`,
            status: item.is_active ? 'ACTIVE' : 'PAUSED',
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            creative_type: creativeType,
            
            // Creative content
            image_url: item.thumbnail_url || item.content?.thumbnail_url,
            video_id: item.content?.video_id || null,
            title: item.content?.title || '',
            body: item.content?.description || '',
            call_to_action: item.content?.call_to_action || 'LEARN_MORE',
            url: item.url,

            // Performance metrics
            spend: spend / items.length, // Distribute campaign spend across items
            impressions: Math.round(impressions / items.length),
            clicks: Math.round(clicks / items.length),
            ctr,
            cpc,
            cpm,
            conversions: Math.round(conversions / items.length),
            revenue: revenue / items.length,
            cpa,
            roas,

            // Video specific metrics (estimated)
            hook_rate: creativeType === 'video' ? Math.min(20, ctr * 2) : 0,
            completion_rate: creativeType === 'video' ? Math.min(100, ctr * 15) : 0,
            avg_watch_time: creativeType === 'video' ? Math.round(3 + (ctr * 2)) : 0,
            video_views: creativeType === 'video' ? Math.round(clicks * 0.8) : 0,
            thru_plays: creativeType === 'video' ? Math.round(clicks * 0.3) : 0,

            // Performance analysis
            performance_score: performanceScore,
            insights,

            // Platform identifier
            platform: 'Taboola',

            // Debug info
            debug_info: {
              campaign_performance: performanceData,
              item_data: item,
              calculated_metrics: {
                ctr_calculation: `${clicks}/${impressions} = ${ctr.toFixed(2)}%`,
                performance_score_factors: {
                  ctr_contribution: ctr * 15,
                  conversion_contribution: conversions * 10,
                  roas_contribution: roas > 1 ? roas * 20 : 0,
                  click_contribution: clicks > 10 ? 20 : clicks * 2
                }
              }
            }
          });
        });

      } catch (campaignError) {
        console.error(`Error processing campaign ${campaign.id}:`, campaignError.message);
      }
    }

    // Sort by performance score
    allCreatives.sort((a, b) => b.performance_score - a.performance_score);

    console.log(`=== TABOOLA CREATIVES RESULT ===`);
    console.log(`Total creatives processed: ${allCreatives.length}`);
    console.log(`Performance scores range: ${allCreatives[0]?.performance_score || 0} - ${allCreatives[allCreatives.length - 1]?.performance_score || 0}`);

    res.json(allCreatives);

  } catch (error) {
    console.error('Taboola creatives API error:', error);
    res.status(500).json({
      error: error.message,
      service: 'taboola-creatives'
    });
  }
}

// Helper function to convert date presets to actual dates
function getDateForPreset(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (preset) {
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        start: formatDate(yesterday),
        end: formatDate(yesterday)
      };
    
    case 'last_7d':
      const week_ago = new Date(today);
      week_ago.setDate(week_ago.getDate() - 7);
      return {
        start: formatDate(week_ago),
        end: formatDate(today)
      };
    
    case 'last_30d':
    default:
      const month_ago = new Date(today);
      month_ago.setDate(month_ago.getDate() - 30);
      return {
        start: formatDate(month_ago),
        end: formatDate(today)
      };
    
    case 'last_90d':
      const quarter_ago = new Date(today);
      quarter_ago.setDate(quarter_ago.getDate() - 90);
      return {
        start: formatDate(quarter_ago),
        end: formatDate(today)
      };
  }
}

function formatDate(date) {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}
