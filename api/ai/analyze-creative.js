// /api/ai/analyze-creative.js
// Advanced AI-powered creative analysis using Claude API
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { 
            creatives, 
            analysisType = 'comprehensive',
            focusAreas = ['performance', 'optimization', 'scaling']
        } = req.body;

        if (!creatives || !Array.isArray(creatives)) {
            return res.status(400).json({
                success: false,
                error: 'Creatives array required'
            });
        }

        console.log(`🧠 Starting AI analysis of ${creatives.length} creatives`);

        const analysisResults = {};

        // Performance Pattern Analysis
        if (focusAreas.includes('performance')) {
            analysisResults.performance_patterns = await analyzePerformancePatterns(creatives);
        }

        // Creative Optimization Suggestions
        if (focusAreas.includes('optimization')) {
            analysisResults.optimization_suggestions = await generateOptimizationSuggestions(creatives);
        }

        // Scaling Opportunities
        if (focusAreas.includes('scaling')) {
            analysisResults.scaling_opportunities = await identifyScalingOpportunities(creatives);
        }

        // Headline Analysis
        if (focusAreas.includes('headlines')) {
            analysisResults.headline_insights = await analyzeHeadlinePatterns(creatives);
        }

        // Image Analysis (if image URLs provided)
        if (focusAreas.includes('images')) {
            analysisResults.image_insights = await analyzeImagePatterns(creatives);
        }

        // Correlation Matrix
        if (focusAreas.includes('correlations')) {
            analysisResults.correlation_matrix = generateCorrelationMatrix(creatives);
        }

        return res.json({
            success: true,
            analysis: analysisResults,
            metadata: {
                creatives_analyzed: creatives.length,
                analysis_type: analysisType,
                focus_areas: focusAreas,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ AI creative analysis error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug_info: {
                error_stack: error.stack,
                timestamp: new Date().toISOString()
            }
        });
    }
}

async function analyzePerformancePatterns(creatives) {
    try {
        // Prepare data for Claude analysis
        const topPerformers = creatives
            .filter(c => c.roas >= 1.5)
            .sort((a, b) => b.roas - a.roas)
            .slice(0, 10);

        const poorPerformers = creatives
            .filter(c => c.roas < 1.0)
            .sort((a, b) => a.roas - b.roas)
            .slice(0, 10);

        const prompt = `Analyze these ad creative performance patterns and identify what separates winners from losers:

TOP PERFORMERS (ROAS ≥ 1.5):
${topPerformers.map((c, i) => `
${i+1}. "${c.headline}"
   ROAS: ${c.roas.toFixed(2)}x | CTR: ${(c.ctr * 100).toFixed(2)}% | Spend: $${c.spend.toFixed(2)}
   Device: ${c.deviceType} | Conversions: ${c.conversions}
`).join('')}

POOR PERFORMERS (ROAS < 1.0):
${poorPerformers.map((c, i) => `
${i+1}. "${c.headline}"
   ROAS: ${c.roas.toFixed(2)}x | CTR: ${(c.ctr * 100).toFixed(2)}% | Spend: $${c.spend.toFixed(2)}
   Device: ${c.deviceType} | Conversions: ${c.conversions}
`).join('')}

Provide analysis in this JSON format:
{
  "winning_patterns": {
    "headline_structures": ["pattern1", "pattern2"],
    "emotional_triggers": ["trigger1", "trigger2"],
    "common_elements": ["element1", "element2"]
  },
  "losing_patterns": {
    "headline_issues": ["issue1", "issue2"],
    "performance_killers": ["killer1", "killer2"]
  },
  "key_insights": [
    "insight1",
    "insight2",
    "insight3"
  ],
  "action_items": [
    "action1",
    "action2",
    "action3"
  ]
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.`;

        const response = await callClaudeAPI({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1500,
            messages: [{ role: "user", content: prompt }]
        });

        return JSON.parse(response.content[0].text);
    } catch (error) {
        console.error('Performance pattern analysis error:', error);
        return { error: error.message };
    }
}

async function generateOptimizationSuggestions(creatives) {
    try {
        // Focus on mid-performing creatives with optimization potential
        const optimizationCandidates = creatives
            .filter(c => c.roas >= 0.8 && c.roas <= 2.0 && c.spend > 50)
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 8);

        if (optimizationCandidates.length === 0) {
            return { message: "No optimization candidates found" };
        }

        const prompt = `Generate specific optimization recommendations for these ad creatives:

${optimizationCandidates.map((c, i) => `
CREATIVE ${i+1}:
Headline: "${c.headline}"
Current Performance: ${c.roas.toFixed(2)}x ROAS, ${(c.ctr * 100).toFixed(2)}% CTR
Spend: $${c.spend.toFixed(2)} | Conversions: ${c.conversions}
Device: ${c.deviceType} | Status: ${c.status}
`).join('')}

For each creative, provide specific optimization suggestions. Return in this JSON format:
{
  "optimization_recommendations": [
    {
      "creative_id": "creative_identifier",
      "current_headline": "current headline",
      "issues_identified": ["issue1", "issue2"],
      "headline_variations": [
        {"variation": "new headline 1", "rationale": "why this will work"},
        {"variation": "new headline 2", "rationale": "why this will work"}
      ],
      "targeting_adjustments": ["adjustment1", "adjustment2"],
      "budget_recommendation": "increase/decrease/maintain",
      "priority": "high/medium/low",
      "expected_impact": "description of expected improvement"
    }
  ],
  "general_insights": [
    "insight1",
    "insight2"
  ]
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.`;

        const response = await callClaudeAPI({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            messages: [{ role: "user", content: prompt }]
        });

        return JSON.parse(response.content[0].text);
    } catch (error) {
        console.error('Optimization suggestions error:', error);
        return { error: error.message };
    }
}

async function identifyScalingOpportunities(creatives) {
    try {
        // Find high-performing, low-spend creatives
        const scalingCandidates = creatives
            .filter(c => c.roas >= 2.0 && c.spend < 1000 && c.conversions >= 3)
            .sort((a, b) => b.roas - a.roas)
            .slice(0, 10);

        if (scalingCandidates.length === 0) {
            return { message: "No scaling opportunities identified" };
        }

        const prompt = `Identify scaling opportunities for these high-performing, low-spend creatives:

${scalingCandidates.map((c, i) => `
SCALING CANDIDATE ${i+1}:
Headline: "${c.headline}"
Performance: ${c.roas.toFixed(2)}x ROAS, ${(c.ctr * 100).toFixed(2)}% CTR
Current Spend: $${c.spend.toFixed(2)} | Conversions: ${c.conversions}
Device: ${c.deviceType} | Geo: ${c.geo}
`).join('')}

Analyze each creative's scaling potential. Return in JSON format:
{
  "scaling_opportunities": [
    {
      "creative_id": "identifier",
      "headline": "headline text",
      "current_performance": {
        "roas": 0.00,
        "spend": 0.00,
        "conversions": 0
      },
      "scaling_recommendation": {
        "suggested_budget_increase": "percentage or amount",
        "rationale": "why this creative can scale",
        "risk_level": "low/medium/high",
        "expected_volume": "estimated additional conversions"
      },
      "expansion_strategies": [
        "strategy1",
        "strategy2"
      ],
      "monitoring_kpis": ["kpi1", "kpi2"],
      "priority_score": 0
    }
  ],
  "scaling_summary": {
    "total_opportunities": 0,
    "estimated_additional_spend": "$0",
    "projected_roas_range": "0.0x - 0.0x"
  }
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.`;

        const response = await callClaudeAPI({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            messages: [{ role: "user", content: prompt }]
        });

        return JSON.parse(response.content[0].text);
    } catch (error) {
        console.error('Scaling opportunities error:', error);
        return { error: error.message };
    }
}

async function analyzeHeadlinePatterns(creatives) {
    try {
        const headlines = creatives.map(c => ({
            headline: c.headline,
            roas: c.roas,
            ctr: c.ctr,
            conversions: c.conversions
        }));

        const prompt = `Analyze these ad headlines for performance patterns:

${headlines.map((h, i) => `
${i+1}. "${h.headline}"
   Performance: ${h.roas.toFixed(2)}x ROAS, ${(h.ctr * 100).toFixed(2)}% CTR, ${h.conversions} conv
`).join('')}

Identify patterns in high-performing vs low-performing headlines. Return JSON:
{
  "headline_analysis": {
    "high_performing_patterns": {
      "structures": ["pattern1", "pattern2"],
      "word_choices": ["word1", "word2"],
      "emotional_triggers": ["trigger1", "trigger2"],
      "length_insights": "insight about optimal length"
    },
    "low_performing_patterns": {
      "avoid_structures": ["pattern1", "pattern2"],
      "problematic_words": ["word1", "word2"],
      "common_mistakes": ["mistake1", "mistake2"]
    },
    "optimization_framework": {
      "testing_priorities": ["priority1", "priority2"],
      "a_b_test_ideas": [
        {"test_name": "test1", "hypothesis": "hypothesis1"},
        {"test_name": "test2", "hypothesis": "hypothesis2"}
      ]
    },
    "new_headline_suggestions": [
      {"headline": "suggestion1", "rationale": "why it should work"},
      {"headline": "suggestion2", "rationale": "why it should work"},
      {"headline": "suggestion3", "rationale": "why it should work"}
    ]
  }
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.`;

        const response = await callClaudeAPI({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            messages: [{ role: "user", content: prompt }]
        });

        return JSON.parse(response.content[0].text);
    } catch (error) {
        console.error('Headline analysis error:', error);
        return { error: error.message };
    }
}

async function analyzeImagePatterns(creatives) {
    try {
        // Filter creatives with image URLs
        const creativesWithImages = creatives.filter(c => c.imageUrl);
        
        if (creativesWithImages.length === 0) {
            return { message: "No creatives with images found for analysis" };
        }

        // For now, analyze based on headline patterns since we can't directly analyze images
        // In production, this would use Claude's vision capabilities
        const imageAnalysisPrompt = `Based on the headlines and performance of these creatives with images, infer image performance patterns:

${creativesWithImages.slice(0, 15).map((c, i) => `
${i+1}. Headline: "${c.headline}"
   Performance: ${c.roas.toFixed(2)}x ROAS, ${(c.ctr * 100).toFixed(2)}% CTR
   Image URL: ${c.imageUrl ? 'Has Image' : 'No Image'}
`).join('')}

Provide insights about what types of images likely perform best with these headlines. Return JSON:
{
  "image_insights": {
    "high_performing_image_types": [
      {"type": "type1", "rationale": "why it works", "headline_match": "what headlines work with this"}
    ],
    "visual_recommendations": [
      "recommendation1",
      "recommendation2"
    ],
    "creative_testing_ideas": [
      {"concept": "concept1", "description": "detailed description"},
      {"concept": "concept2", "description": "detailed description"}
    ],
    "color_psychology": {
      "recommended_colors": ["color1", "color2"],
      "colors_to_avoid": ["color1", "color2"]
    }
  }
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.`;

        const response = await callClaudeAPI({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1500,
            messages: [{ role: "user", content: imageAnalysisPrompt }]
        });

        return JSON.parse(response.content[0].text);
    } catch (error) {
        console.error('Image analysis error:', error);
        return { error: error.message };
    }
}

function generateCorrelationMatrix(creatives) {
    try {
        const traits = [
            { name: 'Numbers in Headline', test: c => /\d+/.test(c.headline) },
            { name: 'Question Headlines', test: c => c.headline.includes('?') },
            { name: 'Urgency Words', test: c => /\b(now|today|limited|hurry|quick)\b/i.test(c.headline) },
            { name: 'Free Offers', test: c => /\bfree\b/i.test(c.headline) },
            { name: 'Money/Savings Keywords', test: c => /\$|save|money|cash|earn/i.test(c.headline) },
            { name: 'Long Headlines (>50 chars)', test: c => c.headline.length > 50 },
            { name: 'Exclamation Points', test: c => c.headline.includes('!') },
            { name: 'High Spend (>$200)', test: c => c.spend > 200 },
            { name: 'Mobile Traffic', test: c => c.deviceType?.toLowerCase().includes('mobile') },
            { name: 'Has Image', test: c => Boolean(c.imageUrl) }
        ];

        const correlations = traits.map(trait => {
            const withTrait = creatives.filter(trait.test);
            const withoutTrait = creatives.filter(c => !trait.test(c));

            if (withTrait.length === 0 || withoutTrait.length === 0) {
                return {
                    trait: trait.name,
                    roas_impact: 0,
                    ctr_impact: 0,
                    sample_size: withTrait.length,
                    confidence: 'Low'
                };
            }

            const avgRoasWithTrait = withTrait.reduce((sum, c) => sum + c.roas, 0) / withTrait.length;
            const avgRoasWithoutTrait = withoutTrait.reduce((sum, c) => sum + c.roas, 0) / withoutTrait.length;
            
            const avgCtrWithTrait = withTrait.reduce((sum, c) => sum + c.ctr, 0) / withTrait.length;
            const avgCtrWithoutTrait = withoutTrait.reduce((sum, c) => sum + c.ctr, 0) / withoutTrait.length;

            const roasImpact = avgRoasWithoutTrait > 0 ? 
                (avgRoasWithTrait - avgRoasWithoutTrait) / avgRoasWithoutTrait : 0;
            const ctrImpact = avgCtrWithoutTrait > 0 ? 
                (avgCtrWithTrait - avgCtrWithoutTrait) / avgCtrWithoutTrait : 0;

            // Determine confidence based on sample size
            let confidence = 'Low';
            if (withTrait.length >= 10 && withoutTrait.length >= 10) confidence = 'High';
            else if (withTrait.length >= 5 && withoutTrait.length >= 5) confidence = 'Medium';

            return {
                trait: trait.name,
                roas_impact: roasImpact,
                ctr_impact: ctrImpact,
                sample_size: withTrait.length,
                confidence: confidence
            };
        }).sort((a, b) => b.roas_impact - a.roas_impact);

        return {
            correlations: correlations,
            summary: {
                total_traits_analyzed: traits.length,
                significant_correlations: correlations.filter(c => Math.abs(c.roas_impact) > 0.1).length,
                sample_size: creatives.length
            }
        };
    } catch (error) {
        console.error('Correlation matrix error:', error);
        return { error: error.message };
    }
}

async function callClaudeAPI(payload) {
    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Claude API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Claude API call failed:', error);
        throw error;
    }
}

// /api/ai/image-analysis.js
// Dedicated image analysis endpoint using Claude Vision
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { imageUrl, headline, performance } = req.body;

        if (!imageUrl) {
            return res.status(400).json({
                success: false,
                error: 'Image URL required'
            });
        }

        console.log('🖼️ Analyzing creative image:', imageUrl);

        // Download and convert image to base64
        const imageBase64 = await getImageAsBase64(imageUrl);
        
        if (!imageBase64) {
            throw new Error('Failed to process image');
        }

        const analysisPrompt = `Analyze this ad creative image for performance optimization:

${headline ? `Headline: "${headline}"` : ''}
${performance ? `Current Performance: ${performance.roas?.toFixed(2)}x ROAS, ${(performance.ctr * 100)?.toFixed(2)}% CTR` : ''}

Provide detailed analysis in JSON format:
{
  "visual_elements": {
    "primary_objects": ["object1", "object2"],
    "faces_detected": "yes/no",
    "text_overlay": "yes/no",
    "color_scheme": "description",
    "layout_type": "description"
  },
  "emotional_analysis": {
    "primary_emotion": "emotion",
    "emotional_intensity": "low/medium/high",
    "target_audience_appeal": "description"
  },
  "performance_factors": {
    "attention_grabbing_elements": ["element1", "element2"],
    "potential_performance_boosters": ["booster1", "booster2"],
    "potential_performance_killers": ["killer1", "killer2"]
  },
  "optimization_recommendations": [
    {"change": "specific change", "rationale": "why this will improve performance"},
    {"change": "specific change", "rationale": "why this will improve performance"}
  ],
  "a_b_test_suggestions": [
    {"variation": "description of variation", "hypothesis": "what you expect to happen"},
    {"variation": "description of variation", "hypothesis": "what you expect to happen"}
  ]
}

DO NOT OUTPUT ANYTHING OTHER THAN VALID JSON.`;

        const response = await callClaudeAPI({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1500,
            messages: [{
                role: "user",
                content: [
                    {
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: "image/jpeg",
                            data: imageBase64
                        }
                    },
                    {
                        type: "text",
                        text: analysisPrompt
                    }
                ]
            }]
        });

        const analysis = JSON.parse(response.content[0].text);

        return res.json({
            success: true,
            image_url: imageUrl,
            analysis: analysis,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Image analysis error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

async function getImageAsBase64(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return buffer.toString('base64');
    } catch (error) {
        console.error('Image conversion error:', error);
        return null;
    }
}
