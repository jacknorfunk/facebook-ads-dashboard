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

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const {
      creativeId,
      type,
      reasonShort,
      reasonDetail,
      decidedBy = 'human',
      inputsJson,
    } = req.body

    // Validate required fields
    if (!creativeId || !type || !reasonShort || !reasonDetail) {
      return res.status(400).json({
        error: 'Missing required fields: creativeId, type, reasonShort, reasonDetail',
      })
    }

    // Validate action type
    if (!['tested', 'scaled', 'paused'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid action type. Must be one of: tested, scaled, paused',
      })
    }

    // Validate decidedBy
    if (!['human', 'rule', 'model'].includes(decidedBy)) {
      return res.status(400).json({
        error: 'Invalid decidedBy value. Must be one of: human, rule, model',
      })
    }

    const lifecycleManager = getLifecycleManager()

    // Log the action
    const actionId = await lifecycleManager.logAction({
      creativeId,
      type,
      reasonShort,
      reasonDetail,
      decidedBy,
      inputsJson,
    })

    return res.json({
      success: true,
      data: {
        actionId,
        creativeId,
        type,
        reasonShort,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Lifecycle action API error:', error)
    
    const errorResponse = {
      success: false,
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }

    res.status(500).json(errorResponse)
  }
}