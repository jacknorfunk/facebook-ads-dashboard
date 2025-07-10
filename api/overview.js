export default async function handler(req, res) {
  try {
    const { date_preset = 'last_30d' } = req.query;
    
    // Facebook API call for account insights
    const url = `https://graph.facebook.com/v18.0/act_${process.env.AD_ACCOUNT_ID}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,conversions,conversion_values,cost_per_conversion&date_preset=${date_preset}&level=account&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: result.error?.message || 'Facebook API Error',
        facebookError: result
      });
    }

    const data = result.data && result.data[0] ? result.data[0] : {};
    
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

    // Calculate ROAS
    overview.totalROAS = overview.totalRevenue > 0 ? overview.totalRevenue / overview.totalSpend : 0;

    res.json(overview);
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
}
