// api/video-analysis.js - FIXED Video Hook Analysis
export default async function handler(req, res) {
  try {
    const { video_id, ad_id } = req.query;
    
    if (!video_id && !ad_id) {
      return res.status(400).json({ error: 'video_id or ad_id is required' });
    }

    // Get ad performance data with proper error handling
    let adPerformance = {};
    let actualVideoId = video_id;
    
    if (ad_id) {
      const adUrl = `https://graph.facebook.com/v18.0/${ad_id}?fields=creative{video_id},insights{impressions,clicks,ctr,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,video_30_sec_watched_actions,video_avg_time_watched_actions,video_thruplay_watched_actions}&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
      
      const response = await fetch(adUrl);
      const result = await response.json();
      
      if (response.ok) {
        adPerformance = result;
        if (!actualVideoId && result.creative?.video_id) {
          actualVideoId = result.creative.video_id;
        }
      }
    }

    // Calculate hook performance metrics with PROPER math
    const insights = adPerformance.insights?.data[0] || {};
    const impressions = parseInt(insights.impressions || 0);
    const clicks = parseInt(insights.clicks || 0);
    const ctr = parseFloat(insights.ctr || 0);

    // Video engagement breakdown - FIXED calculations
    const videoViews = parseInt(insights.video_30_sec_watched_actions?.[0]?.value || 0);
    const p25Views = parseInt(insights.video_p25_watched_actions?.[0]?.value || 0);
    const p50Views = parseInt(insights.video_p50_watched_actions?.[0]?.value || 0);
    const p75Views = parseInt(insights.video_p75_watched_actions?.[0]?.value || 0);
    const p100Views = parseInt(insights.video_p100_watched_actions?.[0]?.value || 0);
    const thruPlays = parseInt(insights.video_thruplay_watched_actions?.[0]?.value || 0);
    const avgWatchTime = parseFloat(insights.video_avg_time_watched_actions?.[0]?.value || 0);

    // FIXED: Calculate hook rates properly (all should be ≤ 100%)
    const hookAnalysis = {
      // Initial hook: people who started watching vs total impressions
      initial_hook: impressions > 0 ? Math.min((videoViews / impressions) * 100, 100) : 0,
      
      // Retention rates: people who watched to X% vs people who started watching
      retention_25pct: videoViews > 0 ? Math.min((p25Views / videoViews) * 100, 100) : 0,
      retention_50pct: videoViews > 0 ? Math.min((p50Views / videoViews) * 100, 100) : 0,
      retention_75pct: videoViews > 0 ? Math.min((p75Views / videoViews) * 100, 100) : 0,
      completion_rate: videoViews > 0 ? Math.min((p100Views / videoViews) * 100, 100) : 0,
      thruplay_rate: videoViews > 0 ? Math.min((thruPlays / videoViews) * 100, 100) : 0,
      
      // Raw numbers for context
      raw_data: {
        impressions,
        video_views: videoViews,
        p25_views: p25Views,
        p50_views: p50Views,
        p75_views: p75Views,
        p100_views: p100Views,
        thru_plays: thruPlays,
        avg_watch_time: avgWatchTime
      }
    };

    // Analyze hook performance patterns with ACTIONABLE insights
    const hookInsights = [];

    // Hook analysis with context
    if (hookAnalysis.initial_hook >= 15) {
      hookInsights.push({
        type: 'success',
        category: 'hook',
        severity: 'high',
        message: `STRONG HOOK: ${hookAnalysis.initial_hook.toFixed(1)}% of people stop scrolling`,
        recommendation: 'This hook works! Use similar opening elements in other creatives',
        action: 'Scale this creative and create variations'
      });
    } else if (hookAnalysis.initial_hook >= 8) {
      hookInsights.push({
        type: 'warning',
        category: 'hook',
        severity: 'medium',
        message: `AVERAGE HOOK: ${hookAnalysis.initial_hook.toFixed(1)}% hook rate`,
        recommendation: 'Hook needs improvement - test stronger opening',
        action: 'A/B test different first 3 seconds'
      });
    } else {
      hookInsights.push({
        type: 'error',
        category: 'hook',
        severity: 'high',
        message: `WEAK HOOK: Only ${hookAnalysis.initial_hook.toFixed(1)}% stop scrolling`,
        recommendation: 'Hook failing - needs complete redesign',
        action: 'Test pattern interrupt, bold statements, or curiosity gaps'
      });
    }

    // Retention analysis with drop-off points
    if (hookAnalysis.retention_25pct < 60) {
      const dropOff = 100 - hookAnalysis.retention_25pct;
      hookInsights.push({
        type: 'error',
        category: 'early_retention',
        severity: 'high',
        message: `EARLY DROP-OFF: ${dropOff.toFixed(1)}% leave in first 25%`,
        recommendation: 'Content after hook is not engaging enough',
        action: 'Front-load most compelling content in first 5-10 seconds'
      });
    }

    // Mid-video retention
    if (hookAnalysis.retention_50pct < hookAnalysis.retention_25pct * 0.7) {
      hookInsights.push({
        type: 'warning',
        category: 'mid_retention',
        severity: 'medium',
        message: 'SIGNIFICANT MID-VIDEO DROP: Losing viewers halfway through',
        recommendation: 'Video may be too long or lose focus',
        action: 'Add mid-video hook or cut to shorter format'
      });
    }

    // Completion analysis
    if (hookAnalysis.completion_rate >= 40) {
      hookInsights.push({
        type: 'success',
        category: 'completion',
        severity: 'low',
        message: `HIGH COMPLETION: ${hookAnalysis.completion_rate.toFixed(1)}% watch to end`,
        recommendation: 'Strong storytelling throughout',
        action: 'Use this video structure as template'
      });
    } else if (hookAnalysis.completion_rate < 15) {
      hookInsights.push({
        type: 'error',
        category: 'completion',
        severity: 'medium',
        message: `LOW COMPLETION: Only ${hookAnalysis.completion_rate.toFixed(1)}% finish`,
        recommendation: 'Video too long or lacks payoff',
        action: 'Test 15-second version or stronger conclusion'
      });
    }

    // Performance correlation with CTR
    if (ctr >= 2 && hookAnalysis.initial_hook >= 10) {
      hookInsights.push({
        type: 'success',
        category: 'performance',
        severity: 'high',
        message: 'WINNING COMBO: Strong hook + high CTR',
        recommendation: 'This creative style is working well',
        action: 'Scale budget and create similar variations'
      });
    } else if (ctr < 1 && hookAnalysis.initial_hook < 8) {
      hookInsights.push({
        type: 'error',
        category: 'performance',
        severity: 'high',
        message: 'POOR PERFORMANCE: Low hook rate + low CTR',
        recommendation: 'Creative not resonating with audience',
        action: 'Pause and create new creative with different approach'
      });
    }

    // Simulated video content analysis (in real implementation, use computer vision APIs)
    const mockVideoElements = {
      duration: Math.max(avgWatchTime, 15), // Estimate duration
      content_analysis: {
        has_text_overlay: Math.random() > 0.3,
        has_human_face: Math.random() > 0.4,
        has_product_shot: Math.random() > 0.6,
        has_logo: Math.random() > 0.5,
        scene_changes: Math.floor(Math.random() * 5) + 2,
        primary_colors: ['#FF6B6B', '#4ECDC4', '#45B7D1'][Math.floor(Math.random() * 3)]
      },
      audio_analysis: {
        has_voiceover: Math.random() > 0.4,
        has_background_music: Math.random() > 0.3,
        audio_energy_level: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
        silence_periods: Math.floor(Math.random() * 3)
      }
    };

    // Element performance correlation
    const elementPerformance = [];
    
    if (mockVideoElements.content_analysis.has_text_overlay) {
      elementPerformance.push({
        element: 'Text Overlay',
        timestamp: '0-3s',
        performance_impact: hookAnalysis.initial_hook >= 10 ? 'positive' : 'negative',
        insight: hookAnalysis.initial_hook >= 10 ? 
          'Text overlay helps grab attention in first 3 seconds' : 
          'Text overlay not compelling enough to stop scroll',
        recommendation: hookAnalysis.initial_hook >= 10 ? 
          'Keep using text overlays in similar style' : 
          'Test bolder, more curiosity-driven text hooks'
      });
    }

    if (mockVideoElements.content_analysis.has_human_face) {
      elementPerformance.push({
        element: 'Human Presenter',
        timestamp: '0-5s',
        performance_impact: hookAnalysis.retention_25pct >= 60 ? 'positive' : 'neutral',
        insight: hookAnalysis.retention_25pct >= 60 ? 
          'Human face helps maintain early engagement' : 
          'Presenter not engaging enough or appears too late',
        recommendation: hookAnalysis.retention_25pct >= 60 ? 
          'Continue using human presenters' : 
          'Test more dynamic presenter or different timing'
      });
    }

    if (mockVideoElements.audio_analysis.has_voiceover) {
      elementPerformance.push({
        element: 'Voiceover',
        timestamp: 'Throughout',
        performance_impact: hookAnalysis.retention_50pct >= 50 ? 'positive' : 'negative',
        insight: hookAnalysis.retention_50pct >= 50 ? 
          'Voiceover keeps viewers engaged throughout' : 
          'Voiceover may be boring or too slow',
        recommendation: hookAnalysis.retention_50pct >= 50 ? 
          'Similar voiceover style works well' : 
          'Test faster pace, different voice, or music-only'
      });
    }

    // Generate specific optimization tips based on performance
    const optimizationTips = [];

    if (hookAnalysis.initial_hook < 8) {
      optimizationTips.push({
        priority: 'CRITICAL',
        category: 'Hook Improvement',
        tip: 'Use pattern interrupt in first frame',
        specific_actions: [
          'Start with unexpected visual or statement',
          'Use bold text overlay with curiosity gap',
          'Show transformation result first',
          'Ask engaging question immediately'
        ],
        expected_impact: '+5-10% hook rate'
      });
    }

    if (hookAnalysis.retention_25pct < 50) {
      optimizationTips.push({
        priority: 'HIGH',
        category: 'Early Content',
        tip: 'Front-load most compelling content',
        specific_actions: [
          'Move best testimonial to first 5 seconds',
          'Show before/after immediately',
          'Lead with biggest benefit/result',
          'Use "watch what happens next" approach'
        ],
        expected_impact: '+10-20% early retention'
      });
    }

    if (hookAnalysis.completion_rate < 25) {
      optimizationTips.push({
        priority: 'MEDIUM',
        category: 'Video Length',
        tip: 'Optimize video duration',
        specific_actions: [
          'Test 15-second version',
          'Cut out middle sections',
          'End with strong CTA at peak engagement',
          'Create series of shorter videos'
        ],
        expected_impact: '+15-30% completion rate'
      });
    }

    // Performance benchmarking with industry standards
    const benchmarks = {
      hook_rate: { excellent: 15, good: 8, poor: 4 },
      retention_25: { excellent: 70, good: 50, poor: 30 },
      retention_50: { excellent: 50, good: 35, poor: 20 },
      completion: { excellent: 40, good: 20, poor: 10 }
    };

    // FIXED: Proper grade calculation
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

    // FIXED: Overall score calculation (0-100)
    const overallScore = Math.round(
      (Math.min(hookAnalysis.initial_hook / benchmarks.hook_rate.excellent, 1) * 30) +
      (Math.min(hookAnalysis.retention_25pct / benchmarks.retention_25.excellent, 1) * 25) +
      (Math.min(hookAnalysis.retention_50pct / benchmarks.retention_50.excellent, 1) * 25) +
      (Math.min(hookAnalysis.completion_rate / benchmarks.completion.excellent, 1) * 20)
    );

    res.json({
      video_id: actualVideoId,
      ad_id,
      hook_analysis: hookAnalysis,
      performance_grades: performanceGrade,
      overall_score: overallScore,
      video_content: mockVideoElements,
      element_performance: elementPerformance,
      insights: hookInsights,
      optimization_tips: optimizationTips,
      benchmarks,
      analysis_timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in video analysis:', error);
    res.status(500).json({
      error: error.message,
      details: 'Video analysis failed'
    });
  }
}
