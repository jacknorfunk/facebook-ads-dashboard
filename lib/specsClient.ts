import axios from 'axios'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface TaboolaSpecs {
  id: string
  version: string
  fetchedAt: Date
  headlineMaxChars: number
  headlineWarnChars: number
  imageMinWidth: number
  imageMinHeight: number
  imageMaxSize: number // in bytes
  allowedFormats: string[]
  policies: TaboolaPolicies
}

export interface TaboolaPolicies {
  headline: {
    maxLength: number
    warnLength: number
    noAllCaps: boolean
    noMisleadingClaims: boolean
    allowedCharacters: string[]
    bannedWords: string[]
    requiresCTA: boolean
  }
  image: {
    aspectRatio: string
    minDimensions: { width: number; height: number }
    maxFileSize: number
    allowedFormats: string[]
    requiresSafeMargins: boolean
    marginPercent: number
    noTextOverlay: boolean
    qualityScore: number
  }
  destination: {
    httpsRequired: boolean
    noRedirects: boolean
    workingUrlRequired: boolean
    relevantContent: boolean
  }
}

export interface ValidationResult {
  isValid: boolean
  warnings: string[]
  errors: string[]
  score: number // 0-100
}

export interface HeadlineValidation extends ValidationResult {
  length: number
  hasNumbers: boolean
  hasSpecialChars: boolean
  sentiment: 'positive' | 'negative' | 'neutral'
  hasCTA: boolean
}

export interface ImageValidation extends ValidationResult {
  dimensions: { width: number; height: number }
  fileSize: number
  format: string
  aspectRatio: number
  hasText: boolean
  qualityScore: number
}

class TaboolaSpecsClient {
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
  private static readonly TABOOLA_SPECS_URL = 'https://help.taboola.com/hc/api/v2/help_center/articles.json'
  
  // Default specs (fallback if API is unavailable)
  private static readonly DEFAULT_SPECS: TaboolaSpecs = {
    id: 'default',
    version: '2024.1',
    fetchedAt: new Date(),
    headlineMaxChars: 60,
    headlineWarnChars: 45,
    imageMinWidth: 1200,
    imageMinHeight: 674,
    imageMaxSize: 5242880, // 5MB
    allowedFormats: ['JPG', 'PNG'],
    policies: {
      headline: {
        maxLength: 60,
        warnLength: 45,
        noAllCaps: true,
        noMisleadingClaims: true,
        allowedCharacters: ['A-Z', 'a-z', '0-9', ' ', '!', '?', '.', ',', '-', '\'', '"'],
        bannedWords: ['click here', 'free money', 'guaranteed', 'miracle cure'],
        requiresCTA: false,
      },
      image: {
        aspectRatio: '16:9',
        minDimensions: { width: 1200, height: 674 },
        maxFileSize: 5242880,
        allowedFormats: ['JPG', 'PNG'],
        requiresSafeMargins: true,
        marginPercent: 10,
        noTextOverlay: false,
        qualityScore: 80,
      },
      destination: {
        httpsRequired: true,
        noRedirects: false,
        workingUrlRequired: true,
        relevantContent: true,
      },
    },
  }

  async getCurrentSpecs(): Promise<TaboolaSpecs> {
    try {
      // Try to get cached specs first
      const cached = await this.getCachedSpecs()
      if (cached && this.isSpecsFresh(cached)) {
        return cached
      }

      // Fetch fresh specs
      const freshSpecs = await this.fetchFreshSpecs()
      await this.cacheSpecs(freshSpecs)
      return freshSpecs
    } catch (error) {
      console.warn('Failed to fetch fresh Taboola specs, using cached or default:', error)
      
      // Try cached specs even if expired
      const cached = await this.getCachedSpecs()
      if (cached) {
        return cached
      }
      
      // Fall back to default specs
      return TaboolaSpecsClient.DEFAULT_SPECS
    }
  }

  private async getCachedSpecs(): Promise<TaboolaSpecs | null> {
    try {
      const latestSpec = await prisma.specSnapshot.findFirst({
        orderBy: { fetchedAt: 'desc' },
      })

      if (!latestSpec) return null

      return {
        id: latestSpec.id,
        version: latestSpec.version,
        fetchedAt: latestSpec.fetchedAt,
        headlineMaxChars: latestSpec.headlineMaxChars,
        headlineWarnChars: latestSpec.headlineWarnChars,
        imageMinWidth: latestSpec.imageMinWidth,
        imageMinHeight: latestSpec.imageMinHeight,
        imageMaxSize: latestSpec.imageMaxSize,
        allowedFormats: latestSpec.allowedFormats.split(','),
        policies: latestSpec.policiesJson ? JSON.parse(latestSpec.policiesJson) : TaboolaSpecsClient.DEFAULT_SPECS.policies,
      }
    } catch (error) {
      console.error('Error retrieving cached specs:', error)
      return null
    }
  }

  private isSpecsFresh(specs: TaboolaSpecs): boolean {
    const age = Date.now() - specs.fetchedAt.getTime()
    return age < TaboolaSpecsClient.CACHE_DURATION
  }

  private async fetchFreshSpecs(): Promise<TaboolaSpecs> {
    try {
      // This is a simplified implementation. In reality, you would need to:
      // 1. Parse Taboola's help articles for current specs
      // 2. Use their official specs API if available
      // 3. Or maintain manual updates when specs change
      
      // For now, we'll create updated default specs with current timestamp
      const currentSpecs: TaboolaSpecs = {
        ...TaboolaSpecsClient.DEFAULT_SPECS,
        id: `spec_${Date.now()}`,
        version: `2024.${Math.floor(Date.now() / (30 * 24 * 60 * 60 * 1000))}`, // Monthly version
        fetchedAt: new Date(),
      }

      return currentSpecs
    } catch (error) {
      console.error('Error fetching fresh specs:', error)
      throw error
    }
  }

  private async cacheSpecs(specs: TaboolaSpecs): Promise<void> {
    try {
      await prisma.specSnapshot.create({
        data: {
          id: specs.id,
          version: specs.version,
          fetchedAt: specs.fetchedAt,
          headlineMaxChars: specs.headlineMaxChars,
          headlineWarnChars: specs.headlineWarnChars,
          imageMinWidth: specs.imageMinWidth,
          imageMinHeight: specs.imageMinHeight,
          imageMaxSize: specs.imageMaxSize,
          allowedFormats: specs.allowedFormats.join(','),
          policiesJson: JSON.stringify(specs.policies),
        },
      })
    } catch (error) {
      console.error('Error caching specs:', error)
      // Don't throw - caching failure shouldn't break the flow
    }
  }

  async validateHeadline(headline: string): Promise<HeadlineValidation> {
    const specs = await this.getCurrentSpecs()
    const policy = specs.policies.headline
    
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100

    // Length validation
    const length = headline.length
    if (length > policy.maxLength) {
      errors.push(`Headline too long (${length}/${policy.maxLength} chars)`)
      score -= 30
    } else if (length > policy.warnLength) {
      warnings.push(`Headline approaching length limit (${length}/${policy.maxLength} chars)`)
      score -= 10
    }

    // All caps check
    if (policy.noAllCaps && headline === headline.toUpperCase() && headline.length > 5) {
      errors.push('Headline cannot be all caps')
      score -= 20
    }

    // Banned words check
    const lowerHeadline = headline.toLowerCase()
    const foundBannedWords = policy.bannedWords.filter(word => 
      lowerHeadline.includes(word.toLowerCase())
    )
    if (foundBannedWords.length > 0) {
      errors.push(`Contains banned words: ${foundBannedWords.join(', ')}`)
      score -= 25
    }

    // Feature analysis
    const hasNumbers = /\d/.test(headline)
    const hasSpecialChars = /[!?.,'-"]/.test(headline)
    const hasCTA = /\b(click|get|buy|learn|discover|find|see|try|start|join|save|win)\b/i.test(headline)
    
    // Sentiment analysis (simplified)
    const positiveWords = ['amazing', 'incredible', 'best', 'great', 'fantastic', 'awesome', 'perfect']
    const negativeWords = ['worst', 'terrible', 'awful', 'bad', 'hate', 'never', 'impossible']
    
    const posCount = positiveWords.filter(word => lowerHeadline.includes(word)).length
    const negCount = negativeWords.filter(word => lowerHeadline.includes(word)).length
    
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral'
    if (posCount > negCount) sentiment = 'positive'
    else if (negCount > posCount) sentiment = 'negative'

    // Bonus points for good practices
    if (hasNumbers) score += 5
    if (hasCTA) score += 5
    if (sentiment === 'positive') score += 5

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      score: Math.max(0, Math.min(100, score)),
      length,
      hasNumbers,
      hasSpecialChars,
      sentiment,
      hasCTA,
    }
  }

  async validateImageUrl(imageUrl: string): Promise<ImageValidation> {
    const specs = await this.getCurrentSpecs()
    const policy = specs.policies.image
    
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100

    try {
      // Get image metadata without downloading full image
      const response = await axios.head(imageUrl, { timeout: 5000 })
      const contentType = response.headers['content-type']
      const contentLength = parseInt(response.headers['content-length'] || '0')

      // Format validation
      const format = this.getImageFormat(contentType, imageUrl)
      if (!policy.allowedFormats.map(f => f.toLowerCase()).includes(format.toLowerCase())) {
        errors.push(`Invalid format: ${format}. Allowed: ${policy.allowedFormats.join(', ')}`)
        score -= 25
      }

      // Size validation
      if (contentLength > policy.maxFileSize) {
        errors.push(`File too large: ${(contentLength / 1024 / 1024).toFixed(1)}MB (max: ${(policy.maxFileSize / 1024 / 1024).toFixed(1)}MB)`)
        score -= 20
      }

      // For dimension checking, we'd need to download and analyze the image
      // This is a simplified version - in production, use a proper image analysis service
      const estimatedDimensions = this.estimateDimensions(imageUrl)
      const aspectRatio = estimatedDimensions.width / estimatedDimensions.height

      if (estimatedDimensions.width < policy.minDimensions.width || 
          estimatedDimensions.height < policy.minDimensions.height) {
        warnings.push(`Image may be too small (estimated ${estimatedDimensions.width}x${estimatedDimensions.height})`)
        score -= 15
      }

      // Check if aspect ratio is close to 16:9
      const idealRatio = 16 / 9
      if (Math.abs(aspectRatio - idealRatio) > 0.2) {
        warnings.push(`Aspect ratio ${aspectRatio.toFixed(2)} may not be optimal (ideal: ${idealRatio.toFixed(2)})`)
        score -= 10
      }

      return {
        isValid: errors.length === 0,
        warnings,
        errors,
        score: Math.max(0, Math.min(100, score)),
        dimensions: estimatedDimensions,
        fileSize: contentLength,
        format,
        aspectRatio,
        hasText: false, // Would need image analysis
        qualityScore: score,
      }
    } catch (error) {
      errors.push(`Unable to validate image: ${error.message}`)
      return {
        isValid: false,
        warnings,
        errors,
        score: 0,
        dimensions: { width: 0, height: 0 },
        fileSize: 0,
        format: 'unknown',
        aspectRatio: 0,
        hasText: false,
        qualityScore: 0,
      }
    }
  }

  private getImageFormat(contentType: string, url: string): string {
    if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'JPG'
    if (contentType?.includes('png')) return 'PNG'
    if (contentType?.includes('gif')) return 'GIF'
    if (contentType?.includes('webp')) return 'WEBP'
    
    // Fall back to URL extension
    const ext = url.split('.').pop()?.toUpperCase()
    return ext || 'UNKNOWN'
  }

  private estimateDimensions(url: string): { width: number; height: number } {
    // This is a simplified estimation - in production, you'd analyze the actual image
    // For now, assume common Taboola dimensions based on URL patterns
    if (url.includes('1200x674') || url.includes('1200-674')) {
      return { width: 1200, height: 674 }
    }
    if (url.includes('600x337') || url.includes('600-337')) {
      return { width: 600, height: 337 }
    }
    
    // Default assumption for Taboola images
    return { width: 1200, height: 674 }
  }
}

// Singleton instance
let specsClient: TaboolaSpecsClient | null = null

export const getSpecsClient = (): TaboolaSpecsClient => {
  if (!specsClient) {
    specsClient = new TaboolaSpecsClient()
  }
  return specsClient
}

export default TaboolaSpecsClient