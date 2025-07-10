export default async function handler(req, res) {
  try {
    const { date_preset = 'last_30d' } = req.query;
    
    // Get campaigns list
    const campaignsUrl = `https://graph.facebook.com/v18.0/act_${process.env.AD_ACCOUNT_ID}/campaigns?fields=name,status,objective&limit=25&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
    
    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsResult = await campaignsResponse.json();
    
    if (!campaignsResponse.ok) {
      return res.status(500).json({
        error: campaignsResult.error?.message || 'Failed to fetch campaigns'
      });
    }

    const campaignData = [];
    
    // Get insights for each campaign
    for (const campaign of (campaignsResult.data || []).slice(0, 10)) {
      try {
        const insightsUrl = `https://graph.facebook.com/v18.0/${campaign.id}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,conversions,conversion_values&date_preset=${date_preset}&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
        
        const insightsResponse = await fetch(insightsUrl);
        const insightsResult = await insightsResponse.json();
        
        const insightData = insightsResult.data && insightsResult.data[0] ? insightsResult.data[0] : {};
        
        const spend = parseFloat(insightData.spend || 0);
        const revenue = parseFloat(insightData.conversion_values || 0);
        const conversions = parseInt(insightData.conversions || 0);
        const clicks = parseInt(insightData.clicks || 0);
        const roas = revenue > 0 && spend > 0 ? revenue / spend : 0;
        const ctr = parseFloat(insightData.ctr || 0);
        const cpc = parseFloat(insightData.cpc || 0);
        
        // Determine status based on performance
        let status = 'neutral';
        if (roas >= 2.5) status = 'winning';
        else if (roas < 1.5 && spend > 0) status = 'losing';
        
        campaignData.push({
          id: campaign.id,
          name: campaign.name,
          spend,
          revenue,
          roas,
          conversions,
          clicks,
          ctr,
          cpc,
          status,
          objective: campaign.objective,
          campaignStatus: campaign.status
        });
      } catch (campaignError) {
        console.error(`Error fetching insights for campaign ${campaign.id}:`, campaignError.message);
      }
    }

    // Sort by spend descending
    campaignData.sort((a, b) => b.spend - a.spend);
    res.json(campaignData);
  } catch (error) {
    res.status(500).json({ 
      error: error.message 
    });
  }
}
