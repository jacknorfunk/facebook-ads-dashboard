// api/video-analysis.js - Video Hook Analysis Endpoint
export default async function handler(req, res) {
  try {
    const { video_id, ad_id } = req.query;
    
    if (!video_id && !ad_id) {
      return res.status(400).json({ error: 'video_id or ad_id is required' });
    }
    
    // Get video insights from Facebook
    let videoInsights = {};
    if (video_id) {
      const videoUrl = `https://graph.facebook.com/v18.0/${video_id}?fields=title,description,length,thumbnails,insights{video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_30_sec_watched_actions,video_avg_time_watched_actions,video_thruplay_watched_actions}&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
      
      const response = await fetch(videoUrl);
      const result = await response.json();
      
      if (response.ok) {
        videoInsights = result;
      }
    }
    
    // Get ad performance data
    let adPerformance = {};
    if (ad_id) {
      const adUrl = `https://graph.facebook.com/v18.0/${ad_id}?fields=creative{video_id},insights{impressions,clicks,ctr,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_30_sec_watched_actions,video_avg_time_watched_actions,video_thruplay_watched_actions}&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
      
      const response = await fetch(adUrl);
      const result = await response.json();
      
      if (response.ok) {
        adPerformance = result;
        if (!video_id && result.creative?.video_id) {
          video_id = result.creative.video_id;
        }
      }
    }
    
    // Calculate hook performance metrics
    const insights = adPerformance.insights?.data[0] || {};
    const impressions = parseInt(insights.impressions || 0);
    const clicks = parseInt(insights.clicks || 0);
    const ctr = parseFloat(insights.ctr || 0);
    
    // Video engagement breakdown
    const videoViews = parseInt(insights.video_30_sec_watched_actions?.[0]?.value || 0);
    const p25Views = parseInt(insights.video_p25_watched_actions?.[0]?.value || 0);
    const p50Views = parseInt(insights.video_p50_watched_actions?.[0]?.value || 0);
    const p75Views = parseInt(insights.video_p75_watched_actions?.[0]?.value || 0);
    const p100Views = parseInt(insights.video_p100_watched_actions?.[0]?.value || 0);
    const thruPlays = parseInt(insights.video_thruplay_watched_actions?.[0]?.value || 0);
    const avgWatchTime = parseFloat(insights.video_avg_time_watched_actions?.[0]?.value || 0);
    
    // Calculate hook rates by time segments
    const hookAnalysis = {
      initial_hook: impressions > 0 ? (videoViews / impressions) * 100 : 0,
      retention_3sec: videoViews > 0 ? (p25Views / videoViews) * 100 : 0,
      retention_25pct: videoViews > 0 ? (p25Views / videoViews) * 100 : 0,
      retention_50pct: videoViews > 0 ? (p50Views / videoViews) * 100 : 0,
      retention_75pct: videoViews > 0 ? (p75Views / videoViews) * 100 : 0,
      completion_rate: videoViews > 0 ? (p100Views / videoViews) * 100 : 0,
      thruplay_rate: videoViews > 0 ? (thruPlays / videoViews) * 100 : 0
    };
    
    // Analyze hook performance patterns
    const hookInsights = [];
    
    // Strong hook analysis
    if (hookAnalysis.initial_hook >= 15) {
      hookInsights.push({
        type: 'success',
        category: 'hook',
        message: `Strong initial hook (${hookAnalysis.initial_hook.toFixed(1)}%) - Video immediately captures attention`,
        recommendation: 'Use similar opening elements in other creatives'
      });
    } else if (hookAnalysis.initial_hook < 5) {
      hookInsights.push({
        type: 'error',
        category: 'hook',
        message: `Weak initial hook (${hookAnalysis.initial_hook.toFixed(1)}%) - First frame needs improvement`,
        recommendation: 'Test stronger opening visuals, text hooks, or immediate action'
      });
    }
    
    // Retention analysis
    if (hookAnalysis.retention_25pct >= 70) {
      hookInsights.push({
        type: 'success',
        category: 'retention',
        message: `Excellent early retention (${hookAnalysis.retention_25pct.toFixed(1)}%) - Content keeps viewers engaged`,
        recommendation: 'Analyze what happens in first 25% and replicate'
      });
    } else if (hookAnalysis.retention_25pct < 40) {
      hookInsights.push({
        type: 'warning',
        category: 'retention',
        message: `Poor early retention (${hookAnalysis.retention_25pct.toFixed(1)}%) - Viewers lose interest quickly`,
        recommendation: 'Front-load most compelling content earlier in video'
      });
    }
    
    // Mid-video analysis
    if (hookAnalysis.retention_50pct < hookAnalysis.retention_25pct * 0.6) {
      hookInsights.push({
        type: 'warning',
        category: 'retention',
        message: 'Significant drop-off at mid-point - Content may be too long or lose focus',
        recommendation: 'Consider shorter format or stronger mid-video hook'
      });
    }
    
    // Completion analysis
    if (hookAnalysis.completion_rate >= 50) {
      hookInsights.push({
        type: 'success',
        category: 'completion',
        message: `High completion rate (${hookAnalysis.completion_rate.toFixed(1)}%) - Strong storytelling throughout`,
        recommendation: 'Use this video structure as template for others'
      });
    } else if (hookAnalysis.completion_rate < 15) {
      hookInsights.push({
        type: 'error',
        category: 'completion',
        message: `Low completion rate (${hookAnalysis.completion_rate.toFixed(1)}%) - Video may be too long or lack payoff`,
        recommendation: 'Test shorter versions or stronger conclusion'
      });
    }
    
    // CTR correlation analysis
    if (ctr >= 2 && hookAnalysis.initial_hook >= 10) {
      hookInsights.push({
        type: 'success',
        category: 'correlation',
        message: 'Strong hook correlates with high CTR - This creative style is working',
        recommendation: 'Scale this creative and test variations'
      });
    }
    
    // Simulate video content analysis (in real implementation, you'd use computer vision)
    const mockVideoAnalysis = {
      duration: avgWatchTime > 0 ? Math.max(avgWatchTime, 15) : 30,
      detected_elements: [
        { element: 'Text Overlay', timestamp: 0, confidence: 0.9, description: 'Bold text appears in first 2 seconds' },
        { element: 'Human Face', timestamp: 1, confidence: 0.85, description: 'Person speaking to camera' },
        { element: 'Product Shot', timestamp: 5, confidence: 0.8, description: 'Product shown prominently' },
        { element: 'Call to Action', timestamp: 20, confidence: 0.75, description: 'CTA text overlay appears' }
      ],
      audio_analysis: {
        has_voiceover: true,
        has_music: true,
        audio_peaks: [0, 3, 8, 15], // Timestamps of audio emphasis
        silence_periods: [] // No significant silence
      },
      visual_analysis: {
        scene_changes: [0, 5, 12, 20], // When scenes change
        color_palette: ['#FF6B6B', '#4ECDC4', '#45B7D1'], // Dominant colors
        movement_intensity: 'high', // Camera movement/action level
        text_overlays: [
          { text: 'Amazing Results!', timestamp: 0, duration: 3 },
          { text: 'Order Now', timestamp: 20, duration: 5 }
        ]
      }
    };
    
    // Correlate video elements with performance
    const elementPerformance = mockVideoAnalysis.detected_elements.map(element => {
      let performance_impact = 'neutral';
      let insight = '';
      
      if (element.element === 'Text Overlay' && element.timestamp <= 2) {
        performance_impact = hookAnalysis.initial_hook >= 10 ? 'positive' : 'negative';
        insight = hookAnalysis.initial_hook >= 10 ? 
          'Early text overlay correlates with strong hook' : 
          'Text overlay not capturing attention effectively';
      } else if (element.element === 'Human Face' && element.timestamp <= 3) {
        performance_impact = hookAnalysis.retention_25pct >= 60 ? 'positive' : 'neutral';
        insight = hookAnalysis.retention_25pct >= 60 ? 
          'Human presenter helps maintain early engagement' : 
          'Consider more dynamic presenter or different approach';
      } else if (element.element === 'Product Shot') {
        performance_impact = hookAnalysis.retention_50pct >= 50 ? 'positive' : 'negative';
        insight = hookAnalysis.retention_50pct >= 50 ? 
          'Product reveal timing works well' : 
          'Product shown too late or not compelling enough';
      }
      
      return {
        ...element,
        performance_impact,
        insight
      };
    });
    
    // Generate hook optimization recommendations
    const optimizationTips = [];
    
    if (hookAnalysis.initial_hook < 10) {
      optimizationTips.push({
        priority: 'high',
        category: 'first_frame',
        tip: 'Use pattern interrupt in first frame',
        examples: ['Unexpected visual', 'Bold statement', 'Question that creates curiosity']
      });
    }
    
    if (hookAnalysis.retention_25pct < 50) {
      optimizationTips.push({
        priority: 'high',
        category: 'early_content',
        tip: 'Front-load your most compelling content',
        examples: ['Show the result first', 'Start with the problem', 'Use testimonial quote']
      });
    }
    
    if (hookAnalysis.completion_rate < 30) {
      optimizationTips.push({
        priority: 'medium',
        category: 'video_length',
        tip: 'Consider shorter format',
        examples: ['15-second version', 'Cut to highlights only', 'Multiple shorter videos']
      });
    }
    
    // Performance benchmarking
    const benchmarks = {
      hook_rate: { excellent: 15, good: 8, poor: 3 },
      retention_25: { excellent: 70, good: 50, poor: 30 },
      retention_50: { excellent: 50, good: 35, poor: 20 },
      completion: { excellent: 50, good: 25, poor: 10 }
    };
    
    const performanceGrade = {
      hook: hookAnalysis.initial_hook >= benchmarks.hook_rate.excellent ? 'A' :
            hookAnalysis.initial_hook >= benchmarks.hook_rate.good ? 'B' :
            hookAnalysis.initial_hook >= benchmarks.hook_rate.poor ? 'C' : 'D',
      retention: hookAnalysis.retention_25pct >= benchmarks.retention_25.excellent ? 'A' :
                hookAnalysis.retention_25pct >= benchmarks.retention_25.good ? 'B' :
                hookAnalysis.retention_25pct >= benchmarks.retention_25.poor ? 'C' : 'D',
      completion: hookAnalysis.completion_rate >= benchmarks.completion.excellent ? 'A' :
                 hookAnalysis.completion_rate >= benchmarks.completion.good ? 'B' :
                 hookAnalysis.completion_rate >= benchmarks.completion.poor ? 'C' : 'D'
    };
    
    res.json({
      video_id,
      ad_id,
      hook_analysis: hookAnalysis,
      performance_grades: performanceGrade,
      video_content: mockVideoAnalysis,
      element_performance: elementPerformance,
      insights: hookInsights,
      optimization_tips: optimizationTips,
      benchmarks,
      overall_score: Math.round((
        (hookAnalysis.initial_hook / benchmarks.hook_rate.excellent * 25) +
        (hookAnalysis.retention_25pct / benchmarks.retention_25.excellent * 25) +
        (hookAnalysis.retention_50pct / benchmarks.retention_50.excellent * 25) +
        (hookAnalysis.completion_rate / benchmarks.completion.excellent * 25)
      ))
    });
    
  } catch (error) {
    console.error('Error in video analysis:', error);
    res.status(500).json({ 
      error: error.message 
    });
  }
}
