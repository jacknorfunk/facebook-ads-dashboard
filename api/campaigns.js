// api/campaigns.js - Fixed to handle lead events and custom conversions
export default async function handler(req, res) {
  try {
    const { date_preset = 'last_30d' } = req.query;

    // Get campaigns list with enhanced insights including actions
    const campaignsUrl = `https://graph.facebook.com/v18.0/act_${process.env.AD_ACCOUNT_ID}/campaigns?fields=name,status,objective&limit=25&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;

    const campaignsResponse = await fetch(campaignsUrl);
    const campaignsResult = await campaignsResponse.json();

    if (!campaignsResponse.ok) {
      console.log('Campaigns API Error:', campaignsResult);
      return res.status(500).json({
        error: campaignsResult.error?.message || 'Failed to fetch campaigns'
      });
    }

    const campaignData = [];

    // Get insights for each campaign
    for (const campaign of (campaignsResult.data || []).slice(0, 10)) {
      try {
        // Enhanced insights call with actions and cost_per_action_type
        const insightsUrl = `https://graph.facebook.com/v18.0/${campaign.id}/insights?fields=spend,impressions,clicks,ctr,cpc,cpm,conversions,conversion_values,actions,cost_per_action_type&date_preset=${date_preset}&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;

        const insightsResponse = await fetch(insightsUrl);
        const insightsResult = await insightsResponse.json();

        const insightData = insightsResult.data && insightsResult.data[0] ? insightsResult.data[0] : {};

        console.log(`Processing campaign ${campaign.id}:`, {
          name: campaign.name,
          hasInsights: !!insightData,
          actions: insightData.actions?.length || 0,
          rawConversions: insightData.conversions
        });

        const spend = parseFloat(insightData.spend || 0);
        const revenue = parseFloat(insightData.conversion_values || 0);
        const standardConversions = parseInt(insightData.conversions || 0);
        const clicks = parseInt(insightData.clicks || 0);
        const ctr = parseFloat(insightData.ctr || 0);
        const cpc = parseFloat(insightData.cpc || 0);

        // Extract lead conversions from actions array
        let leadConversions = 0;
        let costPerLead = 0;

        if (insightData.actions && Array.isArray(insightData.actions)) {
          // Look for lead events - try multiple action types
          const leadAction = insightData.actions.find(action => 
            action.action_type === 'lead' || 
            action.action_type === 'leadgen' ||
            action.action_type === 'leads' ||
            action.action_type === 'complete_registration' ||
            action.action_type === 'submit_application'
          );
          
          if (leadAction) {
            leadConversions = parseInt(leadAction.value || 0);
            console.log(`Lead conversions found for campaign ${campaign.id}:`, leadConversions, 'Type:', leadAction.action_type);
          }

          // Log all actions for debugging
          console.log(`All actions for campaign ${campaign.id}:`, insightData.actions.map(a => `${a.action_type}: ${a.value}`));
        }

        // Calculate cost per lead from cost_per_action_type
        if (insightData.cost_per_action_type && Array.isArray(insightData.cost_per_action_type)) {
          const leadCostAction = insightData.cost_per_action_type.find(action => 
            action.action_type === 'lead' || 
            action.action_type === 'leadgen' ||
            action.action_type === 'complete_registration'
          );
          
          if (leadCostAction) {
            costPerLead = parseFloat(leadCostAction.value || 0);
            console.log(`Cost per lead found for campaign ${campaign.id}:`, costPerLead);
          }
        }

        // Use lead conversions if available, fallback to standard conversions
        const conversions = leadConversions > 0 ? leadConversions : standardConversions;
        const roas = revenue > 0 && spend > 0 ? revenue / spend : 0;

        // Determine status based on performance
        let status = 'neutral';
        if (roas >= 2.5) status = 'winning';
        else if (roas < 1.5 && spend > 0) status = 'losing';
        else if (conversions === 0 && spend > 50) status = 'losing'; // No conversions with significant spend

        const campaignItem = {
          id: campaign.id,
          name: campaign.name,
          spend,
          revenue,
          roas,
          conversions,
          leadConversions,
          standardConversions,
          clicks,
          ctr,
          cpc,
          status,
          objective: campaign.objective,
          campaignStatus: campaign.status,
          costPerLead,
          
          // Debug info
          debug_info: {
            raw_actions: insightData.actions,
            raw_cost_per_action: insightData.cost_per_action_type,
            lead_conversions_found: leadConversions,
            standard_conversions_found: standardConversions,
            final_conversions_used: conversions
          }
        };

        campaignData.push(campaignItem);

      } catch (campaignError) {
        console.error(`Error fetching insights for campaign ${campaign.id}:`, campaignError.message);
      }
    }

    // Sort by spend descending
    campaignData.sort((a, b) => b.spend - a.spend);

    console.log('Campaign data summary:', {
      totalCampaigns: campaignData.length,
      withConversions: campaignData.filter(c => c.conversions > 0).length,
      withLeadConversions: campaignData.filter(c => c.leadConversions > 0).length,
      totalSpend: campaignData.reduce((sum, c) => sum + c.spend, 0)
    });

    res.json(campaignData);

  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      error: error.message
    });
  }
}
