import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { getLifecycleManager } from '@/lib/lifecycle'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions)
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const {
      limit = '50',
      type,
      creativeId,
      decided_by,
      include_insights = 'false',
      include_outcomes = 'false',
    } = req.query

    const lifecycleManager = getLifecycleManager()

    // Get recent actions
    const actions = await lifecycleManager.getRecentActions(parseInt(limit as string))

    // Filter actions if specified
    let filteredActions = actions
    if (type) {
      filteredActions = filteredActions.filter(action => action.type === type)
    }
    if (creativeId) {
      filteredActions = filteredActions.filter(action => action.creativeId === creativeId)
    }
    if (decided_by) {
      filteredActions = filteredActions.filter(action => action.decidedBy === decided_by)
    }

    let insights = null
    let outcomes = null

    // Include learning insights if requested
    if (include_insights === 'true') {
      insights = await lifecycleManager.generateLearningInsights()
    }

    // Include outcome analysis if requested
    if (include_outcomes === 'true') {
      outcomes = await lifecycleManager.analyzeOutcomes(7) // Last 7 days
    }

    // Format response
    const response = {
      success: true,
      data: {
        actions: filteredActions,
        insights,
        outcomes,
        metadata: {
          total_actions: filteredActions.length,
          filters_applied: { type, creativeId, decided_by },
          includes: {
            insights: include_insights === 'true',
            outcomes: include_outcomes === 'true',
          },
        },
      },
    }

    res.json(response)
  } catch (error) {
    console.error('Lifecycle actions API error:', error)
    
    const errorResponse = {
      success: false,
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }

    res.status(500).json(errorResponse)
  }
}