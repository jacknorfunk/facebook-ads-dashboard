export default async function handler(req, res) {
  try {
    const { date_preset = 'last_30d', campaign_id } = req.query;
    
    let url;
    if (campaign_id) {
      // Get creatives for specific campaign
      url = `https://graph.facebook.com/v18.0/${campaign_id}/ads?fields=name,status,creative{object_story_spec,image_url,video_id,thumbnail_url,title,body,call_to_action},insights{spend,impressions,clicks,ctr,cpc,cpm,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_30_sec_watched_actions,video_avg_time_watched_actions,video_thruplay_watched_actions}&date_preset=${date_preset}&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
    } else {
      // Get all creatives from account
      url = `https://graph.facebook.com/v18.0/act_${process.env.AD_ACCOUNT_ID}/ads?fields=name,status,campaign_id,creative{object_story_spec,image_url,video_id,thumbnail_url,title,body,call_to_action},insights{spend,impressions,clicks,ctr,cpc,cpm,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_30_sec_watched_actions,video_avg_time_watched_actions,video_thruplay_watched_actions}&date_preset=${date_preset}&limit=50&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
    }
    
    const response = await fetch(url);
    const result = await response.json();
    
    if (!response.ok) {
      return res.status(500).json({
        error: result.error?.message || 'Failed to fetch creative data'
      });
    }

    const creativeData = [];
    
    for (const ad of (result.data || [])) {
      try {
        const insights = ad.insights?.data[0] || {};
        const creative = ad.creative || {};
        
        // Calculate performance metrics
        const spend = parseFloat(insights.spend || 0);
        const impressions = parseInt(insights.impressions || 0);
        const clicks = parseInt(insights.clicks || 0);
        const ctr = parseFloat(insights.ctr || 0);
        const cpc = parseFloat(insights.cpc || 0);
        const cpm = parseFloat(insights.cpm || 0);
        
        // Video engagement metrics
        const videoViews = parseInt(insights.video_30_sec_watched_actions?.[0]?.value || 0);
        const thruPlays = parseInt(insights.video_thruplay_watched_actions?.[0]?.value || 0);
        const avgWatchTime = parseFloat(insights.video_avg_time_watched_actions?.[0]?.value || 0);
        
        // Calculate hook rate (3-second video views / impressions)
        const hookRate = impressions > 0 ? (videoViews / impressions) * 100 : 0;
        
        // Calculate completion rate
        const completionRate = videoViews > 0 ? (thruPlays / videoViews) * 100 : 0;
        
        // Determine creative type
        const isVideo = creative.video_id || creative.object_story_spec?.video_data;
        const creativeType = isVideo ? 'video' : 'image';
        
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
        
        if (hookRate < 10 && isVideo) {
          insights_recommendations.push({
            type: 'warning',
            message: 'Low hook rate - First 3 seconds need improvement'
          });
        }
        
        if (completionRate < 50 && isVideo) {
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
        
        if (performanceScore >= 70) {
          insights_recommendations.push({
            type: 'success',
            message: 'Strong performer - Consider scaling or using as creative template'
          });
        }
        
        creativeData.push({
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
          insights: insights_recommendations
        });
      } catch (error) {
        console.error(`Error processing ad ${ad.id}:`, error.message);
      }
    }
    
    // Sort by performance score descending
    creativeData.sort((a, b) => b.performance_score - a.performance_score);
    
    res.json(creativeData);
  } catch (error) {
    console.error('Error fetching creative data:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
}
