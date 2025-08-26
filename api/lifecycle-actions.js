// api/lifecycle-actions.js - Get recent creative lifecycle actions
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

    console.log('=== LIFECYCLE ACTIONS API CALLED ===');

    // In a real implementation, you would fetch from a database
    // For now, return some sample recent actions
    const sampleActions = [
      {
        id: 'action_1',
        creativeId: 'item_001',
        type: 'scaled',
        reasonShort: 'Strong ROAS performance',
        reasonDetail: 'ROAS 2.1x above target 1.3x for 3 days',
        decidedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        decidedBy: 'human',
        creative: {
          headline: 'Amazing Kitchen Gadgets That Will Change Your Life',
          thumbnailUrl: 'https://via.placeholder.com/300x200',
          campaignId: 'camp_123'
        }
      },
      {
        id: 'action_2',
        creativeId: 'item_002',
        type: 'paused',
        reasonShort: 'High CPA threshold exceeded',
        reasonDetail: 'CPA $29 above target $18 for 3 consecutive days',
        decidedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        decidedBy: 'rule',
        creative: {
          headline: 'Best Investment Opportunities in 2024',
          thumbnailUrl: 'https://via.placeholder.com/300x200',
          campaignId: 'camp_124'
        }
      },
      {
        id: 'action_3',
        creativeId: 'item_003',
        type: 'tested',
        reasonShort: 'New creative variant',
        reasonDetail: 'Testing headline with numerical element added',
        decidedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        decidedBy: 'human',
        creative: {
          headline: '7 Simple Tricks to Save Money on Groceries',
          thumbnailUrl: 'https://via.placeholder.com/300x200',
          campaignId: 'camp_125'
        }
      }
    ];

    // Add some learning insights
    const learningInsights = [
      {
        pattern: 'Face + Eye Contact → Higher CTR',
        confidence: 85,
        evidence: ['12/15 successful scales had faces', '23% average CTR uplift'],
        recommendation: 'Prioritize creatives with clear faces and eye contact for scaling'
      },
      {
        pattern: 'Numerical Headlines → Better Performance',
        confidence: 78,
        evidence: ['9/12 top performers used numbers', '18% conversion rate improvement'],
        recommendation: 'Test numerical variations for all headlines'
      },
      {
        pattern: 'High CPA → Pause Decision Accuracy',
        confidence: 92,
        evidence: ['18 creatives with CPA > $25 correctly paused', '85% decision accuracy'],
        recommendation: 'Auto-pause creatives when CPA exceeds $25 for 3+ days'
      }
    ];

    res.json({
      success: true,
      data: sampleActions,
      insights: learningInsights,
      metadata: {
        total_actions: sampleActions.length,
        date_range: 'Last 24 hours',
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Lifecycle actions API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
}