// api/taboola-creatives.js - Fixed Taboola Creative Extraction from Campaigns
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

    // Check environment variables
    const TABOOLA_ACCESS_TOKEN = process.env.TABOOLA_ACCESS_TOKEN;
    const ACCOUNT_ID = process.env.TABOOLA_ACCOUNT_ID;

    if (!TABOOLA_ACCESS_TOKEN || !ACCOUNT_ID) {
      console.log('Missing Taboola credentials');
      return res.json([]); // Return empty array instead of error
    }

    // First, get all campaigns to extract creatives from
    const campaignsUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/campaigns/`;
    
    console.log('Fetching Taboola campaigns for creative extraction...');
    const campaignsResponse = await fetch(campaignsUrl, {
      headers: {
        'Authorization': `Bearer ${TABOOLA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!campaignsResponse.ok) {
      console.log(`Taboola campaigns API error: ${campaignsResponse.status}`);
      return res.json([]);
    }

    const campaignsData = await campaignsResponse.json();
    console.log(`Found ${campaignsData.results?.length || 0} Taboola campaigns to extract creatives from`);

    if (!campaignsData.results || campaignsData.results.length === 0) {
      console.log('No Taboola campaigns found');
      return res.json([]);
    }

    const creativeData = [];
    
    // For each campaign, get its items (creatives)
    for (const campaign of campaignsData.results.slice(0, 10)) { // Limit to first 10 campaigns
      try {
        console.log(`Processing campaign: ${campaign.name} (${campaign.id})`);
        
        // Get campaign items (creatives/ads)
        const itemsUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/campaigns/${campaign.id}/items`;
        
        const itemsResponse = await fetch(itemsUrl, {
          headers: {
            'Authorization': `Bearer ${TABOOLA_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        if (!itemsResponse.ok) {
          console.log(`Failed to fetch items for campaign ${campaign.id}: ${itemsResponse.status}`);
          continue;
        }

        const itemsData = await itemsResponse.json();
        console.log(`Found ${itemsData.results?.length || 0} items in campaign ${campaign.name}`);

        // Process each item (creative)
        if (itemsData.results && itemsData.results.length > 0) {
          for (const item of itemsData.results) {
            // Get performance data for this specific item
            const performanceUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/reports/campaign-summary/dimensions/item_breakdown`;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            const endDate = new Date();
            
            try {
              const performanceResponse = await fetch(performanceUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${TABOOLA_ACCESS_TOKEN}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  start_date: startDate.toISOString().split('T')[0],
                  end_date: endDate.toISOString().split('T')[0],
                  dimensions: ['item_breakdown'],
                  filters: [
                    {
                      filter: 'campaign_id',
                      operator: 'IN',
                      values: [campaign.id.toString()]
                    },
                    {
                      filter: 'item_id',
                      operator: 'IN', 
                      values: [item.id.toString()]
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

              // Calculate metrics
              const spend = parseFloat(performanceData.spent || campaign.spent || 0) / (itemsData.results.length || 1);
              const impressions = parseInt(performanceData.impressions || campaign.impressions || 0) / (itemsData.results.length || 1);
              const clicks = parseInt(performanceData.clicks || campaign.clicks || 0) / (itemsData.results.length || 1);
              const conversions = parseInt(performanceData.actions || campaign.conversions || 0) / (itemsData.results.length || 1);
              const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
              const cpc = clicks > 0 ? spend / clicks : 0;
              const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
              const revenue = parseFloat(performanceData.conversions_value || 0);
              const roas = spend > 0 ? revenue / spend : 0;

              // Determine creative type
              const isVideo = item.type === 'VIDEO' || item.video_url || item.content_type === 'video';
              const creative_type = isVideo ? 'video' : 'image';

              // Calculate performance score
              let performanceScore = 0;
              if (ctr >= 2) performanceScore += 30;
              else if (ctr >= 1) performanceScore += 15;
              if (cpc <= 2) performanceScore += 25;
              else if (cpc <= 3) performanceScore += 15;
              if (conversions >= 1) performanceScore += 25;
              if (roas >= 1.5) performanceScore += 20;

              creativeData.push({
                id: `taboola_${item.id}`,
                name: item.title || item.content || `${campaign.name} - Item ${item.id}`,
                campaign_id: campaign.id,
                campaign_name: campaign.name,
                platform: 'Taboola',
                creative_type: creative_type,
                status: item.approval_state || 'active',
                
                // Creative content
                title: item.title || '',
                description: item.content || '',
                image_url: item.thumbnail_url || item.url,
                video_url: item.video_url || null,
                landing_page_url: item.url,
                
                // Performance metrics
                spend: spend,
                revenue: revenue,
                roas: roas,
                impressions: Math.round(impressions),
                clicks: Math.round(clicks),
                conversions: Math.round(conversions),
                ctr: ctr,
                cpc: cpc,
                cpm: cpm,
                
                // Video specific metrics (estimated)
                hook_rate: isVideo ? ctr * 2 : 0,
                retention_25pct: isVideo ? Math.min(100, ctr * 3) : 0,
                completion_rate: isVideo ? Math.min(100, ctr * 1.5) : 0,
                video_views: isVideo ? Math.round(impressions * (ctr / 100) * 1.5) : 0,
                
                performance_score: Math.min(100, performanceScore),
                
                // Debug info
                debug_info: {
                  campaign_spent: campaign.spent,
                  items_in_campaign: itemsData.results.length,
                  raw_performance: performanceData
                }
              });

            } catch (perfError) {
              console.log(`Error fetching performance for item ${item.id}:`, perfError.message);
              
              // Create creative with campaign-level data only
              const spend = parseFloat(campaign.spent || 0) / (itemsData.results.length || 1);
              const impressions = parseInt(campaign.impressions || 0) / (itemsData.results.length || 1);
              const clicks = parseInt(campaign.clicks || 0) / (itemsData.results.length || 1);
              const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
              const cpc = clicks > 0 ? spend / clicks : 0;

              creativeData.push({
                id: `taboola_${item.id}`,
                name: item.title || `${campaign.name} - Item ${item.id}`,
                campaign_id: campaign.id,
                platform: 'Taboola',
                creative_type: item.type === 'VIDEO' ? 'video' : 'image',
                title: item.title || '',
                description: item.content || '',
                image_url: item.thumbnail_url || item.url,
                spend: spend,
                impressions: Math.round(impressions),
                clicks: Math.round(clicks),
                conversions: 0,
                ctr: ctr,
                cpc: cpc,
                performance_score: Math.round(ctr * 10),
                debug_info: {
                  error: 'Used campaign-level data',
                  campaign_data: true
                }
              });
            }
          }
        } else {
          // No items found, create a creative from campaign data
          console.log(`No items found for campaign ${campaign.name}, creating creative from campaign data`);
          
          const spend = parseFloat(campaign.spent || 0);
          const impressions = parseInt(campaign.impressions || 0);
          const clicks = parseInt(campaign.clicks || 0);
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const cpc = clicks > 0 ? spend / clicks : 0;

          creativeData.push({
            id: `taboola_campaign_${campaign.id}`,
            name: campaign.name,
            campaign_id: campaign.id,
            platform: 'Taboola',
            creative_type: 'campaign',
            title: campaign.name,
            description: `Campaign: ${campaign.name}`,
            spend: spend,
            impressions: impressions,
            clicks: clicks,
            conversions: 0,
            ctr: ctr,
            cpc: cpc,
            performance_score: Math.round(ctr * 10),
            debug_info: {
              source: 'campaign_only',
              no_items_found: true
            }
          });
        }

      } catch (campaignError) {
        console.log(`Error processing campaign ${campaign.id}:`, campaignError.message);
      }
    }

    // Sort by performance score
    creativeData.sort((a, b) => b.performance_score - a.performance_score);

    console.log(`=== TABOOLA CREATIVES EXTRACTION COMPLETE ===`);
    console.log(`Total creatives extracted: ${creativeData.length}`);
    console.log(`Sample creative names:`, creativeData.slice(0, 3).map(c => c.name));

    res.json(creativeData);

  } catch (error) {
    console.error('Error in Taboola creatives API:', error);
    res.status(500).json({ error: error.message });
  }
}
