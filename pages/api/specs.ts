import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { getSpecsClient } from '@/lib/specsClient'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Check authentication
    const session = await getServerSession(req, res, authOptions)
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const specsClient = getSpecsClient()

    if (req.method === 'GET') {
      // Get current specs
      const specs = await specsClient.getCurrentSpecs()
      
      return res.json({
        success: true,
        data: {
          specs,
          fetched_at: specs.fetchedAt,
          version: specs.version,
          cache_status: 'fresh',
        },
      })
    }

    if (req.method === 'POST') {
      // Validate content against specs
      const { type, content } = req.body

      if (!type || !content) {
        return res.status(400).json({
          error: 'Missing required fields: type and content',
        })
      }

      let validation = null

      if (type === 'headline') {
        validation = await specsClient.validateHeadline(content)
      } else if (type === 'image') {
        validation = await specsClient.validateImageUrl(content)
      } else {
        return res.status(400).json({
          error: 'Invalid type. Must be "headline" or "image"',
        })
      }

      return res.json({
        success: true,
        data: {
          validation,
          type,
          content,
          timestamp: new Date().toISOString(),
        },
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Specs API error:', error)
    
    const errorResponse = {
      success: false,
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }

    res.status(500).json(errorResponse)
  }
}