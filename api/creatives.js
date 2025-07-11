// api/creatives.js - Fixed to handle lead events and custom conversions
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const { date_preset = 'last_30d', campaign_id } = req.query;

    let url;
    if (campaign_id) {
      // Get creatives for specific campaign
      url = `https://graph.facebook.com/v18.0/${campaign_id}/ads?fields=name,status,creative{object_story_spec,image_url,video_id,thumbnail_url,title,body,call_to_action,object_type},insights{spend,impressions,clicks,ctr,cpc,cpm,conversions,conversion_values,cost_per_conversion,actions,cost_per_action_type,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_30_sec_watched_actions,video_avg_time_watched_actions,video_thruplay_watched_actions}&date_preset=${date_preset}&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
    } else {
      // Get all creatives from account
      url = `https://graph.facebook.com/v18.0/act_${process.env.AD_ACCOUNT_ID}/ads?fields=name,status,campaign_id,creative{object_story_spec,image_url,video_id,thumbnail_url,title,body,call_to_action,object_type},insights{spend,impressions,clicks,ctr,cpc,cpm,conversions,conversion_values,cost_per_conversion,actions,cost_per_action_type,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_30_sec_watched_actions,video_avg_time_watched_actions,video_thruplay_watched_actions}&date_preset=${date_preset}&limit=50&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
    }

    const response = await fetch(url);
    const result = await response.json();

    if (!response.ok) {
      console.log('Facebook API Error:', result);
      return res.status(500).json({
        error: result.error?.message || 'Failed to fetch creative data',
        facebookError: result
      });
    }

    const creativeData = [];

    for (const ad of (result.data || [])) {
      try {
        const insights = ad.insights?.data[0] || {};
        const creative = ad.creative || {};

        console.log(`Processing ad ${ad.id}:`, {
          name: ad.name,
          hasInsights: !!insights,
          actions: insights.actions?.length || 0,
          rawConversions: insights.conversions
        });

        // Calculate performance metrics
        const spend = parseFloat(insights.spend || 0);
        const impressions = parseInt(insights.impressions || 0);
        const clicks = parseInt(insights.clicks || 0);
        const ctr = parseFloat(insights.ctr || 0);
        const cpc = parseFloat(insights.cpc || 0);
        const cpm = parseFloat(insights.cpm || 0);

        // Extract lead conversions from actions array - ENHANCED
        let leadConversions = 0;
        let totalConversions = parseInt(insights.conversions || 0);
        let costPerLead = 0;

        if (insights.actions && Array.isArray(insights.actions)) {
          // Look for lead events - try multiple action types
          const leadAction = insights.actions.find(action => 
            action.action_type === 'lead' || 
            action.action_type === 'leadgen' ||
            action.action_type === 'leads' ||
            action.action_type === 'complete_registration' ||
            action.action_type === 'submit_application'
          );
          
          if (leadAction) {
            leadConversions = parseInt(leadAction.value || 0);
            console.log(`Lead conversions found for ${ad.id}:`, leadConversions, 'Type:', leadAction.action_type);
          }

          // Log all actions for debugging
          console.log(`All actions for ${ad.id}:`, insights.actions.map(a => `${a.action_type}: ${a.value}`));
        }

        // Calculate cost per lead from cost_per_action_type
        if (insights.cost_per_action_type && Array.isArray(insights.cost_per_action_type)) {
          const leadCostAction = insights.cost_per_action_type.find(action => 
            action.action_type === 'lead' || 
            action.action_type === 'leadgen' ||
            action.action_type === 'complete_registration'
          );
          
          if (leadCostAction) {
            costPerLead = parseFloat(leadCostAction.value || 0);
            console.log(`Cost per lead found for ${ad.id}:`, costPerLead);
          }
        }

        // Use lead conversions if available, fallback to standard conversions
        const finalConversions = leadConversions > 0 ? leadConversions : totalConversions;
        const finalCPA = finalConversions > 0 ? spend / finalConversions : (costPerLead || parseFloat(insights.cost_per_conversion || 0));

        // Video engagement metrics
        const videoViews = parseInt(insights.video_30_sec_watched_actions?.[0]?.value || 0);
        const thruPlays = parseInt(insights.video_thruplay_watched_actions?.[0]?.value || 0);
        const avgWatchTime = parseFloat(insights.video_avg_time_watched_actions?.[0]?.value || 0);
        const p25Views = parseInt(insights.video_p25_watched_actions?.[0]?.value || 0);
        const p50Views = parseInt(insights.video_p50_watched_actions?.[0]?.value || 0);
        const p75Views = parseInt(insights.video_p75_watched_actions?.[0]?.value || 0);
        const p100Views = parseInt(insights.video_p100_watched_actions?.[0]?.value || 0);

        // Calculate hook rate (3-second video views / impressions)
        const hookRate = impressions > 0 ? (videoViews / impressions) * 100 : 0;

        // Calculate completion rate
        const completionRate = videoViews > 0 ? (thruPlays / videoViews) * 100 : 0;

        // Determine creative type - improved detection
        const hasVideo = creative.video_id ||
                         creative.object_story_spec?.video_data ||
                         creative.object_type === 'VIDEO' ||
                         videoViews > 0 ||
                         avgWatchTime > 0;

        const creativeType = hasVideo ? 'video' : 'image';

        // Get creative content
        const imageUrl = creative.image_url || creative.thumbnail_url;
        const title = creative.title || creative.object_story_spec?.link_data?.name || '';
        const body = creative.body || creative.object_story_spec?.link_data?.description || '';
        const callToAction = creative.call_to_action?.type || creative.object_story_spec?.link_data?.call_to_action?.type || '';

        // Performance scoring (0-100)
        let performanceScore = 0;
        if (ctr >= 2) performanceScore += 30;
        else if (ctr >= 1) performanceScore += 15;
        
        if (cpc <= 2) performanceScore += 25;
        else if (cpc <= 3) performanceScore += 15;
        
        if (hookRate >= 20) performanceScore += 25;
        else if (hookRate >= 10) performanceScore += 15;
        
        if (completionRate >= 75) performanceScore += 20;
        else if (completionRate >= 50) performanceScore += 10;

        // Generate insights
        const insights_recommendations = [];
        
        if (ctr < 1) {
          insights_recommendations.push({
            type: 'warning',
            message: 'Low CTR - Consider testing stronger hooks or more compelling visuals'
          });
        }
        
        if (hookRate < 10 && hasVideo) {
          insights_recommendations.push({
            type: 'warning',
            message: 'Low hook rate - First 3 seconds need improvement'
          });
        }
        
        if (completionRate < 50 && hasVideo) {
          insights_recommendations.push({
            type: 'warning',
            message: 'Low completion rate - Video content may not be engaging enough'
          });
        }
        
        if (cpc > 3) {
          insights_recommendations.push({
            type: 'error',
            message: 'High CPC - Creative may not be resonating with audience'
          });
        }
        
        if (finalConversions === 0 && spend > 10) {
          insights_recommendations.push({
            type: 'error',
            message: 'No conversions - Check targeting, landing page, or conversion tracking'
          });
        }
        
        if (performanceScore >= 70) {
          insights_recommendations.push({
            type: 'success',
            message: 'Strong performer - Consider scaling or using as creative template'
          });
        }

        const creativeItem = {
          id: ad.id,
          name: ad.name,
          status: ad.status,
          campaign_id: ad.campaign_id,
          creative_type: creativeType,
          image_url: imageUrl,
          video_id: creative.video_id,
          title,
          body,
          call_to_action: callToAction,
          spend,
          impressions,
          clicks,
          ctr,
          cpc,
          cpm,
          hook_rate: hookRate,
          completion_rate: completionRate,
          avg_watch_time: avgWatchTime,
          video_views: videoViews,
          thru_plays: thruPlays,
          performance_score: performanceScore,
          insights: insights_recommendations,
          
          // ENHANCED CONVERSION DATA
          conversions: finalConversions,
          leadConversions: leadConversions,
          standardConversions: totalConversions,
          cpa: finalCPA,
          costPerLead: costPerLead,
          
          // Video retention data
          retention_25pct: videoViews > 0 ? (p25Views / videoViews) * 100 : 0,
          retention_50pct: videoViews > 0 ? (p50Views / videoViews) * 100 : 0,
          retention_75pct: videoViews > 0 ? (p75Views / videoViews) * 100 : 0,
          retention_100pct: videoViews > 0 ? (p100Views / videoViews) * 100 : 0,
          
          // Debug info
          debug_info: {
            has_video_id: !!creative.video_id,
            has_video_data: !!creative.object_story_spec?.video_data,
            object_type: creative.object_type,
            video_views: videoViews,
            avg_watch_time: avgWatchTime,
            raw_actions: insights.actions,
            raw_cost_per_action: insights.cost_per_action_type,
            lead_conversions_found: leadConversions,
            standard_conversions_found: totalConversions,
            final_conversions_used: finalConversions
          }
        };

        creativeData.push(creativeItem);

      } catch (error) {
        console.error(`Error processing ad ${ad.id}:`, error.message);
      }
    }

    // Sort by performance score descending
    creativeData.sort((a, b) => b.performance_score - a.performance_score);

    console.log('Creative data summary:', {
      totalCreatives: creativeData.length,
      withConversions: creativeData.filter(c => c.conversions > 0).length,
      withLeadConversions: creativeData.filter(c => c.leadConversions > 0).length,
      videoCreatives: creativeData.filter(c => c.creative_type === 'video').length
    });

    res.json(creativeData);

  } catch (error) {
    console.error('Error fetching creative data:', error);
    res.status(500).json({
      error: error.message
    });
  }
}
