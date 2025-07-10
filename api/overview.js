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
    
    const accountInsights = await callFacebookAPI(`act_${process.env.AD_ACCOUNT_ID}/insights`, {
      fields: 'spend,impressions,clicks,ctr,cpc,cpm,conversions,conversion_values,cost_per_conversion',
      date_preset,
      level: 'account'
    });

    const data = accountInsights.data && accountInsights.data[0] ? accountInsights.data[0] : {};
    
    const overview = {
      totalSpend: parseFloat(data.spend || 0),
      totalRevenue: parseFloat(data.conversion_values || 0),
      totalConversions: parseInt(data.conversions || 0),
      totalClicks: parseInt(data.clicks || 0),
      totalImpressions: parseInt(data.impressions || 0),
      averageCTR: parseFloat(data.ctr || 0),
      averageCPC: parseFloat(data.cpc || 0),
      averageCPM: parseFloat(data.cpm || 0),
      averageCPA: parseFloat(data.cost_per_conversion || 0)
    };

    overview.totalROAS = overview.totalRevenue > 0 ? overview.totalRevenue / overview.totalSpend : 0;

    res.json(overview);
  } catch (error) {
    console.error('Error fetching account overview:', error);
    res.status(500).json({ error: error.message });
  }
}