import { TaboolaItem, TaboolaItemStats } from './taboolaClient'
import { PrismaClient } from '@prisma/client'
import { getSpecsClient } from './specsClient'

const prisma = new PrismaClient()

export interface CreativeFeatures {
  headline: HeadlineFeatures
  image: ImageFeatures
  destination: DestinationFeatures
}

export interface HeadlineFeatures {
  length: number
  hasNumerals: boolean
  hasCurrency: boolean
  hasBrandMention: boolean
  isQuestion: boolean
  isImperative: boolean
  sentiment: 'positive' | 'negative' | 'neutral'
  benefitKeywords: string[]
  curiosityKeywords: string[]
  timeElements: string[]
  stepElements: string[]
  ctaWords: string[]
  superlatives: string[]
}

export interface ImageFeatures {
  hasFace: boolean
  hasEyeContact: boolean
  isCloseUp: boolean
  hasTextOverlay: boolean
  hasLogo: boolean
  isStorefront: boolean
  dominantColors: string[]
  contrast: 'high' | 'medium' | 'low'
  complexity: 'simple' | 'moderate' | 'complex'
}

export interface DestinationFeatures {
  domain: string
  isEcommerce: boolean
  hasSSL: boolean
  loadTime: number
  isMobile: boolean
  hasContactInfo: boolean
}

export interface PerformanceInsight {
  type: 'positive' | 'negative' | 'neutral'
  feature: string
  impact: string
  confidence: number
  evidence: string
  uplift?: number
}

export interface CreativeRecommendation {
  type: 'headline' | 'image'
  content: string
  reason: string
  confidence: number
  basedOn: string[]
}

export interface AnalysisResult {
  creative: TaboolaItem & TaboolaItemStats
  features: CreativeFeatures
  insights: PerformanceInsight[]
  recommendations: CreativeRecommendation[]
  score: number
  peerComparison: {
    ctrUplift: number
    cpaUplift: number
    roasUplift: number
    sampleSize: number
  }
}

class AnalysisEngine {
  private specsClient = getSpecsClient()

  async analyzeCreatives(
    creatives: Array<TaboolaItem & TaboolaItemStats>,
    options: {
      compareWithPeers?: boolean
      generateRecommendations?: boolean
      minSpend?: number
      minConversions?: number
    } = {}
  ): Promise<AnalysisResult[]> {
    const {
      compareWithPeers = true,
      generateRecommendations = true,
      minSpend = 5,
      minConversions = 1,
    } = options

    // Filter creatives that meet minimum thresholds
    const qualifyingCreatives = creatives.filter(
      c => c.spend >= minSpend && c.conversions >= minConversions
    )

    // Analyze each creative
    const results: AnalysisResult[] = []
    
    for (const creative of qualifyingCreatives) {
      try {
        const features = await this.extractFeatures(creative)
        const insights = await this.generateInsights(creative, features, qualifyingCreatives)
        const recommendations = generateRecommendations 
          ? await this.generateRecommendations(creative, features, insights)
          : []
        const score = this.calculateCreativeScore(creative, features, insights)
        const peerComparison = compareWithPeers 
          ? this.compareToPeers(creative, qualifyingCreatives)
          : { ctrUplift: 0, cpaUplift: 0, roasUplift: 0, sampleSize: 0 }

        results.push({
          creative,
          features,
          insights,
          recommendations,
          score,
          peerComparison,
        })
      } catch (error) {
        console.error(`Failed to analyze creative ${creative.id}:`, error)
      }
    }

    return results.sort((a, b) => b.score - a.score)
  }

  private async extractFeatures(creative: TaboolaItem & TaboolaItemStats): Promise<CreativeFeatures> {
    const headline = this.extractHeadlineFeatures(creative.title)
    const image = await this.extractImageFeatures(creative.thumbnail.url)
    const destination = await this.extractDestinationFeatures(creative.url)

    return { headline, image, destination }
  }

  private extractHeadlineFeatures(headline: string): HeadlineFeatures {
    const lowerHeadline = headline.toLowerCase()

    // Basic metrics
    const length = headline.length
    const hasNumerals = /\d/.test(headline)
    const hasCurrency = /[$£€¥₹]/gi.test(headline)

    // Brand/store detection
    const brandKeywords = ['amazon', 'ebay', 'walmart', 'target', 'costco', 'nike', 'apple', 'samsung']
    const hasBrandMention = brandKeywords.some(brand => lowerHeadline.includes(brand))

    // Question vs imperative
    const isQuestion = headline.includes('?') || /\b(what|how|why|when|where|which|who)\b/i.test(headline)
    const isImperative = /\b(get|buy|shop|order|try|discover|find|learn|see|save|win|join|start)\b/i.test(headline)

    // Sentiment analysis
    const positiveWords = ['amazing', 'incredible', 'best', 'great', 'fantastic', 'awesome', 'perfect', 'love', 'stunning', 'exclusive']
    const negativeWords = ['worst', 'terrible', 'awful', 'bad', 'hate', 'never', 'impossible', 'problem', 'struggle']
    
    const posCount = positiveWords.filter(word => lowerHeadline.includes(word)).length
    const negCount = negativeWords.filter(word => lowerHeadline.includes(word)).length
    
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral'
    if (posCount > negCount) sentiment = 'positive'
    else if (negCount > posCount) sentiment = 'negative'

    // Benefit keywords
    const benefits = ['save', 'discount', 'deal', 'offer', 'free', 'bonus', 'gift', 'reward', 'exclusive', 'limited']
    const benefitKeywords = benefits.filter(word => lowerHeadline.includes(word))

    // Curiosity keywords
    const curiosity = ['secret', 'hidden', 'revealed', 'truth', 'insider', 'shocking', 'surprising', 'unexpected']
    const curiosityKeywords = curiosity.filter(word => lowerHeadline.includes(word))

    // Time elements
    const timePatterns = ['today', 'now', 'instant', 'immediately', 'quick', 'fast', '24/7', 'overnight', 'same day']
    const timeElements = timePatterns.filter(pattern => lowerHeadline.includes(pattern))

    // Step elements
    const stepPatterns = ['step', 'easy', 'simple', 'minute', 'second', 'hour']
    const stepElements = stepPatterns.filter(pattern => lowerHeadline.includes(pattern))

    // CTA words
    const ctaPatterns = ['click', 'get', 'buy', 'shop', 'order', 'try', 'discover', 'find', 'learn', 'see', 'save', 'win', 'join', 'start']
    const ctaWords = ctaPatterns.filter(word => lowerHeadline.includes(word))

    // Superlatives
    const superlativePatterns = ['best', 'top', 'ultimate', 'premier', 'leading', 'most', 'highest', 'greatest', '#1']
    const superlatives = superlativePatterns.filter(pattern => lowerHeadline.includes(pattern))

    return {
      length,
      hasNumerals,
      hasCurrency,
      hasBrandMention,
      isQuestion,
      isImperative,
      sentiment,
      benefitKeywords,
      curiosityKeywords,
      timeElements,
      stepElements,
      ctaWords,
      superlatives,
    }
  }

  private async extractImageFeatures(thumbnailUrl: string): Promise<ImageFeatures> {
    // This is a simplified implementation
    // In production, you'd use computer vision APIs like:
    // - Google Vision API
    // - AWS Rekognition
    // - Azure Computer Vision
    // - face-api.js for client-side analysis

    const url = thumbnailUrl.toLowerCase()
    const filename = url.split('/').pop() || ''

    // Simple heuristics based on URL patterns and common naming conventions
    const hasFace = /face|person|portrait|selfie|headshot/i.test(filename) || url.includes('face')
    const hasEyeContact = hasFace && (/direct|contact|looking|gaze/i.test(filename) || url.includes('eye'))
    const isCloseUp = /close|zoom|detail|macro/i.test(filename) || url.includes('close')
    const hasTextOverlay = /text|title|caption|overlay|banner/i.test(filename)
    const hasLogo = /logo|brand|company/i.test(filename) || url.includes('logo')
    const isStorefront = /store|shop|retail|building|storefront/i.test(filename)

    // Simple color analysis based on URL patterns
    const dominantColors: string[] = []
    if (url.includes('red')) dominantColors.push('red')
    if (url.includes('blue')) dominantColors.push('blue')
    if (url.includes('green')) dominantColors.push('green')
    if (url.includes('yellow')) dominantColors.push('yellow')
    if (url.includes('white')) dominantColors.push('white')
    if (url.includes('black')) dominantColors.push('black')

    // Estimate contrast and complexity
    const contrast = hasTextOverlay ? 'high' : hasFace ? 'medium' : 'low'
    const complexity = hasTextOverlay && hasLogo ? 'complex' : hasFace || hasLogo ? 'moderate' : 'simple'

    return {
      hasFace,
      hasEyeContact,
      isCloseUp,
      hasTextOverlay,
      hasLogo,
      isStorefront,
      dominantColors,
      contrast: contrast as 'high' | 'medium' | 'low',
      complexity: complexity as 'simple' | 'moderate' | 'complex',
    }
  }

  private async extractDestinationFeatures(destinationUrl: string): Promise<DestinationFeatures> {
    try {
      const url = new URL(destinationUrl)
      const domain = url.hostname

      // E-commerce detection
      const ecommerceIndicators = ['shop', 'store', 'cart', 'buy', 'product', 'order', 'checkout']
      const isEcommerce = ecommerceIndicators.some(indicator => 
        domain.includes(indicator) || url.pathname.includes(indicator)
      )

      const hasSSL = url.protocol === 'https:'

      // These would require actual HTTP requests in production
      const loadTime = Math.random() * 2000 + 500 // Simulated
      const isMobile = true // Assume mobile-friendly
      const hasContactInfo = isEcommerce // Assume e-commerce sites have contact info

      return {
        domain,
        isEcommerce,
        hasSSL,
        loadTime,
        isMobile,
        hasContactInfo,
      }
    } catch (error) {
      return {
        domain: 'unknown',
        isEcommerce: false,
        hasSSL: false,
        loadTime: 0,
        isMobile: false,
        hasContactInfo: false,
      }
    }
  }

  private async generateInsights(
    creative: TaboolaItem & TaboolaItemStats,
    features: CreativeFeatures,
    allCreatives: Array<TaboolaItem & TaboolaItemStats>
  ): Promise<PerformanceInsight[]> {
    const insights: PerformanceInsight[] = []
    const peerComparison = this.compareToPeers(creative, allCreatives)

    // CTR insights
    if (peerComparison.ctrUplift > 0.15) {
      const reasons = []
      if (features.headline.hasNumerals) reasons.push('numerical element')
      if (features.image.hasFace) reasons.push('face presence')
      if (features.image.hasEyeContact) reasons.push('eye contact')
      if (features.headline.isQuestion) reasons.push('question format')
      
      insights.push({
        type: 'positive',
        feature: 'High CTR Performance',
        impact: `+${(peerComparison.ctrUplift * 100).toFixed(1)}% vs peers`,
        confidence: Math.min(95, 60 + reasons.length * 10),
        evidence: `CTR of ${(creative.ctr * 100).toFixed(2)}% with ${reasons.join(', ')}`,
        uplift: peerComparison.ctrUplift,
      })
    }

    // CPA insights
    if (creative.cpa && peerComparison.cpaUplift < -0.20) {
      insights.push({
        type: 'positive',
        feature: 'Efficient CPA',
        impact: `${(peerComparison.cpaUplift * 100).toFixed(1)}% lower CPA`,
        confidence: 85,
        evidence: `CPA of $${creative.cpa.toFixed(2)} vs peer average`,
        uplift: Math.abs(peerComparison.cpaUplift),
      })
    }

    // ROAS insights
    if (creative.roas && peerComparison.roasUplift > 0.25) {
      insights.push({
        type: 'positive',
        feature: 'Strong ROAS',
        impact: `+${(peerComparison.roasUplift * 100).toFixed(1)}% ROAS uplift`,
        confidence: 90,
        evidence: `ROAS of ${creative.roas.toFixed(2)}x`,
        uplift: peerComparison.roasUplift,
      })
    }

    // Negative insights
    if (peerComparison.ctrUplift < -0.25) {
      const issues = []
      if (features.headline.length > 50) issues.push('long headline')
      if (!features.image.hasFace) issues.push('no face')
      if (!features.headline.hasNumerals) issues.push('no numerical hook')

      insights.push({
        type: 'negative',
        feature: 'Low CTR Performance',
        impact: `${(peerComparison.ctrUplift * 100).toFixed(1)}% vs peers`,
        confidence: 75,
        evidence: `CTR of ${(creative.ctr * 100).toFixed(2)}% with potential issues: ${issues.join(', ')}`,
        uplift: Math.abs(peerComparison.ctrUplift),
      })
    }

    return insights
  }

  private async generateRecommendations(
    creative: TaboolaItem & TaboolaItemStats,
    features: CreativeFeatures,
    insights: PerformanceInsight[]
  ): Promise<CreativeRecommendation[]> {
    const recommendations: CreativeRecommendation[] = []

    // Headline recommendations
    const headlineRecs = await this.generateHeadlineRecommendations(creative, features, insights)
    recommendations.push(...headlineRecs)

    // Image recommendations
    const imageRecs = await this.generateImageRecommendations(creative, features, insights)
    recommendations.push(...imageRecs)

    return recommendations.sort((a, b) => b.confidence - a.confidence)
  }

  private async generateHeadlineRecommendations(
    creative: TaboolaItem & TaboolaItemStats,
    features: CreativeFeatures,
    insights: PerformanceInsight[]
  ): Promise<CreativeRecommendation[]> {
    const recommendations: CreativeRecommendation[] = []
    const specs = await this.specsClient.getCurrentSpecs()
    
    // Base variations of the headline
    const baseTitle = creative.title
    
    // Add numerals if missing
    if (!features.headline.hasNumerals) {
      const variations = [
        `7 ${baseTitle}`,
        `${baseTitle} in 5 Minutes`,
        `10 Best ${baseTitle}`,
        `${baseTitle} - 3 Simple Steps`,
      ]
      
      for (const variation of variations) {
        if (variation.length <= specs.headlineMaxChars) {
          recommendations.push({
            type: 'headline',
            content: variation,
            reason: 'Adding numbers can increase CTR by 15-25%',
            confidence: 85,
            basedOn: ['numerical_hook', 'ctr_optimization'],
          })
        }
      }
    }

    // Add question format if not a question
    if (!features.headline.isQuestion && features.headline.length < 45) {
      const questionVariations = [
        `How to ${baseTitle}?`,
        `Why ${baseTitle}?`,
        `What Makes ${baseTitle} Special?`,
      ]
      
      for (const variation of questionVariations) {
        if (variation.length <= specs.headlineMaxChars) {
          recommendations.push({
            type: 'headline',
            content: variation,
            reason: 'Question format increases engagement by 10-20%',
            confidence: 75,
            basedOn: ['question_format', 'engagement_boost'],
          })
        }
      }
    }

    // Add urgency if missing time elements
    if (features.headline.timeElements.length === 0) {
      const urgencyVariations = [
        `${baseTitle} - Limited Time`,
        `Get ${baseTitle} Today`,
        `${baseTitle} Now Available`,
      ]
      
      for (const variation of urgencyVariations) {
        if (variation.length <= specs.headlineMaxChars) {
          recommendations.push({
            type: 'headline',
            content: variation,
            reason: 'Urgency elements can improve conversion rates',
            confidence: 70,
            basedOn: ['urgency_optimization', 'conversion_boost'],
          })
        }
      }
    }

    return recommendations.slice(0, 12) // Limit to 12 as requested
  }

  private async generateImageRecommendations(
    creative: TaboolaItem & TaboolaItemStats,
    features: CreativeFeatures,
    insights: PerformanceInsight[]
  ): Promise<CreativeRecommendation[]> {
    const recommendations: CreativeRecommendation[] = []
    
    // Face recommendations
    if (!features.image.hasFace) {
      recommendations.push({
        type: 'image',
        content: 'Use image with clear face and direct eye contact (16:9, ~1200×674px)',
        reason: 'Images with faces typically see 20-30% higher CTR',
        confidence: 90,
        basedOn: ['face_detection', 'ctr_improvement'],
      })
    }

    // Eye contact recommendations
    if (features.image.hasFace && !features.image.hasEyeContact) {
      recommendations.push({
        type: 'image',
        content: 'Ensure subject makes direct eye contact with camera',
        reason: 'Eye contact increases engagement and trust',
        confidence: 85,
        basedOn: ['eye_contact', 'engagement_boost'],
      })
    }

    // Contrast recommendations
    if (features.image.contrast === 'low') {
      recommendations.push({
        type: 'image',
        content: 'Increase image contrast for better visibility in feed',
        reason: 'High contrast images perform better in social feeds',
        confidence: 75,
        basedOn: ['contrast_optimization', 'visibility'],
      })
    }

    // Simplicity recommendations
    if (features.image.complexity === 'complex') {
      recommendations.push({
        type: 'image',
        content: 'Simplify image composition - focus on single subject',
        reason: 'Simple, focused images often outperform complex ones',
        confidence: 80,
        basedOn: ['simplicity', 'focus_optimization'],
      })
    }

    // Storefront vs product recommendations
    if (features.destination.isEcommerce && !features.image.isStorefront) {
      recommendations.push({
        type: 'image',
        content: 'Test product close-up vs lifestyle/context shot',
        reason: 'Product imagery balance affects conversion rates',
        confidence: 70,
        basedOn: ['ecommerce_optimization', 'product_focus'],
      })
    }

    return recommendations.slice(0, 8) // Limit to 8 as requested
  }

  private calculateCreativeScore(
    creative: TaboolaItem & TaboolaItemStats,
    features: CreativeFeatures,
    insights: PerformanceInsight[]
  ): number {
    let score = 50 // Base score

    // Performance metrics (40% of score)
    if (creative.ctr > 0.01) score += 15
    if (creative.ctr > 0.02) score += 10
    if (creative.conversion_rate > 0.02) score += 10
    if (creative.cpa && creative.cpa < 20) score += 5

    // Feature bonuses (30% of score)
    if (features.headline.hasNumerals) score += 5
    if (features.image.hasFace) score += 8
    if (features.image.hasEyeContact) score += 5
    if (features.headline.benefitKeywords.length > 0) score += 3
    if (features.headline.ctaWords.length > 0) score += 3

    // Insight bonuses (30% of score)
    const positiveInsights = insights.filter(i => i.type === 'positive')
    const negativeInsights = insights.filter(i => i.type === 'negative')
    
    score += positiveInsights.length * 8
    score -= negativeInsights.length * 5

    return Math.max(0, Math.min(100, score))
  }

  private compareToPeers(
    creative: TaboolaItem & TaboolaItemStats,
    allCreatives: Array<TaboolaItem & TaboolaItemStats>
  ): { ctrUplift: number; cpaUplift: number; roasUplift: number; sampleSize: number } {
    // Filter peers (same campaign or similar spending level)
    const peers = allCreatives.filter(c => 
      c.id !== creative.id && 
      (c.campaign_id === creative.campaign_id || 
       Math.abs(c.spend - creative.spend) < creative.spend * 0.5)
    )

    if (peers.length === 0) {
      return { ctrUplift: 0, cpaUplift: 0, roasUplift: 0, sampleSize: 0 }
    }

    // Calculate peer averages
    const peerAvgCtr = peers.reduce((sum, p) => sum + p.ctr, 0) / peers.length
    const peerAvgCpa = peers.filter(p => p.cpa).reduce((sum, p) => sum + p.cpa!, 0) / peers.filter(p => p.cpa).length
    const peerAvgRoas = peers.filter(p => p.roas).reduce((sum, p) => sum + p.roas!, 0) / peers.filter(p => p.roas).length

    // Calculate uplifts
    const ctrUplift = peerAvgCtr > 0 ? (creative.ctr - peerAvgCtr) / peerAvgCtr : 0
    const cpaUplift = peerAvgCpa > 0 && creative.cpa ? (creative.cpa - peerAvgCpa) / peerAvgCpa : 0
    const roasUplift = peerAvgRoas > 0 && creative.roas ? (creative.roas - peerAvgRoas) / peerAvgRoas : 0

    return {
      ctrUplift,
      cpaUplift,
      roasUplift,
      sampleSize: peers.length,
    }
  }
}

// Singleton instance
let analysisEngine: AnalysisEngine | null = null

export const getAnalysisEngine = (): AnalysisEngine => {
  if (!analysisEngine) {
    analysisEngine = new AnalysisEngine()
  }
  return analysisEngine
}

export default AnalysisEngine