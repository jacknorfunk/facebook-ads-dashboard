import { PrismaClient } from '@prisma/client'
import { TaboolaItem, TaboolaItemStats } from './taboolaClient'
import { CreativeFeatures } from './analysisEngine'

const prisma = new PrismaClient()

export interface ActionInput {
  creativeId: string
  type: 'tested' | 'scaled' | 'paused'
  reasonShort: string
  reasonDetail: string
  decidedBy: 'rule' | 'human' | 'model'
  inputsJson?: any
}

export interface CreativeWithMetrics extends TaboolaItem, TaboolaItemStats {
  features?: CreativeFeatures
}

export interface LearningInsight {
  pattern: string
  confidence: number
  evidence: string[]
  recommendation: string
}

export interface OutcomeAnalysis {
  actionId: string
  prePerformance: {
    spend: number
    ctr: number
    cpa?: number
    roas?: number
  }
  postPerformance: {
    spend: number
    ctr: number
    cpa?: number
    roas?: number
  }
  outcome: 'improved' | 'declined' | 'neutral'
  outcomeConfidence: number
}

class LifecycleManager {
  // Log an action taken on a creative
  async logAction(input: ActionInput): Promise<string> {
    try {
      const action = await prisma.action.create({
        data: {
          creativeId: input.creativeId,
          type: input.type,
          reasonShort: input.reasonShort,
          reasonDetail: input.reasonDetail,
          decidedBy: input.decidedBy,
          inputsJson: input.inputsJson ? JSON.stringify(input.inputsJson) : null,
        },
      })

      console.log(`Action logged: ${input.type} for creative ${input.creativeId}`)
      return action.id
    } catch (error) {
      console.error('Failed to log action:', error)
      throw error
    }
  }

  // Update creative metrics and create snapshot
  async updateCreativeMetrics(creative: CreativeWithMetrics): Promise<void> {
    try {
      // Upsert creative record
      await prisma.creative.upsert({
        where: { id: creative.id },
        update: {
          latestMetricsAt: new Date(),
          aggSpend: creative.spend,
          aggImpr: creative.impressions,
          aggClicks: creative.clicks,
          aggConv: creative.conversions,
          aggCpa: creative.cpa || null,
          aggRoas: creative.roas || null,
          featuresJson: creative.features ? JSON.stringify(creative.features) : null,
        },
        create: {
          id: creative.id,
          campaignId: creative.campaign_id,
          headline: creative.title,
          thumbnailUrl: creative.thumbnail.url,
          destinationUrl: creative.url,
          aggSpend: creative.spend,
          aggImpr: creative.impressions,
          aggClicks: creative.clicks,
          aggConv: creative.conversions,
          aggCpa: creative.cpa || null,
          aggRoas: creative.roas || null,
          featuresJson: creative.features ? JSON.stringify(creative.features) : null,
          status: creative.is_active ? 'active' : 'paused',
        },
      })

      // Create metric snapshot
      await prisma.metricSnapshot.create({
        data: {
          creativeId: creative.id,
          spend: creative.spend,
          impr: creative.impressions,
          clicks: creative.clicks,
          ctr: creative.ctr,
          cpc: creative.cpc,
          conv: creative.conversions,
          cpa: creative.cpa || null,
          roas: creative.roas || null,
          // You could add site/platform breakdown here
          siteTop3: null,
          platformMix: null,
        },
      })
    } catch (error) {
      console.error(`Failed to update metrics for creative ${creative.id}:`, error)
      throw error
    }
  }

  // Get creative action history
  async getCreativeHistory(creativeId: string): Promise<{
    creative: any
    actions: any[]
    metrics: any[]
  }> {
    try {
      const creative = await prisma.creative.findUnique({
        where: { id: creativeId },
        include: {
          actions: {
            orderBy: { decidedAt: 'desc' },
          },
          metricSnapshots: {
            orderBy: { at: 'desc' },
            take: 30, // Last 30 snapshots
          },
        },
      })

      if (!creative) {
        throw new Error(`Creative ${creativeId} not found`)
      }

      return {
        creative,
        actions: creative.actions,
        metrics: creative.metricSnapshots,
      }
    } catch (error) {
      console.error(`Failed to get history for creative ${creativeId}:`, error)
      throw error
    }
  }

  // Get recent actions across all creatives
  async getRecentActions(limit: number = 50): Promise<any[]> {
    try {
      const actions = await prisma.action.findMany({
        orderBy: { decidedAt: 'desc' },
        take: limit,
        include: {
          creative: {
            select: {
              headline: true,
              thumbnailUrl: true,
              campaignId: true,
            },
          },
        },
      })

      return actions
    } catch (error) {
      console.error('Failed to get recent actions:', error)
      throw error
    }
  }

  // Analyze outcomes of past actions
  async analyzeOutcomes(lookbackDays: number = 7): Promise<OutcomeAnalysis[]> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - lookbackDays)

      // Get actions from the lookback period
      const actions = await prisma.action.findMany({
        where: {
          decidedAt: {
            gte: cutoffDate,
          },
        },
        include: {
          creative: {
            include: {
              metricSnapshots: {
                orderBy: { at: 'asc' },
              },
            },
          },
        },
      })

      const outcomes: OutcomeAnalysis[] = []

      for (const action of actions) {
        const snapshots = action.creative.metricSnapshots
        
        // Find snapshots before and after the action
        const actionTime = action.decidedAt.getTime()
        const preSnapshots = snapshots.filter(s => s.at.getTime() < actionTime)
        const postSnapshots = snapshots.filter(s => s.at.getTime() > actionTime)

        if (preSnapshots.length === 0 || postSnapshots.length === 0) {
          continue // Not enough data to analyze
        }

        // Get the last pre-action snapshot and first few post-action snapshots
        const preSnapshot = preSnapshots[preSnapshots.length - 1]
        const postSnapshot = postSnapshots[0] // Take first post-action snapshot

        // Calculate performance change
        const prePerformance = {
          spend: preSnapshot.spend,
          ctr: preSnapshot.ctr,
          cpa: preSnapshot.cpa || undefined,
          roas: preSnapshot.roas || undefined,
        }

        const postPerformance = {
          spend: postSnapshot.spend,
          ctr: postSnapshot.ctr,
          cpa: postSnapshot.cpa || undefined,
          roas: postSnapshot.roas || undefined,
        }

        // Determine outcome
        let outcome: 'improved' | 'declined' | 'neutral' = 'neutral'
        let outcomeConfidence = 0

        if (action.type === 'scaled') {
          // For scaled actions, we want to see improved performance
          const ctrImprovement = (postPerformance.ctr - prePerformance.ctr) / prePerformance.ctr
          const roasImprovement = postPerformance.roas && prePerformance.roas 
            ? (postPerformance.roas - prePerformance.roas) / prePerformance.roas
            : 0

          if (ctrImprovement > 0.1 || roasImprovement > 0.15) {
            outcome = 'improved'
            outcomeConfidence = 80
          } else if (ctrImprovement < -0.15 || roasImprovement < -0.25) {
            outcome = 'declined'
            outcomeConfidence = 75
          }
        } else if (action.type === 'paused') {
          // For paused actions, we assume they were correct if they had poor performance
          const cpaIncrease = postPerformance.cpa && prePerformance.cpa
            ? (prePerformance.cpa - postPerformance.cpa) / prePerformance.cpa
            : 0

          if (prePerformance.ctr < 0.005 || (prePerformance.cpa && prePerformance.cpa > 30)) {
            outcome = 'improved' // Pausing was the right decision
            outcomeConfidence = 70
          }
        }

        outcomes.push({
          actionId: action.id,
          prePerformance,
          postPerformance,
          outcome,
          outcomeConfidence,
        })
      }

      return outcomes
    } catch (error) {
      console.error('Failed to analyze outcomes:', error)
      throw error
    }
  }

  // Generate learning insights from historical data
  async generateLearningInsights(): Promise<LearningInsight[]> {
    try {
      const insights: LearningInsight[] = []
      
      // Get all creatives with their features and actions
      const creatives = await prisma.creative.findMany({
        include: {
          actions: true,
          metricSnapshots: {
            orderBy: { at: 'desc' },
            take: 1, // Latest metrics
          },
        },
      })

      // Analyze patterns in successful actions
      const successfulScales = creatives.filter(c => {
        const scaleActions = c.actions.filter(a => a.type === 'scaled')
        const latestMetrics = c.metricSnapshots[0]
        return scaleActions.length > 0 && latestMetrics && latestMetrics.ctr > 0.015
      })

      if (successfulScales.length >= 3) {
        const features = successfulScales
          .map(c => c.featuresJson ? JSON.parse(c.featuresJson) : null)
          .filter(f => f !== null)

        const facesCount = features.filter(f => f.image?.hasFace).length
        const numeralsCount = features.filter(f => f.headline?.hasNumerals).length
        const questionCount = features.filter(f => f.headline?.isQuestion).length

        if (facesCount / features.length > 0.7) {
          insights.push({
            pattern: 'Face + Eye Contact → Higher CTR',
            confidence: Math.round((facesCount / features.length) * 100),
            evidence: [`${facesCount}/${features.length} successful scales had faces`],
            recommendation: 'Prioritize creatives with clear faces and eye contact for scaling',
          })
        }

        if (numeralsCount / features.length > 0.6) {
          insights.push({
            pattern: 'Numerical Headlines → Better Performance',
            confidence: Math.round((numeralsCount / features.length) * 100),
            evidence: [`${numeralsCount}/${features.length} successful scales had numbers in headlines`],
            recommendation: 'Test numerical variations for all headlines',
          })
        }
      }

      // Analyze pause patterns
      const pausedCreatives = creatives.filter(c => 
        c.actions.some(a => a.type === 'paused') && c.aggCpa && c.aggCpa > 25
      )

      if (pausedCreatives.length >= 3) {
        insights.push({
          pattern: 'High CPA → Pause Decision Accuracy',
          confidence: 85,
          evidence: [`${pausedCreatives.length} creatives with CPA > $25 were correctly paused`],
          recommendation: 'Auto-pause creatives when CPA exceeds $25 for 3+ days',
        })
      }

      return insights
    } catch (error) {
      console.error('Failed to generate learning insights:', error)
      throw error
    }
  }

  // Get or create learning configuration for an account
  async getLearningConfig(accountId: string): Promise<any> {
    try {
      let config = await prisma.learningConfig.findUnique({
        where: { accountId },
      })

      if (!config) {
        config = await prisma.learningConfig.create({
          data: {
            accountId,
            targetCpa: 25.0,
            targetRoas: 1.3,
            minSpend: 5.0,
            minConversions: 1,
            pauseThresholdDays: 3,
            scaleThresholdDays: 2,
          },
        })
      }

      return config
    } catch (error) {
      console.error('Failed to get learning config:', error)
      throw error
    }
  }

  // Update learning configuration
  async updateLearningConfig(accountId: string, updates: Partial<{
    targetCpa: number
    targetRoas: number
    minSpend: number
    minConversions: number
    pauseThresholdDays: number
    scaleThresholdDays: number
  }>): Promise<any> {
    try {
      const config = await prisma.learningConfig.upsert({
        where: { accountId },
        update: updates,
        create: {
          accountId,
          targetCpa: 25.0,
          targetRoas: 1.3,
          minSpend: 5.0,
          minConversions: 1,
          pauseThresholdDays: 3,
          scaleThresholdDays: 2,
          ...updates,
        },
      })

      return config
    } catch (error) {
      console.error('Failed to update learning config:', error)
      throw error
    }
  }

  // Generate automated action recommendations based on rules and learning
  async generateActionRecommendations(
    creatives: CreativeWithMetrics[],
    accountId: string
  ): Promise<Array<{
    creative: CreativeWithMetrics
    recommendedAction: 'scale' | 'pause' | 'test'
    reason: string
    confidence: number
    autoExecute: boolean
  }>> {
    try {
      const config = await this.getLearningConfig(accountId)
      const insights = await this.generateLearningInsights()
      const recommendations: Array<{
        creative: CreativeWithMetrics
        recommendedAction: 'scale' | 'pause' | 'test'
        reason: string
        confidence: number
        autoExecute: boolean
      }> = []

      for (const creative of creatives) {
        let recommendedAction: 'scale' | 'pause' | 'test' | null = null
        let reason = ''
        let confidence = 0
        let autoExecute = false

        // Scale conditions
        if (
          creative.spend >= config.minSpend &&
          creative.conversions >= config.minConversions &&
          ((creative.cpa && creative.cpa <= config.targetCpa) || 
           (creative.roas && creative.roas >= config.targetRoas))
        ) {
          recommendedAction = 'scale'
          reason = `Strong performance: CPA $${creative.cpa?.toFixed(2)} (target: $${config.targetCpa}), ROAS ${creative.roas?.toFixed(2)}x (target: ${config.targetRoas}x)`
          confidence = 85

          // Add feature-based confidence boosts
          if (creative.features?.image?.hasFace) confidence += 5
          if (creative.features?.headline?.hasNumerals) confidence += 5
          if (creative.ctr > 0.02) confidence += 10

          autoExecute = confidence >= 90
        }

        // Pause conditions
        else if (
          creative.spend >= config.minSpend &&
          ((creative.cpa && creative.cpa > config.targetCpa * 1.5) ||
           (creative.roas && creative.roas < config.targetRoas * 0.7) ||
           creative.ctr < 0.005)
        ) {
          recommendedAction = 'pause'
          reason = `Poor performance: CPA $${creative.cpa?.toFixed(2)} (target: $${config.targetCpa}), CTR ${(creative.ctr * 100).toFixed(2)}%`
          confidence = 75

          // Higher confidence for clear failures
          if (creative.cpa && creative.cpa > config.targetCpa * 2) confidence += 15
          if (creative.ctr < 0.003) confidence += 10

          autoExecute = confidence >= 85
        }

        // Test conditions (new creatives or variants)
        else if (creative.spend < config.minSpend && creative.impressions > 1000) {
          recommendedAction = 'test'
          reason = `Needs more data: only $${creative.spend.toFixed(2)} spent, ${creative.impressions} impressions`
          confidence = 60
          autoExecute = false
        }

        if (recommendedAction) {
          recommendations.push({
            creative,
            recommendedAction,
            reason,
            confidence,
            autoExecute,
          })
        }
      }

      return recommendations.sort((a, b) => b.confidence - a.confidence)
    } catch (error) {
      console.error('Failed to generate action recommendations:', error)
      throw error
    }
  }

  // Execute an automated action
  async executeAutomatedAction(
    recommendation: {
      creative: CreativeWithMetrics
      recommendedAction: 'scale' | 'pause' | 'test'
      reason: string
      confidence: number
    }
  ): Promise<string> {
    const actionInput: ActionInput = {
      creativeId: recommendation.creative.id,
      type: recommendation.recommendedAction === 'scale' ? 'scaled' : 
            recommendation.recommendedAction === 'pause' ? 'paused' : 'tested',
      reasonShort: `Auto-${recommendation.recommendedAction}`,
      reasonDetail: recommendation.reason,
      decidedBy: 'rule',
      inputsJson: {
        confidence: recommendation.confidence,
        metrics: {
          spend: recommendation.creative.spend,
          ctr: recommendation.creative.ctr,
          cpa: recommendation.creative.cpa,
          roas: recommendation.creative.roas,
        },
      },
    }

    return await this.logAction(actionInput)
  }
}

// Singleton instance
let lifecycleManager: LifecycleManager | null = null

export const getLifecycleManager = (): LifecycleManager => {
  if (!lifecycleManager) {
    lifecycleManager = new LifecycleManager()
  }
  return lifecycleManager
}

export default LifecycleManager