// api/overview.js - Enhanced to handle lead events and custom conversions
export default async function handler(req, res) {
  try {
    const { date_preset = 'last_30d' } = req.query;
    
    console.log('=== OVERVIEW API CALLED ===');
    console.log('AD_ACCOUNT_ID:', process.env.AD_ACCOUNT_ID);
    console.log('Access token length:', process.env.FACEBOOK_ACCESS_TOKEN?.length);
    
    // Enhanced Facebook API call with lead events and actions
    const url = `https://graph.facebook.com/v18.0/act_${process.env.AD_ACCOUNT_ID}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,conversions,conversion_values,cost_per_conversion,actions,cost_per_action_type&date_preset=${date_preset}&level=account&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (!response.ok) {
      console.log('Facebook API Error:', result);
      return res.status(500).json({
        success: false,
        error: result.error?.message || 'Facebook API Error',
        facebookError: result
      });
    }
    
    const data = result.data && result.data[0] ? result.data[0] : {};
    console.log('Raw Facebook data:', JSON.stringify(data, null, 2));
    
    // Extract lead conversions from actions array
    let leadConversions = 0;
    let leadConversionValue = 0;
    let costPerLead = 0;
    
    if (data.actions && Array.isArray(data.actions)) {
      // Look for lead events - try multiple action types
      const leadAction = data.actions.find(action => 
        action.action_type === 'lead' || 
        action.action_type === 'leadgen' ||
        action.action_type === 'leads' ||
        action.action_type === 'complete_registration' ||
        action.action_type === 'submit_application'
      );
      
      if (leadAction) {
        leadConversions = parseInt(leadAction.value || 0);
        console.log('Lead conversions found:', leadConversions, 'Type:', leadAction.action_type);
      }
      
      // Also check for other conversion types
      const otherConversions = data.actions.filter(action => 
        action.action_type.includes('conversion') ||
        action.action_type === 'purchase' ||
        action.action_type === 'complete_registration'
      );
      
      console.log('All actions found:', data.actions.map(a => `${a.action_type}: ${a.value}`));
    }
    
    // Calculate cost per lead from cost_per_action_type
    if (data.cost_per_action_type && Array.isArray(data.cost_per_action_type)) {
      const leadCostAction = data.cost_per_action_type.find(action => 
        action.action_type === 'lead' || 
        action.action_type === 'leadgen' ||
        action.action_type === 'complete_registration'
      );
      
      if (leadCostAction) {
        costPerLead = parseFloat(leadCostAction.value || 0);
        console.log('Cost per lead found:', costPerLead, 'Type:', leadCostAction.action_type);
      }
    }
    
    // Use lead conversions if available, fallback to standard conversions
    const totalConversions = leadConversions > 0 ? leadConversions : parseInt(data.conversions || 0);
    const totalRevenue = parseFloat(data.conversion_values || leadConversionValue);
    const totalSpend = parseFloat(data.spend || 0);
    
    const overview = {
      // Original field names for backward compatibility
      totalSpend,
      totalRevenue,
      totalConversions,
      totalClicks: parseInt(data.clicks || 0),
      totalImpressions: parseInt(data.impressions || 0),
      averageCTR: parseFloat(data.ctr || 0),
      averageCPC: parseFloat(data.cpc || 0),
      averageCPM: parseFloat(data.cpm || 0),
      averageCPA: costPerLead > 0 ? costPerLead : parseFloat(data.cost_per_conversion || 0),
      
      // New field names expected by dashboard
      spend: totalSpend,
      revenue: totalRevenue,
      conversions: totalConversions,
      clicks: parseInt(data.clicks || 0),
      impressions: parseInt(data.impressions || 0),
      ctr: parseFloat(data.ctr || 0),
      cpc: parseFloat(data.cpc || 0),
      cpm: parseFloat(data.cpm || 0),
      cpa: costPerLead > 0 ? costPerLead : parseFloat(data.cost_per_conversion || 0),
      
      // Lead-specific data
      leadConversions,
      costPerLead,
      
      // Debug info
      debug: {
        rawActions: data.actions,
        rawCostPerAction: data.cost_per_action_type,
        leadConversionsFound: leadConversions,
        costPerLeadFound: costPerLead
      }
    };
    
    // Calculate ROAS
    overview.totalROAS = overview.totalRevenue > 0 ? overview.totalRevenue / overview.totalSpend : 0;
    overview.roas = overview.totalROAS;
    
    console.log('Final overview data:', JSON.stringify(overview, null, 2));
    res.json(overview);
    
  } catch (error) {
    console.error('Overview API Error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}
