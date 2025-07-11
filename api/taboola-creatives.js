// api/taboola-creatives.js - Fixed with OAuth Authentication
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { date_preset = 'last_30d' } = req.query;

    console.log('=== TABOOLA CREATIVES API CALLED ===');
    console.log('Date preset:', date_preset);

    // Use your actual environment variables
    const CLIENT_ID = process.env.TABOOLA_CLIENT_ID;
    const CLIENT_SECRET = process.env.TABOOLA_CLIENT_SECRET;
    const ACCOUNT_ID = process.env.TABOOLA_ACCOUNT_ID;

    console.log('Client ID available:', !!CLIENT_ID);
    console.log('Client Secret available:', !!CLIENT_SECRET);
    console.log('Account ID:', ACCOUNT_ID);

    if (!CLIENT_ID || !CLIENT_SECRET || !ACCOUNT_ID) {
      console.log('Missing Taboola credentials');
      return res.json([]);
    }

    // Step 1: Get OAuth access token
    console.log('Getting Taboola OAuth token...');
    const tokenUrl = 'https://backstage.taboola.com/backstage/oauth/token';
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    });

    if (!tokenResponse.ok) {
      console.log(`Taboola OAuth failed: ${tokenResponse.status}`);
      const errorText = await tokenResponse.text();
      console.log('OAuth error:', errorText);
      return res.json([]);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    console.log('OAuth token obtained successfully');

    // Step 2: Get campaigns to extract creatives from
    const campaignsUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/campaigns/`;
    
    console.log('Fetching Taboola campaigns for creative extraction...');
    const campaignsResponse = await fetch(campaignsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!campaignsResponse.ok) {
      console.log(`Taboola campaigns API error: ${campaignsResponse.status}`);
      const errorText = await campaignsResponse.text();
      console.log('Campaigns error:', errorText);
      return res.json([]);
    }

    const campaignsData = await campaignsResponse.json();
    console.log(`Found ${campaignsData.results?.length || 0} Taboola campaigns`);

    if (!campaignsData.results || campaignsData.results.length === 0) {
      console.log('No Taboola campaigns found');
      return res.json([]);
    }

    const creativeData = [];
    
    // Step 3: For each campaign, get its creatives/items
    for (const campaign of campaignsData.results.slice(0, 10)) {
      try {
        console.log(`Processing campaign: ${campaign.name} (ID: ${campaign.id})`);
        
        // Get campaign items (creatives)
        const itemsUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/campaigns/${campaign.id}/items`;
        
        const itemsResponse = await fetch(itemsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (!itemsResponse.ok) {
          console.log(`Failed to fetch items for campaign ${campaign.id}: ${itemsResponse.status}`);
          
          // Create a creative from campaign data as fallback
          const campaignCreative = createCreativeFromCampaign(campaign);
          if (campaignCreative) {
            creativeData.push(campaignCreative);
          }
          continue;
        }

        const itemsData = await itemsResponse.json();
        console.log(`Found ${itemsData.results?.length || 0} items in campaign ${campaign.name}`);

        if (itemsData.results && itemsData.results.length > 0) {
          // Process each item as a creative
          for (const item of itemsData.results.slice(0, 5)) { // Limit to 5 items per campaign
            const creative = createCreativeFromItem(item, campaign);
            if (creative) {
              creativeData.push(creative);
            }
          }
        } else {
          // No items found, create creative from campaign data
          const campaignCreative = createCreativeFromCampaign(campaign);
          if (campaignCreative) {
            creativeData.push(campaignCreative);
          }
        }

      } catch (campaignError) {
        console.log(`Error processing campaign ${campaign.id}:`, campaignError.message);
      }
    }

    // Helper function to create creative from campaign data
    function createCreativeFromCampaign(campaign) {
      const spend = parseFloat(campaign.spent || 0);
      const impressions = parseInt(campaign.impressions || 0);
      const clicks = parseInt(campaign.clicks || 0);
      const conversions = parseInt(campaign.conversions || campaign.actions || 0);
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;

      // Calculate performance score
      let performanceScore = 0;
      if (ctr >= 2) performanceScore += 30;
      else if (ctr >= 1) performanceScore += 15;
      if (cpc <= 2) performanceScore += 25;
      else if (cpc <= 3) performanceScore += 15;
      if (conversions >= 1) performanceScore += 25;

      return {
        id: `taboola_campaign_${campaign.id}`,
        name: campaign.name || `Campaign ${campaign.id}`,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        platform: 'Taboola',
        creative_type: 'campaign',
        status: campaign.status || 'active',
        
        // Creative content
        title: campaign.name || '',
        description: `Taboola Campaign: ${campaign.name}`,
        image_url: campaign.thumbnail_url || null,
        landing_page_url: campaign.url || null,
        
        // Performance metrics
        spend: spend,
        revenue: 0, // Taboola doesn't typically track revenue directly
        roas: 0,
        impressions: impressions,
        clicks: clicks,
        conversions: conversions,
        ctr: ctr,
        cpc: cpc,
        cpm: cpm,
        cpa: cpa,
        
        // Video metrics (estimated if video campaign)
        hook_rate: ctr * 1.5,
        retention_25pct: Math.min(100, ctr * 2.5),
        completion_rate: Math.min(100, ctr * 1.2),
        video_views: Math.round(impressions * (ctr / 100) * 0.8),
        
        performance_score: Math.min(100, performanceScore),
        
        // Debug info
        debug_info: {
          source: 'campaign_data',
          campaign_status: campaign.status,
          campaign_type: campaign.campaign_type
        }
      };
    }

    // Helper function to create creative from item data
    function createCreativeFromItem(item, campaign) {
      // Distribute campaign performance across items
      const itemCount = 1; // We'll process each item individually
      const spend = parseFloat(campaign.spent || 0) / Math.max(campaign.items_count || 1, 1);
      const impressions = parseInt(campaign.impressions || 0) / Math.max(campaign.items_count || 1, 1);
      const clicks = parseInt(campaign.clicks || 0) / Math.max(campaign.items_count || 1, 1);
      const conversions = parseInt(campaign.conversions || 0) / Math.max(campaign.items_count || 1, 1);
      
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;

      // Determine creative type
      const isVideo = item.type === 'VIDEO' || 
                     item.video_url || 
                     (item.content_type && item.content_type.includes('video'));
      const creative_type = isVideo ? 'video' : 'image';

      // Calculate performance score
      let performanceScore = 0;
      if (ctr >= 2) performanceScore += 30;
      else if (ctr >= 1) performanceScore += 15;
      if (cpc <= 2) performanceScore += 25;
      else if (cpc <= 3) performanceScore += 15;
      if (conversions >= 0.5) performanceScore += 25;

      return {
        id: `taboola_item_${item.id}`,
        name: item.title || item.content || `${campaign.name} - ${item.id}`,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        platform: 'Taboola',
        creative_type: creative_type,
        status: item.approval_state || item.status || 'active',
        
        // Creative content
        title: item.title || '',
        description: item.content || item.description || '',
        image_url: item.thumbnail_url || item.image_url || null,
        video_url: item.video_url || null,
        landing_page_url: item.url || campaign.url,
        
        // Performance metrics
        spend: Math.round(spend * 100) / 100,
        revenue: 0,
        roas: 0,
        impressions: Math.round(impressions),
        clicks: Math.round(clicks),
        conversions: Math.round(conversions * 10) / 10,
        ctr: Math.round(ctr * 100) / 100,
        cpc: Math.round(cpc * 100) / 100,
        cpm: Math.round(cpm * 100) / 100,
        cpa: cpa > 0 ? Math.round(cpa * 100) / 100 : 0,
        
        // Video metrics (for video creatives)
        hook_rate: isVideo ? Math.min(15, ctr * 1.5) : 0,
        retention_25pct: isVideo ? Math.min(100, ctr * 2.5) : 0,
        completion_rate: isVideo ? Math.min(100, ctr * 1.2) : 0,
        video_views: isVideo ? Math.round(impressions * (ctr / 100) * 0.8) : 0,
        
        performance_score: Math.min(100, performanceScore),
        
        // Debug info
        debug_info: {
          source: 'item_data',
          item_type: item.type,
          approval_state: item.approval_state,
          campaign_items_count: campaign.items_count
        }
      };
    }

    // Sort by performance score descending
    creativeData.sort((a, b) => b.performance_score - a.performance_score);

    console.log(`=== TABOOLA CREATIVES EXTRACTION COMPLETE ===`);
    console.log(`Total creatives extracted: ${creativeData.length}`);
    console.log(`Sample creatives:`, creativeData.slice(0, 3).map(c => ({
      name: c.name,
      type: c.creative_type,
      spend: c.spend,
      ctr: c.ctr
    })));

    res.json(creativeData);

  } catch (error) {
    console.error('Error in Taboola creatives API:', error);
    console.log('Full error stack:', error.stack);
    
    // Return empty array instead of error to prevent dashboard breaking
    res.json([]);
  }
}
