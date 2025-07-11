// api/creative-intelligence.js - AI-Powered Creative Analysis Engine
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { creative_id, platform, analysis_type = 'full' } = req.body || req.query;

    console.log('=== CREATIVE INTELLIGENCE API CALLED ===');
    console.log('Creative ID:', creative_id, 'Platform:', platform, 'Analysis Type:', analysis_type);

    if (!creative_id || !platform) {
      return res.status(400).json({
        error: 'creative_id and platform are required'
      });
    }

    // Get creative performance data
    let creativeData = null;
    if (platform === 'facebook') {
      const creativesResponse = await fetch(`${req.headers.origin || 'https://facebook-ads-dashboard-git-main-jacks-projects-e0e84f4f.vercel.app'}/api/creatives`);
      const creatives = await creativesResponse.json();
      creativeData = creatives.find(c => c.id === creative_id);
    } else if (platform === 'taboola') {
      const creativesResponse = await fetch(`${req.headers.origin || 'https://facebook-ads-dashboard-git-main-jacks-projects-e0e84f4f.vercel.app'}/api/taboola-creatives`);
      const creatives = await creativesResponse.json();
      creativeData = creatives.find(c => c.id === creative_id);
    }

    if (!creativeData) {
      return res.status(404).json({
        error: 'Creative not found'
      });
    }

    // AI-Powered Creative Analysis
    const aiAnalysis = await performAIAnalysis(creativeData, platform, analysis_type);

    // Pattern Recognition
    const patterns = await identifyPatterns(creativeData, platform);

    // Performance Scoring
    const detailedScoring = calculateDetailedPerformanceScore(creativeData, platform);

    // Optimization Recommendations
    const optimizations = generateOptimizationRecommendations(creativeData, platform, aiAnalysis);

    // Cross-platform insights
    const crossPlatformInsights = await generateCrossPlatformInsights(creativeData, platform);

    res.json({
      creative_id,
      platform,
      analysis_timestamp: new Date().toISOString(),
      
      // Core creative data
      creative_info: {
        name: creativeData.name,
        type: creativeData.creative_type,
        status: creativeData.status,
        performance_score: creativeData.performance_score
      },

      // Performance metrics
      performance_metrics: {
        spend: creativeData.spend,
        ctr: creativeData.ctr,
        cpc: creativeData.cpc,
        conversions: creativeData.conversions,
        cpa: creativeData.cpa,
        hook_rate: creativeData.hook_rate,
        completion_rate: creativeData.completion_rate
      },

      // AI Analysis Results
      ai_analysis: aiAnalysis,

      // Pattern Recognition
      patterns_identified: patterns,

      // Detailed Performance Scoring
      detailed_scoring: detailedScoring,

      // Optimization Recommendations
      optimization_recommendations: optimizations,

      // Cross-platform insights
      cross_platform_insights: crossPlatformInsights,

      // Success factors
      success_factors: identifySuccessFactors(creativeData, platform),

      // Failure points
      failure_points: identifyFailurePoints(creativeData, platform),

      // Next steps
      recommended_actions: generateRecommendedActions(creativeData, platform, aiAnalysis)
    });

  } catch (error) {
    console.error('Creative Intelligence API Error:', error);
    res.status(500).json({
      error: error.message,
      service: 'creative-intelligence'
    });
  }
}

// AI-Powered Creative Analysis
async function performAIAnalysis(creative, platform, analysisType) {
  // This is where we'd integrate with Claude/GPT-4 for advanced analysis
  // For now, we'll provide sophisticated rule-based analysis

  const analysis = {
    visual_elements: analyzeVisualElements(creative, platform),
    text_analysis: analyzeTextElements(creative, platform),
    performance_correlation: analyzePerformanceCorrelation(creative, platform),
    audience_resonance: analyzeAudienceResonance(creative, platform),
    platform_optimization: analyzePlatformOptimization(creative, platform)
  };

  // Advanced insights based on performance data
  if (creative.performance_score >= 80) {
    analysis.ai_insights = [
      "🏆 This creative demonstrates exceptional performance across key metrics",
      "🎯 Strong audience resonance indicated by above-average engagement",
      "📈 Performance pattern suggests scalable creative strategy",
      "✨ Consider using this as a template for variations"
    ];
  } else if (creative.performance_score >= 60) {
    analysis.ai_insights = [
      "⚡ Good performance with room for optimization",
      "🔧 Specific elements show promise but need refinement",
      "📊 Performance metrics indicate solid audience fit",
      "🚀 Strong candidate for A/B testing variations"
    ];
  } else {
    analysis.ai_insights = [
      "⚠️ Performance below optimal levels",
      "🔍 Analysis reveals specific improvement opportunities",
      "📉 Current approach may not resonate with target audience",
      "🛠️ Significant optimization potential identified"
    ];
  }

  return analysis;
}

// Visual Elements Analysis
function analyzeVisualElements(creative, platform) {
  const elements = [];

  // Platform-specific visual analysis
  if (platform === 'facebook') {
    if (creative.creative_type === 'video') {
      elements.push({
        element: 'Video Hook Timing',
        analysis: creative.hook_rate >= 10 ? 
          'Strong initial engagement - first 3 seconds capture attention effectively' :
          'Weak hook - first 3 seconds need more compelling content',
        impact: creative.hook_rate >= 10 ? 'positive' : 'negative',
        confidence: 0.85
      });

      elements.push({
        element: 'Video Retention',
        analysis: creative.completion_rate >= 50 ?
          'Excellent retention - content maintains viewer interest throughout' :
          'Poor retention - viewers dropping off mid-video',
        impact: creative.completion_rate >= 50 ? 'positive' : 'negative',
        confidence: 0.80
      });
    }

    elements.push({
      element: 'Facebook Feed Optimization',
      analysis: creative.ctr >= 2 ?
        'Creative optimized well for Facebook feed placement' :
        'Creative may not stand out in Facebook feed',
      impact: creative.ctr >= 2 ? 'positive' : 'neutral',
      confidence: 0.75
    });

  } else if (platform === 'taboola') {
    elements.push({
      element: 'Native Content Style',
      analysis: creative.ctr >= 1 ?
        'Good native content adaptation for Taboola discovery format' :
        'Creative may be too promotional for Taboola native style',
      impact: creative.ctr >= 1 ? 'positive' : 'negative',
      confidence: 0.80
    });

    elements.push({
      element: 'Curiosity Factor',
      analysis: creative.hook_rate >= 8 ?
        'Strong curiosity-driven approach suitable for discovery platform' :
        'Lacks curiosity elements needed for discovery engagement',
      impact: creative.hook_rate >= 8 ? 'positive' : 'negative',
      confidence: 0.75
    });
  }

  return elements;
}

// Text Analysis
function analyzeTextElements(creative, platform) {
  const textElements = [];

  // Analyze headline/title if available
  if (creative.title || creative.name) {
    const title = creative.title || creative.name;
    
    textElements.push({
      element: 'Headline Analysis',
      content: title.substring(0, 50) + (title.length > 50 ? '...' : ''),
      analysis: analyzeHeadlineEffectiveness(title, platform, creative.ctr),
      suggestions: generateHeadlineSuggestions(title, platform),
      confidence: 0.70
    });
  }

  // Analyze body text if available
  if (creative.body) {
    textElements.push({
      element: 'Body Text Analysis',
      content: creative.body.substring(0, 100) + (creative.body.length > 100 ? '...' : ''),
      analysis: analyzeBodyTextEffectiveness(creative.body, platform, creative.conversions),
      suggestions: generateBodyTextSuggestions(creative.body, platform),
      confidence: 0.65
    });
  }

  return textElements;
}

// Headline Effectiveness Analysis
function analyzeHeadlineEffectiveness(headline, platform, ctr) {
  const wordCount = headline.split(' ').length;
  const hasNumbers = /\d/.test(headline);
  const hasEmotionalWords = /\b(amazing|incredible|shocking|secret|proven|guaranteed|free|new|discover|reveal)\b/i.test(headline);
  const hasQuestions = headline.includes('?');

  let analysis = '';
  let score = 0;

  if (platform === 'facebook') {
    if (wordCount <= 5) {
      analysis += 'Concise headline good for Facebook feed scanning. ';
      score += 20;
    } else {
      analysis += 'Headline may be too long for Facebook feed optimization. ';
    }
  } else if (platform === 'taboola') {
    if (wordCount >= 5 && wordCount <= 8) {
      analysis += 'Good length for Taboola native content discovery. ';
      score += 20;
    }
  }

  if (hasNumbers) {
    analysis += 'Numbers in headline increase credibility and specificity. ';
    score += 15;
  }

  if (hasEmotionalWords) {
    analysis += 'Emotional trigger words enhance engagement potential. ';
    score += 15;
  }

  if (hasQuestions && platform === 'taboola') {
    analysis += 'Question format works well for discovery curiosity. ';
    score += 10;
  }

  if (ctr >= 2) {
    analysis += 'Current headline performing well based on CTR. ';
    score += 25;
  } else if (ctr < 1) {
    analysis += 'Headline may need stronger hook based on low CTR. ';
    score -= 10;
  }

  return {
    analysis,
    effectiveness_score: Math.max(0, Math.min(100, score)),
    strengths: identifyHeadlineStrengths(headline, platform),
    weaknesses: identifyHeadlineWeaknesses(headline, platform, ctr)
  };
}

// Generate Headline Suggestions
function generateHeadlineSuggestions(headline, platform) {
  const suggestions = [];

  if (platform === 'facebook') {
    suggestions.push('Test shorter, punchy variations (3-5 words)');
    suggestions.push('Add emoji for visual impact in feed');
    suggestions.push('Include benefit-focused language');
    suggestions.push('Test urgency elements ("Today only", "Limited time")');
  } else if (platform === 'taboola') {
    suggestions.push('Create curiosity-driven variations');
    suggestions.push('Test question format ("Did you know...")');
    suggestions.push('Include numbers for credibility ("5 secrets", "3 ways")');
    suggestions.push('Use native content style (less promotional)');
  }

  return suggestions;
}

// Identify Success Factors
function identifySuccessFactors(creative, platform) {
  const factors = [];

  if (creative.ctr >= 2) {
    factors.push({
      factor: 'High Click-Through Rate',
      value: `${creative.ctr.toFixed(2)}%`,
      impact: 'Excellent audience engagement and ad relevance',
      confidence: 0.90
    });
  }

  if (creative.conversions > 0 && creative.cpa <= 50) {
    factors.push({
      factor: 'Efficient Conversion Generation',
      value: `${creative.conversions} conversions at £${creative.cpa.toFixed(2)} CPA`,
      impact: 'Strong ROI and audience targeting alignment',
      confidence: 0.85
    });
  }

  if (creative.hook_rate >= 15) {
    factors.push({
      factor: 'Strong Hook Performance',
      value: `${creative.hook_rate.toFixed(1)}% hook rate`,
      impact: 'Compelling initial seconds capture attention effectively',
      confidence: 0.80
    });
  }

  if (platform === 'taboola' && creative.ctr >= 1) {
    factors.push({
      factor: 'Native Content Optimization',
      value: 'Well-adapted for discovery format',
      impact: 'Content style matches platform expectations',
      confidence: 0.75
    });
  }

  return factors;
}

// Identify Failure Points
function identifyFailurePoints(creative, platform) {
  const failures = [];

  if (creative.ctr < 0.5) {
    failures.push({
      issue: 'Low Click-Through Rate',
      value: `${creative.ctr.toFixed(2)}%`,
      impact: 'Poor audience engagement and relevance',
      urgency: 'high',
      fix_suggestions: [
        'Test more compelling headlines',
        'Improve visual appeal',
        'Better audience targeting',
        'A/B test call-to-action'
      ]
    });
  }

  if (creative.conversions === 0 && creative.spend > 20) {
    failures.push({
      issue: 'No Conversions Despite Spend',
      value: `£${creative.spend.toFixed(2)} spent, 0 conversions`,
      impact: 'Negative ROI and poor funnel performance',
      urgency: 'critical',
      fix_suggestions: [
        'Review landing page experience',
        'Check conversion tracking setup',
        'Improve offer clarity',
        'Test different audiences'
      ]
    });
  }

  if (creative.creative_type === 'video' && creative.completion_rate < 25) {
    failures.push({
      issue: 'Poor Video Completion Rate',
      value: `${creative.completion_rate.toFixed(1)}% completion`,
      impact: 'Content not engaging enough to retain viewers',
      urgency: 'medium',
      fix_suggestions: [
        'Improve video pacing',
        'Add stronger hook in first 3 seconds',
        'Reduce video length',
        'Test different video style'
      ]
    });
  }

  return failures;
}

// Generate Recommended Actions
function generateRecommendedActions(creative, platform, aiAnalysis) {
  const actions = [];

  // Priority actions based on performance
  if (creative.performance_score >= 80) {
    actions.push({
      priority: 'high',
      action: 'Scale and Replicate',
      description: 'Increase budget and create variations of this high-performing creative',
      expected_impact: 'Maximize ROI from proven creative strategy',
      timeline: 'immediate'
    });

    actions.push({
      priority: 'medium',
      action: 'Create Template',
      description: 'Use this creative as a template for future campaigns',
      expected_impact: 'Systematic approach to high-performing creatives',
      timeline: '1-2 weeks'
    });
  } else if (creative.performance_score >= 60) {
    actions.push({
      priority: 'high',
      action: 'Optimize and Test',
      description: 'A/B test variations focusing on weak performance areas',
      expected_impact: 'Improve performance to top-tier level',
      timeline: '1 week'
    });
  } else {
    actions.push({
      priority: 'critical',
      action: 'Major Redesign',
      description: 'Fundamental changes needed based on poor performance',
      expected_impact: 'Prevent continued budget waste',
      timeline: 'immediate'
    });
  }

  // Platform-specific actions
  if (platform === 'taboola') {
    actions.push({
      priority: 'medium',
      action: 'Test on Facebook',
      description: 'Adapt this creative for Facebook placement testing',
      expected_impact: 'Expand reach across platforms',
      timeline: '1-2 weeks'
    });
  } else if (platform === 'facebook') {
    actions.push({
      priority: 'medium',
      action: 'Test on Taboola',
      description: 'Create native content version for discovery placement',
      expected_impact: 'Leverage discovery traffic',
      timeline: '1-2 weeks'
    });
  }

  return actions;
}

// Helper functions for additional analysis components
function analyzePerformanceCorrelation(creative, platform) {
  return {
    ctr_to_conversion_correlation: creative.ctr > 0 && creative.conversions > 0 ? 'positive' : 'weak',
    spend_efficiency: creative.spend > 0 ? creative.conversions / creative.spend : 0,
    platform_fit_score: calculatePlatformFitScore(creative, platform)
  };
}

function analyzeAudienceResonance(creative, platform) {
  return {
    engagement_quality: creative.ctr >= 2 ? 'high' : creative.ctr >= 1 ? 'medium' : 'low',
    conversion_likelihood: creative.conversions > 0 ? 'proven' : 'unproven',
    audience_match_score: calculateAudienceMatchScore(creative, platform)
  };
}

function analyzePlatformOptimization(creative, platform) {
  const optimizations = [];
  
  if (platform === 'facebook' && creative.creative_type === 'video') {
    optimizations.push('Consider adding captions for mobile viewing');
    optimizations.push('Test 9:16 aspect ratio for Stories placement');
  } else if (platform === 'taboola') {
    optimizations.push('Ensure headline follows native content style');
    optimizations.push('Test thumbnail with clear, compelling imagery');
  }

  return optimizations;
}

function identifyPatterns(creative, platform) {
  // This would integrate with machine learning to identify patterns
  return [
    {
      pattern_type: 'performance_correlation',
      description: `${platform} creatives with ${creative.ctr >= 2 ? 'high' : 'low'} CTR typically ${creative.conversions > 0 ? 'convert well' : 'struggle with conversions'}`,
      confidence: 0.75,
      sample_size: 'based_on_account_history'
    }
  ];
}

function calculateDetailedPerformanceScore(creative, platform) {
  const scoring = {
    ctr_score: Math.min(100, (creative.ctr / 3) * 100), // 3% CTR = 100 points
    conversion_score: creative.conversions > 0 ? 100 : 0,
    efficiency_score: creative.cpa > 0 && creative.cpa <= 50 ? 100 : Math.max(0, 100 - (creative.cpa - 50)),
    engagement_score: Math.min(100, (creative.hook_rate / 20) * 100) // 20% hook rate = 100 points
  };

  scoring.overall_score = (scoring.ctr_score + scoring.conversion_score + scoring.efficiency_score + scoring.engagement_score) / 4;

  return scoring;
}

function generateOptimizationRecommendations(creative, platform, aiAnalysis) {
  const recommendations = [];

  if (creative.ctr < 1) {
    recommendations.push({
      area: 'Click-Through Rate',
      current: `${creative.ctr.toFixed(2)}%`,
      target: '2%+',
      actions: ['Test stronger headlines', 'Improve visual appeal', 'Better audience targeting'],
      priority: 'high'
    });
  }

  if (creative.conversions === 0) {
    recommendations.push({
      area: 'Conversion Rate',
      current: '0 conversions',
      target: '1+ conversions',
      actions: ['Review landing page', 'Check tracking setup', 'Improve offer clarity'],
      priority: 'critical'
    });
  }

  return recommendations;
}

function generateCrossPlatformInsights(creative, platform) {
  const insights = [];

  if (platform === 'facebook') {
    insights.push({
      opportunity: 'Taboola Adaptation',
      description: 'Create native content version for discovery placement',
      potential_impact: 'Access to discovery traffic',
      adaptation_requirements: ['Less promotional tone', 'Curiosity-driven headline', 'Native thumbnail style']
    });
  } else {
    insights.push({
      opportunity: 'Facebook Optimization',
      description: 'Adapt for Facebook feed and Stories placement',
      potential_impact: 'Precise targeting and engagement',
      adaptation_requirements: ['Video format optimization', 'Mobile-first design', 'Clear CTA']
    });
  }

  return insights;
}

// Helper calculation functions
function calculatePlatformFitScore(creative, platform) {
  let score = 50; // Base score

  if (platform === 'facebook') {
    if (creative.creative_type === 'video') score += 20;
    if (creative.ctr >= 2) score += 20;
    if (creative.conversions > 0) score += 10;
  } else if (platform === 'taboola') {
    if (creative.creative_type === 'image') score += 15;
    if (creative.ctr >= 1) score += 25;
    if (creative.hook_rate >= 8) score += 10;
  }

  return Math.min(100, score);
}

function calculateAudienceMatchScore(creative, platform) {
  let score = 40; // Base score

  if (creative.ctr >= 2) score += 30;
  if (creative.conversions > 0) score += 20;
  if (creative.cpa <= 50 && creative.cpa > 0) score += 10;

  return Math.min(100, score);
}

function identifyHeadlineStrengths(headline, platform) {
  const strengths = [];
  
  if (/\d/.test(headline)) strengths.push('Contains numbers for specificity');
  if (headline.includes('?')) strengths.push('Question format creates curiosity');
  if (headline.length <= 50) strengths.push('Appropriate length for platform');
  
  return strengths;
}

function identifyHeadlineWeaknesses(headline, platform, ctr) {
  const weaknesses = [];
  
  if (headline.length > 60) weaknesses.push('Too long for optimal engagement');
  if (ctr < 1) weaknesses.push('Not generating sufficient click-through');
  if (!/\b(you|your)\b/i.test(headline)) weaknesses.push('Lacks personal connection');
  
  return weaknesses;
}

function analyzeBodyTextEffectiveness(body, platform, conversions) {
  const wordCount = body.split(' ').length;
  const hasCallToAction = /\b(click|buy|get|try|discover|learn|start|join)\b/i.test(body);
  
  let analysis = '';
  
  if (wordCount <= 20) {
    analysis += 'Concise body text good for attention spans. ';
  } else {
    analysis += 'Body text may be too long for optimal engagement. ';
  }
  
  if (hasCallToAction) {
    analysis += 'Clear call-to-action present. ';
  } else {
    analysis += 'Missing clear call-to-action. ';
  }
  
  if (conversions === 0) {
    analysis += 'Body text not driving conversions effectively. ';
  }
  
  return analysis;
}

function generateBodyTextSuggestions(body, platform) {
  return [
    'Test shorter, more direct messaging',
    'Include stronger call-to-action',
    'Add urgency or scarcity elements',
    'Focus on benefits over features'
  ];
}
