// api/ai-creative-analyzer.js - Enhanced AI Analysis with OpenAI Integration
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { creative_id, creative_data, performance_data } = req.body || req.query;
    
    console.log('=== AI CREATIVE ANALYZER CALLED ===');
    console.log('Creative ID:', creative_id);
    console.log('Performance data:', performance_data);

    if (!creative_id || !creative_data) {
      return res.status(400).json({ 
        error: 'creative_id and creative_data are required',
        received: { creative_id: !!creative_id, creative_data: !!creative_data }
      });
    }

    // Check if OpenAI is available
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const openaiAvailable = !!OPENAI_API_KEY;
    
    console.log('OpenAI Available:', openaiAvailable);
    console.log('API Key length:', OPENAI_API_KEY ? OPENAI_API_KEY.length : 0);

    let aiAnalysis = null;
    
    // Real OpenAI Analysis if available
    if (openaiAvailable) {
      try {
        console.log('Calling OpenAI for creative analysis...');
        
        const openaiPrompt = `
Analyze this advertising creative for performance insights:

CREATIVE DATA:
- Name: ${creative_data.name || 'Unnamed'}
- Platform: ${creative_data.platform || 'Facebook'}
- Type: ${creative_data.creative_type || 'unknown'}
- Title: ${creative_data.title || 'N/A'}
- Description: ${creative_data.body || 'N/A'}

PERFORMANCE METRICS:
- CTR: ${performance_data?.ctr || 0}%
- Spend: £${performance_data?.spend || 0}
- Conversions: ${performance_data?.conversions || 0}
- Impressions: ${performance_data?.impressions || 0}

Please analyze WHY this creative is performing at this level. Consider:

1. VISUAL ELEMENTS: What visual components drive performance?
2. PSYCHOLOGICAL TRIGGERS: What emotions/motivations does it tap into?
3. HOOK STRENGTH: How compelling is the opening/headline?
4. TARGET AUDIENCE FIT: How well does it match audience psychology?
5. PLATFORM OPTIMIZATION: How well suited is it for the platform?

Provide specific, actionable insights about what's working or failing.

Respond in JSON format:
{
  "success_factors": [
    {"factor": "element_name", "impact_score": 0.8, "category": "visual|psychological|textual", "explanation": "why this works"}
  ],
  "failure_points": [
    {"issue": "problem_name", "severity": 0.6, "category": "visual|psychological|textual", "solution": "how to fix"}
  ],
  "psychological_analysis": {
    "primary_emotion": "emotion_name",
    "motivation_triggers": ["trigger1", "trigger2"],
    "audience_match": 0.7
  },
  "optimization_recommendations": [
    {"recommendation": "specific action", "expected_impact": 0.3, "priority": "high|medium|low"}
  ],
  "confidence_score": 0.85
}`;

        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: 'You are an expert advertising creative analyst specializing in performance marketing psychology. Analyze creatives to identify specific success factors and optimization opportunities.'
              },
              {
                role: 'user',
                content: openaiPrompt
              }
            ],
            temperature: 0.7,
            max_tokens: 1500
          })
        });

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          const analysisText = openaiData.choices[0].message.content;
          
          try {
            // Try to parse as JSON
            aiAnalysis = JSON.parse(analysisText);
            console.log('OpenAI analysis successful');
          } catch (parseError) {
            console.log('OpenAI response not JSON, using text analysis');
            // Fallback: parse the text response
            aiAnalysis = parseTextAnalysis(analysisText, performance_data);
          }
        } else {
          console.error('OpenAI API error:', openaiResponse.status);
        }
      } catch (openaiError) {
        console.error('OpenAI call failed:', openaiError.message);
      }
    }

    // Enhanced simulation if OpenAI unavailable or failed
    if (!aiAnalysis) {
      console.log('Using enhanced simulation analysis');
      aiAnalysis = generateEnhancedAnalysis(creative_data, performance_data);
    }

    // Calculate overall performance score
    const ctr = parseFloat(performance_data?.ctr || 0);
    const conversions = parseInt(performance_data?.conversions || 0);
    const spend = parseFloat(performance_data?.spend || 0);
    const impressions = parseInt(performance_data?.impressions || 0);

    const performanceScore = Math.min(100, Math.max(0,
      (ctr * 15) + // CTR weight
      (conversions * 10) + // Conversion weight  
      (impressions > 1000 ? 20 : impressions / 50) + // Volume weight
      (spend > 0 && conversions > 0 ? Math.min(25, (conversions * 50 / spend)) : 0) // Efficiency weight
    ));

    // Generate specific insights based on performance
    const insights = generatePerformanceInsights(creative_data, performance_data, performanceScore);

    // Final response
    const response = {
      creative_id,
      analysis_method: openaiAvailable ? 'openai_gpt4' : 'enhanced_simulation',
      openai_powered: openaiAvailable,
      confidence_score: aiAnalysis.confidence_score || (openaiAvailable ? 90 : 75),
      performance_score: performanceScore,
      
      // Core analysis
      success_factors: aiAnalysis.success_factors || [],
      failure_points: aiAnalysis.failure_points || [],
      psychological_analysis: aiAnalysis.psychological_analysis || {},
      optimization_recommendations: aiAnalysis.optimization_recommendations || [],
      
      // Performance insights
      performance_insights: insights,
      
      // Metadata
      analyzed_at: new Date().toISOString(),
      creative_metadata: {
        name: creative_data.name,
        platform: creative_data.platform,
        type: creative_data.creative_type,
        performance_tier: performanceScore >= 70 ? 'top' : performanceScore >= 40 ? 'mid' : 'low'
      }
    };

    console.log('=== AI ANALYSIS COMPLETE ===');
    console.log('Method:', response.analysis_method);
    console.log('Confidence:', response.confidence_score);
    console.log('Success factors:', response.success_factors.length);

    res.json(response);

  } catch (error) {
    console.error('AI Creative Analyzer error:', error);
    res.status(500).json({
      error: error.message,
      service: 'ai-creative-analyzer'
    });
  }
}

// Enhanced simulation analysis for fallback
function generateEnhancedAnalysis(creative_data, performance_data) {
  const ctr = parseFloat(performance_data?.ctr || 0);
  const conversions = parseInt(performance_data?.conversions || 0);
  const spend = parseFloat(performance_data?.spend || 0);
  
  const successFactors = [];
  const failurePoints = [];
  const recommendations = [];

  // Analyze based on creative name and content
  const name = (creative_data.name || '').toLowerCase();
  const title = (creative_data.title || '').toLowerCase();
  const body = (creative_data.body || '').toLowerCase();
  const content = `${name} ${title} ${body}`;

  // Visual/content analysis
  if (content.includes('dragon') || content.includes('magic') || content.includes('fantasy')) {
    successFactors.push({
      factor: 'fantasy_elements',
      impact_score: 0.85,
      category: 'visual',
      explanation: 'Fantasy elements like dragons create strong emotional engagement and memorable imagery'
    });
  }

  if (content.includes('shock') || content.includes('surprise') || content.includes('amazing')) {
    successFactors.push({
      factor: 'surprise_element',
      impact_score: 0.75,
      category: 'psychological',
      explanation: 'Surprise elements trigger pattern interrupts that capture attention in social feeds'
    });
  }

  if (content.includes('£') || content.includes('money') || content.includes('save') || content.includes('discount')) {
    successFactors.push({
      factor: 'financial_incentive',
      impact_score: 0.70,
      category: 'psychological',
      explanation: 'Financial triggers tap into loss aversion and value-seeking behavior'
    });
  }

  // Performance-based analysis
  if (ctr >= 2.0) {
    successFactors.push({
      factor: 'strong_hook',
      impact_score: 0.90,
      category: 'textual',
      explanation: 'High CTR indicates effective hook that stops the scroll and generates interest'
    });
  } else if (ctr < 0.5) {
    failurePoints.push({
      issue: 'weak_hook',
      severity: 0.8,
      category: 'textual',
      solution: 'Test question-based headlines, urgency language, or curiosity gaps'
    });
  }

  if (conversions === 0 && spend > 50) {
    failurePoints.push({
      issue: 'conversion_disconnect',
      severity: 0.9,
      category: 'psychological',
      solution: 'Audit landing page match, check conversion tracking, or test different CTA language'
    });
  }

  // Platform-specific insights
  if (creative_data.platform === 'Facebook') {
    if (creative_data.creative_type === 'video') {
      recommendations.push({
        recommendation: 'Add captions for silent viewing - 85% of Facebook videos are watched without sound',
        expected_impact: 0.4,
        priority: 'high'
      });
    }
  } else if (creative_data.platform === 'Taboola') {
    recommendations.push({
      recommendation: 'Test more curiosity-driven headlines - Taboola users respond to intrigue over direct selling',
      expected_impact: 0.3,
      priority: 'medium'
    });
  }

  return {
    success_factors: successFactors,
    failure_points: failurePoints,
    psychological_analysis: {
      primary_emotion: ctr > 1.5 ? 'curiosity' : 'indifference',
      motivation_triggers: extractMotivationTriggers(content),
      audience_match: Math.min(1.0, ctr / 2.0)
    },
    optimization_recommendations: recommendations,
    confidence_score: 0.75
  };
}

function extractMotivationTriggers(content) {
  const triggers = [];
  
  if (content.includes('free') || content.includes('save') || content.includes('discount')) {
    triggers.push('loss_aversion');
  }
  if (content.includes('limited') || content.includes('today') || content.includes('now')) {
    triggers.push('scarcity');
  }
  if (content.includes('people') || content.includes('others') || content.includes('everyone')) {
    triggers.push('social_proof');
  }
  if (content.includes('secret') || content.includes('trick') || content.includes('method')) {
    triggers.push('curiosity');
  }
  if (content.includes('guaranteed') || content.includes('proven') || content.includes('results')) {
    triggers.push('certainty');
  }

  return triggers;
}

function parseTextAnalysis(text, performance_data) {
  // Simple text parsing for non-JSON OpenAI responses
  try {
    const lines = text.split('\n').filter(line => line.trim());
    
    return {
      success_factors: [
        {
          factor: 'openai_identified_strength',
          impact_score: 0.8,
          category: 'psychological',
          explanation: text.substring(0, 200) + '...'
        }
      ],
      failure_points: [],
      psychological_analysis: {
        primary_emotion: 'analyzed_by_openai',
        motivation_triggers: ['openai_analysis'],
        audience_match: 0.8
      },
      optimization_recommendations: [
        {
          recommendation: 'Review full OpenAI analysis for detailed optimization suggestions',
          expected_impact: 0.5,
          priority: 'high'
        }
      ],
      confidence_score: 0.85
    };
  } catch (e) {
    return generateEnhancedAnalysis({}, performance_data);
  }
}

function generatePerformanceInsights(creative_data, performance_data, performanceScore) {
  const insights = [];
  
  const ctr = parseFloat(performance_data?.ctr || 0);
  const conversions = parseInt(performance_data?.conversions || 0);
  const spend = parseFloat(performance_data?.spend || 0);

  // Performance tier insights
  if (performanceScore >= 70) {
    insights.push({
      type: 'success',
      category: 'performance',
      message: `Top performer (${Math.round(performanceScore)}/100) - Scale this creative or use as template`,
      action: 'scale'
    });
  } else if (performanceScore >= 40) {
    insights.push({
      type: 'warning',
      category: 'performance', 
      message: `Mid-tier performer (${Math.round(performanceScore)}/100) - Test variations to optimize`,
      action: 'optimize'
    });
  } else {
    insights.push({
      type: 'error',
      category: 'performance',
      message: `Low performer (${Math.round(performanceScore)}/100) - Consider pausing or major revision`,
      action: 'revise'
    });
  }

  // CTR insights
  if (ctr >= 2.0) {
    insights.push({
      type: 'success',
      category: 'engagement',
      message: `Excellent CTR (${ctr.toFixed(2)}%) - Strong hook effectiveness`,
      action: 'replicate_hook'
    });
  } else if (ctr < 0.5) {
    insights.push({
      type: 'warning',
      category: 'engagement',
      message: `Low CTR (${ctr.toFixed(2)}%) - Hook needs improvement`,
      action: 'improve_hook'
    });
  }

  // Conversion insights
  if (conversions === 0 && spend > 30) {
    insights.push({
      type: 'error',
      category: 'conversion',
      message: 'No conversions with significant spend - Check tracking and landing page',
      action: 'audit_funnel'
    });
  }

  return insights;
}
