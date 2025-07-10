export default async function handler(req, res) {
  try {
    const { date_preset = 'last_30d' } = req.query;
    
    console.log('=== OVERVIEW API CALLED ===');
    console.log('AD_ACCOUNT_ID:', process.env.AD_ACCOUNT_ID);
    console.log('Access token exists:', !!process.env.FACEBOOK_ACCESS_TOKEN);
    
    // Facebook API call for account insights
    const url = `https://graph.facebook.com/v18.0/act_${process.env.AD_ACCOUNT_ID}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,conversions,conversion_values,cost_per_conversion&date_preset=${date_preset}&level=account&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
    
    console.log('Making Facebook API call...');
    const response = await fetch(url);
    const result = await response.json();
    
    console.log('Facebook API response:', response.status);
    console.log('Facebook API result:', JSON.stringify(result));
    
    if (!response.ok) {
      console.error('Facebook API Error:', result);
      return res.status(500).json({
        success: false,
        error: result.error?.message || 'Facebook API Error',
        facebookError: result
      });
    }
    
    const data = result.data && result.data[0] ? result.data[0] : {};
    console.log('Processed Facebook data:', JSON.stringify(data));
    
    // Return data in the format the dashboard expects
    const overview = {
      // Match the dashboard field names exactly
      spend: parseFloat(data.spend || 0),
      revenue: parseFloat(data.conversion_values || 0),
      conversions: parseInt(data.conversions || 0),
      clicks: parseInt(data.clicks || 0),
      impressions: parseInt(data.impressions || 0),
      ctr: parseFloat(data.ctr || 0),
      cpc: parseFloat(data.cpc || 0),
      cpm: parseFloat(data.cpm || 0),
      
      // Keep your original field names too for backward compatibility
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
    overview.roas = overview.revenue > 0 ? overview.revenue / overview.spend : 0;
    overview.totalROAS = overview.roas; // Backward compatibility
    
    console.log('OVERVIEW RETURNING:', JSON.stringify(overview));
    res.json(overview);
    
  } catch (error) {
    console.error('Overview API Error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
  }
}
