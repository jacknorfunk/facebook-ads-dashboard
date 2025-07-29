// /api/newsbreak/creative-analysis.js
// AI-powered creative analysis using Claude API

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { campaigns, analysisType } = req.body;
        
        if (!campaigns || !Array.isArray(campaigns)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Campaigns data is required' 
            });
        }

        console.log(`[Creative Analysis] Analyzing ${campaigns.length} campaigns for ${analysisType}`);

        let analysisResult;
        
        switch (analysisType) {
            case 'image_analysis':
                analysisResult = await analyzeCreativeImages(campaigns);
                break;
            case 'headline_analysis':
                analysisResult = await analyzeHeadlines(campaigns);
                break;
            case 'performance_correlation':
                analysisResult = await analyzePerformanceCorrelation(campaigns);
                break;
            case 'ai_suggestions':
                analysisResult = await generateAISuggestions(campaigns);
                break;
            case 'scaling_opportunities':
                analysisResult = await identifyScalingOpportunities(campaigns);
                break;
            case 'ab_test_recommendations':
                analysisResult = await generateABTestRecommendations(campaigns);
                break;
            default:
                analysisResult = await performComprehensiveAnalysis(campaigns);
        }

        return res.status(200).json({
            success: true,
            analysisType: analysisType,
            data: analysisResult,
            metadata: {
                totalCampaigns: campaigns.length,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('[Creative Analysis] Error:', error);
        
        return res.status(500).json({
            success: false,
            error: error.message,
            data: null
        });
    }
}

// Analyze creative images using Claude API
async function analyzeCreativeImages(campaigns) {
    const campaignsWithImages = campaigns.filter(c => c.imageUrl && c.imageUrl !== '');
    
    if (campaignsWithImages.length === 0) {
        return {
            insights: ['No campaigns with images found for analysis'],
            recommendations: ['Add images to campaigns for better performance analysis'],
            imagePatterns: [],
            performanceByImageType: []
        };
    }

    try {
        // Group campaigns by performance tiers
        const highPerformers = campaignsWithImages.filter(c => c.roas >= 2.0);
        const mediumPerformers = campaignsWithImages.filter(c => c.roas >= 1.0 && c.roas < 2.0);
        const lowPerformers = campaignsWithImages.filter(c => c.roas < 1.0);

        const analysisPrompt = `Analyze these ad campaign performance patterns and provide insights:

HIGH PERFORMERS (ROAS ≥ 2.0):
${highPerformers.slice(0, 10).map(c => `
- Campaign: ${c.name}
- Headline: ${c.headline}
- ROAS: ${c.roas.toFixed(2)}x
- CTR: ${(c.ctr * 100).toFixed(2)}%
- Spend: $${c.spend.toFixed(2)}
- Image URL: ${c.imageUrl || 'No image'}
`).join('')}

MEDIUM PERFORMERS (1.0 ≤ ROAS < 2.0):
${mediumPerformers.slice(0, 5).map(c => `
- Campaign: ${c.name}
- Headline: ${c.headline}
- ROAS: ${c.roas.toFixed(2)}x
- CTR: ${(c.ctr * 100).toFixed(2)}%
`).join('')}

LOW PERFORMERS (ROAS < 1.0):
${lowPerformers.slice(0, 5).map(c => `
- Campaign: ${c.name}
- Headline: ${c.headline}
- ROAS: ${c.roas.toFixed(2)}x
- CTR: ${(c.ctr * 100).toFixed(2)}%
`).join('')}

Provide:
1. **Image Analysis Insights**: What visual patterns correlate with high performance?
2. **Creative Recommendations**: Specific image optimization suggestions
3. **Performance Patterns**: Common elements in top performers
4. **Scaling Advice**: Which creative approaches to scale up

Focus on actionable insights for $50k+ daily spend optimization.`;

        const claudeResponse = await callClaudeAPI({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            messages: [{
                role: "user",
                content: analysisPrompt
            }]
        });

        const analysis = claudeResponse.content[0].text;

        // Structure the response
        return {
            insights: analysis.split('\n').filter(line => line.trim().length > 0),
            recommendations: extractRecommendations(analysis),
            imagePatterns: analyzeImagePatterns(campaigns),
            performanceByImageType: categorizeByImageType(campaigns),
            rawAnalysis: analysis
        };

    } catch (error) {
        console.error('Image analysis error:', error);
        return {
            insights: ['Analysis temporarily unavailable'],
            recommendations: ['Manual review of top-performing creative images recommended'],
            imagePatterns: [],
            performanceByImageType: []
        };
    }
}

// Analyze headlines for performance patterns
async function analyzeHeadlines(campaigns) {
    try {
        const headlineData = campaigns.map(c => ({
            headline: c.headline,
            roas: c.roas,
            ctr: c.ctr,
            conversions: c.conversions,
            wordCount: c.headline ? c.headline.split(' ').length : 0,
            hasNumbers: /\d/.test(c.headline || ''),
            hasQuestion: (c.headline || '').includes('?'),
            hasUrgency: /\b(now|today|limited|hurry|quick|urgent)\b/i.test(c.headline || ''),
            hasMoney: /\$|save|money|cash|earn|free|discount/i.test(c.headline || '')
        }));

        const analysisPrompt = `Analyze these headline performance patterns:

TOP PERFORMING HEADLINES (by ROAS):
${headlineData
            .sort((a, b) => b.roas - a.roas)
            .slice(0, 10)
            .map((h, i) => `${i + 1}. "${h.headline}" - ROAS: ${h.roas.toFixed(2)}x, CTR: ${(h.ctr * 100).toFixed(2)}%`)
            .join('\n')}

HEADLINE CHARACTERISTICS ANALYSIS:
- Headlines with numbers: ${headlineData.filter(h => h.hasNumbers).length}/${headlineData.length}
- Headlines with questions: ${headlineData.filter(h => h.hasQuestion).length}/${headlineData.length}
- Headlines with urgency: ${headlineData.filter(h => h.hasUrgency).length}/${headlineData.length}
- Headlines with money terms: ${headlineData.filter(h => h.hasMoney).length}/${headlineData.length}

Average performance by characteristic:
- With numbers: ${calculateAverageROAS(headlineData.filter(h => h.hasNumbers)).toFixed(2)}x ROAS
- Without numbers: ${calculateAverageROAS(headlineData.filter(h => !h.hasNumbers)).toFixed(2)}x ROAS
- With questions: ${calculateAverageROAS(headlineData.filter(h => h.hasQuestion)).toFixed(2)}x ROAS
- With urgency: ${calculateAverageROAS(headlineData.filter(h => h.hasUrgency)).toFixed(2)}x ROAS
- With money terms: ${calculateAverageROAS(headlineData.filter(h => h.hasMoney)).toFixed(2)}x ROAS

Provide:
1. **Winning Headline Patterns**: What makes headlines perform well?
2. **Optimization Recommendations**: Specific improvements for underperformers
3. **A/B Test Ideas**: 5 headline variations to test immediately
4. **Emotional Triggers**: Which emotions drive best performance?
5. **Length Analysis**: Optimal headline length insights

Focus on immediately actionable improvements.`;

        const claudeResponse = await callClaudeAPI({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            messages: [{
                role: "user",
                content: analysisPrompt
            }]
        });

        return {
            analysis: claudeResponse.content[0].text,
            topHeadlines: headlineData
                .sort((a, b) => b.roas - a.roas)
                .slice(0, 10),
            headlineCharacteristics: {
                withNumbers: headlineData.filter(h => h.hasNumbers).length,
                withQuestions: headlineData.filter(h => h.hasQuestion).length,
                withUrgency: headlineData.filter(h => h.hasUrgency).length,
                withMoney: headlineData.filter(h => h.hasMoney).length
            },
            correlationData: analyzeHeadlineCorrelations(headlineData)
        };

    } catch (error) {
        console.error('Headline analysis error:', error);
        return {
            analysis: 'Headline analysis temporarily unavailable',
            topHeadlines: [],
            headlineCharacteristics: {},
            correlationData: []
        };
    }
}

// Generate AI-powered creative suggestions
async function generateAISuggestions(campaigns) {
    try {
        const topPerformers = campaigns
            .filter(c => c.roas > 1.5)
            .sort((a, b) => b.roas - a.roas)
            .slice(0, 8);

        const suggestionPrompt = `Based on these top-performing NewsBreak campaigns, generate specific creative optimization recommendations:

TOP PERFORMERS:
${topPerformers.map((c, i) => `
${i + 1}. Campaign: ${c.name}
   Headline: "${c.headline}"
   Performance: ${c.roas.toFixed(2)}x ROAS, ${(c.ctr * 100).toFixed(2)}% CTR
   Spend: $${c.spend.toFixed(2)}
   Conversions: ${c.conversions}
`).join('\n')}

Generate specific, actionable suggestions:

1. **HEADLINE VARIATIONS** (5 new headlines based on winning patterns)
2. **IMAGE CONCEPTS** (3 specific image ideas for testing)
3. **AUDIENCE TARGETING** (refined targeting recommendations)
4. **BUDGET OPTIMIZATION** (which campaigns to scale up/down)
5. **CREATIVE REFRESH** (timing and approach for creative updates)
6. **A/B TESTING ROADMAP** (prioritized test queue for next 30 days)

Each suggestion should include:
- Specific hypothesis to test
- Expected performance impact (% improvement)
- Implementation priority (High/Medium/Low)
- Success metrics to track
- Budget allocation recommendation

Focus on maximizing ROAS for $50k+ daily NewsBreak spend.`;

        const claudeResponse = await callClaudeAPI({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2500,
            messages: [{
                role: "user",
                content: suggestionPrompt
            }]
        });

        return {
            suggestions: claudeResponse.content[0].text,
            topPerformers: topPerformers,
            scalingCandidates: identifyScalingCandidates(campaigns),
            testPriorities: generateTestPriorities(campaigns)
        };

    } catch (error) {
        console.error('AI suggestions error:', error);
        return {
            suggestions: 'AI suggestions temporarily unavailable',
            topPerformers: [],
            scalingCandidates: [],
            testPriorities: []
        };
    }
}

// Identify scaling opportunities
async function identifyScalingOpportunities(campaigns) {
    const scalingCandidates = campaigns.filter(c => 
        c.roas >= 2.0 && 
        c.conversions >= 5 && 
        c.spend < 1000 // Room to scale
    ).sort((a, b) => b.roas - a.roas);

    const opportunities = scalingCandidates.map(campaign => ({
        campaignId: campaign.id,
        campaignName: campaign.name,
        headline: campaign.headline,
        currentSpend: campaign.spend,
        currentROAS: campaign.roas,
        currentConversions: campaign.conversions,
        recommendedSpend: Math.min(campaign.spend * 2.5, 2000), // Scale up 2.5x but cap at $2000
        projectedROAS: campaign.roas * 0.9, // Assume slight ROAS decrease with scale
        scalingPotential: campaign.roas > 3 ? 'High' : campaign.roas > 2.5 ? 'Medium' : 'Low',
        reasoning: `Strong ROAS of ${campaign.roas.toFixed(2)}x with ${campaign.conversions} conversions indicates scaling potential`
    }));

    return {
        totalOpportunities: opportunities.length,
        highPotential: opportunities.filter(o => o.scalingPotential === 'High').length,
        totalProjectedSpend: opportunities.reduce((sum, o) => sum + o.recommendedSpend, 0),
        opportunities: opportunities.slice(0, 10), // Top 10 opportunities
        summary: {
            currentSpend: scalingCandidates.reduce((sum, c) => sum + c.spend, 0),
            averageROAS: scalingCandidates.reduce((sum, c) => sum + c.roas, 0) / scalingCandidates.length,
            totalConversions: scalingCandidates.reduce((sum, c) => sum + c.conversions, 0)
        }
    };
}

// Generate A/B test recommendations
async function generateABTestRecommendations(campaigns) {
    const testCandidates = campaigns.filter(c => 
        c.spend > 100 && // Sufficient spend for testing
        c.conversions >= 3 && // Enough conversions for statistical significance
        c.roas > 1.0 // Profitable campaigns worth optimizing
    ).sort((a, b) => b.spend - a.spend); // Start with highest spend

    const testRecommendations = testCandidates.slice(0, 10).map(campaign => {
        const tests = [];
        
        // Headline tests
        if (campaign.headline) {
            if (campaign.headline.length > 50) {
                tests.push({
                    type: 'Headline Length',
                    hypothesis: 'Shorter headlines will improve CTR',
                    variant1: campaign.headline,
                    variant2: campaign.headline.substring(0, 40) + '...',
                    priority: 'High',
                    expectedLift: '+15% CTR'
                });
            }
            
            if (!/\d/.test(campaign.headline)) {
                tests.push({
                    type: 'Number Addition',
                    hypothesis: 'Adding specific numbers improves performance',
                    variant1: campaign.headline,
                    variant2: campaign.headline.replace(/some|many|several/, '7'),
                    priority: 'Medium',
                    expectedLift: '+12% ROAS'
                });
            }
        }
        
        // Performance-based tests
        if (campaign.ctr < 0.02) {
            tests.push({
                type: 'CTR Optimization',
                hypothesis: 'More compelling hook will improve CTR',
                priority: 'High',
                expectedLift: '+25% CTR'
            });
        }
        
        return {
            campaignId: campaign.id,
            campaignName: campaign.name,
            currentPerformance: {
                roas: campaign.roas,
                ctr: campaign.ctr,
                spend: campaign.spend
            },
            recommendedTests: tests
        };
    });

    return {
        totalTestCandidates: testCandidates.length,
        recommendations: testRecommendations,
        priorityTests: testRecommendations
            .flatMap(tr => tr.recommendedTests)
            .filter(test => test.priority === 'High')
            .slice(0, 5)
    };
}

// Comprehensive analysis combining all insights
async function performComprehensiveAnalysis(campaigns) {
    try {
        const [imageAnalysis, headlineAnalysis, suggestions, scaling, testing] = await Promise.all([
            analyzeCreativeImages(campaigns),
            analyzeHeadlines(campaigns),
            generateAISuggestions(campaigns),
            identifyScalingOpportunities(campaigns),
            generateABTestRecommendations(campaigns)
        ]);

        return {
            imageAnalysis,
            headlineAnalysis,
            aiSuggestions: suggestions,
            scalingOpportunities: scaling,
            abTestRecommendations: testing,
            summary: {
                totalCampaigns: campaigns.length,
                topPerformers: campaigns.filter(c => c.roas >= 2.0).length,
                scalingOpportunities: scaling.totalOpportunities,
                testRecommendations: testing.totalTestCandidates
            }
        };
    } catch (error) {
        console.error('Comprehensive analysis error:', error);
        throw error;
    }
}

// Helper functions
function calculateAverageROAS(campaigns) {
    if (campaigns.length === 0) return 0;
    return campaigns.reduce((sum, c) => sum + c.roas, 0) / campaigns.length;
}

function extractRecommendations(analysis) {
    const lines = analysis.split('\n');
    return lines.filter(line => 
        line.includes('recommendation') || 
        line.includes('suggest') || 
        line.includes('should') ||
        line.startsWith('-') ||
        line.startsWith('•')
    ).slice(0, 5);
}

function analyzeImagePatterns(campaigns) {
    // Basic image pattern analysis based on URL patterns
    const patterns = {};
    campaigns.forEach(campaign => {
        if (campaign.imageUrl) {
            const urlParts = campaign.imageUrl.toLowerCase();
            if (urlParts.includes('face') || urlParts.includes('person')) {
                patterns['faces'] = (patterns['faces'] || 0) + 1;
            }
            if (urlParts.includes('product') || urlParts.includes('item')) {
                patterns['products'] = (patterns['products'] || 0) + 1;
            }
            if (urlParts.includes('text') || urlParts.includes('graphic')) {
                patterns['graphics'] = (patterns['graphics'] || 0) + 1;
            }
        }
    });
    return patterns;
}

function categorizeByImageType(campaigns) {
    return campaigns.reduce((acc, campaign) => {
        let category = 'Unknown';
        if (campaign.imageUrl) {
            const url = campaign.imageUrl.toLowerCase();
            if (url.includes('face') || url.includes('person')) category = 'People';
            else if (url.includes('product')) category = 'Products';
            else if (url.includes('text')) category = 'Text/Graphics';
            else category = 'Other';
        }
        
        if (!acc[category]) acc[category] = [];
        acc[category].push({
            campaign: campaign.name,
            roas: campaign.roas,
            ctr: campaign.ctr
        });
        
        return acc;
    }, {});
}

function analyzeHeadlineCorrelations(headlineData) {
    const correlations = [
        {
            trait: 'Contains Numbers',
            withTrait: headlineData.filter(h => h.hasNumbers),
            withoutTrait: headlineData.filter(h => !h.hasNumbers)
        },
        {
            trait: 'Question Format',
            withTrait: headlineData.filter(h => h.hasQuestion),
            withoutTrait: headlineData.filter(h => !h.hasQuestion)
        },
        {
            trait: 'Urgency Words',
            withTrait: headlineData.filter(h => h.hasUrgency),
            withoutTrait: headlineData.filter(h => !h.hasUrgency)
        },
        {
            trait: 'Money Keywords',
            withTrait: headlineData.filter(h => h.hasMoney),
            withoutTrait: headlineData.filter(h => !h.hasMoney)
        }
    ];

    return correlations.map(corr => {
        const avgWithTrait = calculateAverageROAS(corr.withTrait);
        const avgWithoutTrait = calculateAverageROAS(corr.withoutTrait);
        const impact = avgWithoutTrait > 0 ? ((avgWithTrait - avgWithoutTrait) / avgWithoutTrait) * 100 : 0;
        
        return {
            trait: corr.trait,
            impact: impact,
            sampleSize: corr.withTrait.length,
            avgROASWith: avgWithTrait,
            avgROASWithout: avgWithoutTrait
        };
    });
}

function identifyScalingCandidates(campaigns) {
    return campaigns
        .filter(c => c.roas >= 2.0 && c.conversions >= 3 && c.spend < 500)
        .sort((a, b) => b.roas - a.roas)
        .slice(0, 5)
        .map(c => ({
            id: c.id,
            name: c.name,
            roas: c.roas,
            spend: c.spend,
            recommendedBudget: c.spend * 2
        }));
}

function generateTestPriorities(campaigns) {
    return [
        {
            priority: 1,
            test: 'Headline Length Optimization',
            candidates: campaigns.filter(c => c.headline && c.headline.length > 60).length
        },
        {
            priority: 2,
            test: 'Number Integration',
            candidates: campaigns.filter(c => c.headline && !/\d/.test(c.headline)).length
        },
        {
            priority: 3,
            test: 'CTA Optimization',
            candidates: campaigns.filter(c => c.ctr < 0.015).length
        }
    ];
}

// Claude API integration
async function callClaudeAPI(payload) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
    }

    return await response.json();
}
