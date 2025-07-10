import axios from 'axios';

const FACEBOOK_API_BASE = 'https://graph.facebook.com/v18.0';

async function callFacebookAPI(endpoint, params = {}) {
  const url = `${FACEBOOK_API_BASE}/${endpoint}`;
  const response = await axios.get(url, {
    params: {
      access_token: process.env.FACEBOOK_ACCESS_TOKEN,
      ...params
    },
    timeout: 10000
  });
  return response.data;
}

export default async function handler(req, res) {
  try {
    const { date_preset = 'last_30d' } = req.query;
    
    const campaigns = await callFacebookAPI(`act_${process.env.AD_ACCOUNT_ID}/campaigns`, {
      fields: 'name,status,objective',
      limit: 25
    });

    const campaignData = [];
    
    for (const campaign of (campaigns.data || []).slice(0, 10)) {
      try {
        const insights = await callFacebookAPI(`${campaign.id}/insights`, {
          fields: 'spend,impressions,clicks,ctr,cpc,cpm,conversions,conversion_values',
          date_preset
        });
        
        const insightData = insights.data && insights.data[0] ? insights.data[0] : {};
        
        const spend = parseFloat(insightData.spend || 0);
        const revenue = parseFloat(insightData.conversion_values || 0);
        const conversions = parseInt(insightData.conversions || 0);
        const clicks = parseInt(insightData.clicks || 0);
        const roas = revenue > 0 && spend > 0 ? revenue / spend : 0;
        const ctr = parseFloat(insightData.ctr || 0);
        const cpc = parseFloat(insightData.cpc || 0);
        
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

    campaignData.sort((a, b) => b.spend - a.spend);
    res.json(campaignData);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: error.message });
  }
}