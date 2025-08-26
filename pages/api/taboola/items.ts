import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { getTaboolaClient } from '@/lib/taboolaClient'
import { getAnalysisEngine } from '@/lib/analysisEngine'
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
      start_date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date = new Date().toISOString().split('T')[0],
      campaign_id,
      order_by = 'spend',
      order_direction = 'desc',
      analyze = 'true',
      update_lifecycle = 'true',
    } = req.query

    const taboolaClient = getTaboolaClient()

    // Test connection first
    const connectionTest = await taboolaClient.testConnection()
    if (!connectionTest.success) {
      return res.status(500).json({
        error: 'Taboola API connection failed',
        details: connectionTest.message,
      })
    }

    // Fetch items with stats
    const reportOptions = {
      start_date: start_date as string,
      end_date: end_date as string,
      order_by: order_by as string,
      order_direction: order_direction as 'asc' | 'desc',
      filters: campaign_id ? { campaign_id } : undefined,
    }

    const itemsWithStats = await taboolaClient.getItemsWithStats(reportOptions)

    let analysisResults = null
    let lifecycleUpdates = null

    // Perform analysis if requested
    if (analyze === 'true') {
      const analysisEngine = getAnalysisEngine()
      analysisResults = await analysisEngine.analyzeCreatives(itemsWithStats, {
        compareWithPeers: true,
        generateRecommendations: true,
        minSpend: 1, // Lower threshold for analysis
        minConversions: 0,
      })
    }

    // Update lifecycle data if requested
    if (update_lifecycle === 'true') {
      const lifecycleManager = getLifecycleManager()
      
      // Update metrics for all creatives
      const updatePromises = itemsWithStats.map(async (creative) => {
        try {
          // Add features from analysis if available
          const creativeWithFeatures = analysisResults 
            ? { ...creative, features: analysisResults.find(r => r.creative.id === creative.id)?.features }
            : creative
          
          await lifecycleManager.updateCreativeMetrics(creativeWithFeatures)
        } catch (error) {
          console.error(`Failed to update lifecycle for creative ${creative.id}:`, error)
        }
      })
      
      await Promise.all(updatePromises)
      lifecycleUpdates = { updated: itemsWithStats.length }
    }

    // Format response
    const response = {
      success: true,
      data: {
        items: itemsWithStats,
        analysis: analysisResults,
        lifecycle: lifecycleUpdates,
        metadata: {
          total_items: itemsWithStats.length,
          date_range: { start_date, end_date },
          filters_applied: { campaign_id, order_by, order_direction },
          connection_status: connectionTest.message,
        },
      },
    }

    res.json(response)
  } catch (error) {
    console.error('Taboola items API error:', error)
    
    // Return detailed error information
    const errorResponse = {
      success: false,
      error: error.message || 'Unknown error occurred',
      details: error.stack || error.toString(),
      timestamp: new Date().toISOString(),
    }

    res.status(500).json(errorResponse)
  }
}