import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'

// Types for Taboola API responses
export interface TaboolaAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
}

export interface TaboolaItem {
  id: string
  campaign_id: string
  title: string
  thumbnail: {
    url: string
  }
  url: string
  status: string
  created_date: string
  modified_date: string
  is_active: boolean
}

export interface TaboolaItemStats {
  item_id: string
  campaign_id: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  cpm: number
  conversions: number
  conversion_rate: number
  cpa: number
  roas?: number
  revenue?: number
}

export interface TaboolaCampaign {
  id: string
  name: string
  advertiser_id: string
  status: string
  cpc: number
  daily_cap: number
  spending_limit: number
  spent_today: number
  approval_state: string
  is_active: boolean
  start_date: string
  end_date?: string
}

export interface TaboolaReportOptions {
  start_date: string
  end_date: string
  dimensions?: string[]
  filters?: { [key: string]: any }
  order_by?: string
  order_direction?: 'asc' | 'desc'
}

export interface TaboolaApiError {
  error: string
  error_description: string
  status: number
}

class TaboolaClient {
  private baseURL = 'https://backstage.taboola.com/backstage/api/1.0'
  private authURL = 'https://backstage.taboola.com/backstage/oauth/token'
  private client: AxiosInstance
  private accessToken: string | null = null
  private tokenExpiry: number | null = null
  private clientId: string
  private clientSecret: string
  private accountId: string

  constructor() {
    this.clientId = process.env.TABOOLA_CLIENT_ID || ''
    this.clientSecret = process.env.TABOOLA_CLIENT_SECRET || ''
    this.accountId = process.env.TABOOLA_ACCOUNT_ID || ''

    if (!this.clientId || !this.clientSecret || !this.accountId) {
      throw new Error('Taboola credentials not properly configured. Check environment variables.')
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    // Add request interceptor to include auth header
    this.client.interceptors.request.use(async (config) => {
      await this.ensureValidToken()
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`
      }
      return config
    })

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, try to refresh
          this.accessToken = null
          this.tokenExpiry = null
          
          // Retry the request once
          if (!error.config._retry) {
            error.config._retry = true
            await this.ensureValidToken()
            error.config.headers.Authorization = `Bearer ${this.accessToken}`
            return this.client.request(error.config)
          }
        }
        throw this.formatError(error)
      }
    )
  }

  private async authenticate(): Promise<TaboolaAuthResponse> {
    try {
      const response = await axios.post(this.authURL, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        transformRequest: [(data) => {
          const params = new URLSearchParams()
          Object.keys(data).forEach(key => params.append(key, data[key]))
          return params.toString()
        }],
      })

      const authData: TaboolaAuthResponse = response.data
      this.accessToken = authData.access_token
      this.tokenExpiry = Date.now() + (authData.expires_in * 1000) - 60000 // 1 minute buffer

      return authData
    } catch (error) {
      throw this.formatError(error, 'Authentication failed')
    }
  }

  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
      await this.authenticate()
    }
  }

  private formatError(error: any, context?: string): TaboolaApiError {
    const baseMessage = context ? `${context}: ` : ''
    
    if (error.response) {
      return {
        error: `${baseMessage}${error.response.data?.error || error.response.statusText}`,
        error_description: error.response.data?.error_description || error.response.data?.message || 'Unknown API error',
        status: error.response.status,
      }
    } else if (error.request) {
      return {
        error: `${baseMessage}Network error`,
        error_description: 'No response received from Taboola API',
        status: 0,
      }
    } else {
      return {
        error: `${baseMessage}Request setup error`,
        error_description: error.message,
        status: 0,
      }
    }
  }

  // Public API methods
  async getCampaigns(): Promise<TaboolaCampaign[]> {
    try {
      const response = await this.client.get(`/${this.accountId}/campaigns`)
      return response.data.results || []
    } catch (error) {
      throw this.formatError(error, 'Failed to fetch campaigns')
    }
  }

  async getCampaignItems(campaignId: string): Promise<TaboolaItem[]> {
    try {
      const response = await this.client.get(`/${this.accountId}/campaigns/${campaignId}/items`)
      return response.data.results || []
    } catch (error) {
      throw this.formatError(error, `Failed to fetch items for campaign ${campaignId}`)
    }
  }

  async getAllItems(): Promise<TaboolaItem[]> {
    try {
      const campaigns = await this.getCampaigns()
      const activeCampaigns = campaigns.filter(c => c.is_active)
      
      const itemsPromises = activeCampaigns.map(campaign => 
        this.getCampaignItems(campaign.id)
      )
      
      const itemsArrays = await Promise.all(itemsPromises)
      return itemsArrays.flat()
    } catch (error) {
      throw this.formatError(error, 'Failed to fetch all items')
    }
  }

  async getItemStats(options: TaboolaReportOptions): Promise<TaboolaItemStats[]> {
    try {
      const params = {
        start_date: options.start_date,
        end_date: options.end_date,
        dimensions: options.dimensions?.join(',') || 'item_id,campaign_id',
        order_by: options.order_by || 'spend',
        order_direction: options.order_direction || 'desc',
        ...options.filters,
      }

      const response = await this.client.get(`/${this.accountId}/reports/campaign-summary/dimensions`, {
        params,
      })

      return response.data.results?.map((result: any) => ({
        item_id: result.item_id,
        campaign_id: result.campaign_id,
        spend: parseFloat(result.spend || 0),
        impressions: parseInt(result.impressions || 0),
        clicks: parseInt(result.clicks || 0),
        ctr: parseFloat(result.ctr || 0),
        cpc: parseFloat(result.cpc || 0),
        cpm: parseFloat(result.cpm || 0),
        conversions: parseInt(result.conversions || 0),
        conversion_rate: parseFloat(result.conversion_rate || 0),
        cpa: result.cpa ? parseFloat(result.cpa) : null,
        roas: result.roas ? parseFloat(result.roas) : null,
        revenue: result.revenue ? parseFloat(result.revenue) : null,
      })) || []
    } catch (error) {
      throw this.formatError(error, 'Failed to fetch item stats')
    }
  }

  async getItemsWithStats(options: TaboolaReportOptions): Promise<Array<TaboolaItem & TaboolaItemStats>> {
    try {
      const [items, stats] = await Promise.all([
        this.getAllItems(),
        this.getItemStats(options),
      ])

      // Merge items with their stats
      const itemsMap = new Map(items.map(item => [item.id, item]))
      
      return stats.map(stat => {
        const item = itemsMap.get(stat.item_id)
        if (!item) {
          // Create a minimal item if not found
          return {
            id: stat.item_id,
            campaign_id: stat.campaign_id,
            title: 'Unknown Item',
            thumbnail: { url: '' },
            url: '',
            status: 'unknown',
            created_date: '',
            modified_date: '',
            is_active: false,
            ...stat,
          }
        }
        
        return {
          ...item,
          ...stat,
        }
      })
    } catch (error) {
      throw this.formatError(error, 'Failed to fetch items with stats')
    }
  }

  // Test connection
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.ensureValidToken()
      const campaigns = await this.getCampaigns()
      return {
        success: true,
        message: `Successfully connected. Found ${campaigns.length} campaigns.`,
      }
    } catch (error) {
      const taboolaError = error as TaboolaApiError
      return {
        success: false,
        message: `Connection failed: ${taboolaError.error_description}`,
      }
    }
  }
}

// Singleton instance
let taboolaClient: TaboolaClient | null = null

export const getTaboolaClient = (): TaboolaClient => {
  if (!taboolaClient) {
    taboolaClient = new TaboolaClient()
  }
  return taboolaClient
}

export default TaboolaClient