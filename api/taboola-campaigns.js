// api/taboola-campaigns.js - Taboola Campaign Performance Data
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { date_range = 'last_30d' } = req.query;
    const ACCOUNT_ID = process.env.TABOOLA_ACCOUNT_ID;

    console.log('=== TABOOLA CAMPAIGNS API CALLED ===');
    console.log('Date range:', date_range);

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

    console.log(`Fetching Taboola data from ${startDateStr} to ${endDateStr}`);

    // Get campaign performance from Taboola
    const performanceUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/reports/campaign-summary/dimensions/campaign_breakdown`;
    
    const performanceParams = new URLSearchParams({
      start_date: startDateStr,
      end_date: endDateStr,
      format: 'json'
    });

    console.log('Requesting Taboola campaign performance...');

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
      console.error('Taboola performance API error:', errorText);
      throw new Error(`Taboola API error: ${performanceResponse.status} - ${errorText}`);
    }

    const performanceData = await performanceResponse.json();
    console.log('Taboola performance data received:', performanceData.results?.length || 0, 'campaigns');

    // Also get campaign details
    const campaignsUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/campaigns`;
    
    console.log('Requesting Taboola campaign details...');

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
      console.log('Taboola campaign details received:', campaignsData.results?.length || 0, 'campaigns');
    }

    // Process and format data
    const campaignData = [];

    if (performanceData.results) {
      for (const campaign of performanceData.results) {
        try {
          // Find campaign details
          const campaignDetails = campaignsData.results?.find(c => c.id === campaign.campaign) || {};

          const spend = parseFloat(campaign.spent || 0);
          const impressions = parseInt(campaign.impressions || 0);
          const clicks = parseInt(campaign.clicks || 0);
          const conversions = parseInt(campaign.actions || 0); // Taboola uses 'actions' for conversions
          const revenue = parseFloat(campaign.conversions_value || 0); // Revenue from conversions
          
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const cpc = clicks > 0 ? spend / clicks : 0;
          const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
          const cpa = conversions > 0 ? spend / conversions : 0;
          const roas = revenue > 0 && spend > 0 ? revenue / spend : 0;

          // Determine status based on performance
          let status = 'neutral';
          if (roas >= 2.5) status = 'winning';
          else if (roas < 1.5 && spend > 0) status = 'losing';
          else if (conversions === 0 && spend > 50) status = 'losing';

          campaignData.push({
            id: campaign.campaign,
            name: campaignDetails.name || `Campaign ${campaign.campaign}`,
            platform: 'taboola',
            spend,
            revenue,
            roas,
            conversions,
            clicks,
            impressions,
            ctr,
            cpc,
            cpm,
            cpa,
            status,
            campaignStatus: campaignDetails.status || 'UNKNOWN',
            objective: campaignDetails.cpc_goal ? `CPC: $${campaignDetails.cpc_goal}` : 'Traffic',
            
            // Taboola-specific metrics
            taboola_metrics: {
              campaign_id: campaign.campaign,
              actions: campaign.actions,
              conversions_value: campaign.conversions_value,
              visible_impressions: campaign.visible_impressions,
              viewability_rate: campaign.viewability_rate
            },

            // Debug info
            debug_info: {
              raw_performance: campaign,
              raw_details: campaignDetails
            }
          });

        } catch (error) {
          console.error(`Error processing Taboola campaign ${campaign.campaign}:`, error.message);
        }
      }
    }

    // Sort by spend descending
    campaignData.sort((a, b) => b.spend - a.spend);

    console.log('Taboola campaign data summary:', {
      totalCampaigns: campaignData.length,
      withConversions: campaignData.filter(c => c.conversions > 0).length,
      totalSpend: campaignData.reduce((sum, c) => sum + c.spend, 0),
      totalRevenue: campaignData.reduce((sum, c) => sum + c.revenue, 0)
    });

    res.json(campaignData);

  } catch (error) {
    console.error('Error fetching Taboola campaigns:', error);
    res.status(500).json({
      error: error.message,
      platform: 'taboola'
    });
  }
}
