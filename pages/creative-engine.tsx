import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Image from 'next/image'
import axios from 'axios'

// Types
interface Creative {
  id: string
  campaign_id: string
  title: string
  thumbnail: { url: string }
  url: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpc: number
  conversions: number
  cpa?: number
  roas?: number
}

interface AnalysisResult {
  creative: Creative
  features: any
  insights: Array<{
    type: 'positive' | 'negative' | 'neutral'
    feature: string
    impact: string
    confidence: number
    evidence: string
  }>
  recommendations: Array<{
    type: 'headline' | 'image'
    content: string
    reason: string
    confidence: number
  }>
  score: number
  peerComparison: {
    ctrUplift: number
    cpaUplift: number
    roasUplift: number
  }
}

interface Action {
  id: string
  creativeId: string
  type: 'tested' | 'scaled' | 'paused'
  reasonShort: string
  reasonDetail: string
  decidedBy: 'rule' | 'human' | 'model'
  decidedAt: string
  creative: {
    headline: string
    thumbnailUrl: string
    campaignId: string
  }
}

interface Specs {
  version: string
  fetchedAt: string
  headlineMaxChars: number
  headlineWarnChars: number
  imageMinWidth: number
  imageMinHeight: number
  policies: any
}

export default function CreativeEngine() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [analysis, setAnalysis] = useState<AnalysisResult[]>([])
  const [actions, setActions] = useState<Action[]>([])
  const [specs, setSpecs] = useState<Specs | null>(null)
  
  // Filters
  const [dateRange, setDateRange] = useState('7')
  const [sortBy, setSortBy] = useState('score')
  const [showLifecyclePanel, setShowLifecyclePanel] = useState(true)
  const [selectedCreative, setSelectedCreative] = useState<string | null>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  // Load data
  useEffect(() => {
    if (status === 'authenticated') {
      loadData()
      loadSpecs()
      loadRecentActions()
    }
  }, [status, dateRange])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0]

      const response = await axios.get('/api/taboola/items', {
        params: {
          start_date: startDate,
          end_date: endDate,
          analyze: 'true',
          update_lifecycle: 'true',
          order_by: 'spend',
          order_direction: 'desc',
        },
      })

      if (response.data.success) {
        setCreatives(response.data.data.items)
        setAnalysis(response.data.data.analysis || [])
      } else {
        setError(response.data.error || 'Failed to load data')
      }
    } catch (err: any) {
      console.error('Load data error:', err)
      setError(err.response?.data?.error || err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadSpecs = async () => {
    try {
      const response = await axios.get('/api/specs')
      if (response.data.success) {
        setSpecs(response.data.data.specs)
      }
    } catch (err) {
      console.error('Load specs error:', err)
    }
  }

  const loadRecentActions = async () => {
    try {
      const response = await axios.get('/api/lifecycle/actions', {
        params: { limit: 20, include_insights: 'true' },
      })
      if (response.data.success) {
        setActions(response.data.data.actions)
      }
    } catch (err) {
      console.error('Load actions error:', err)
    }
  }

  const handleAction = async (creativeId: string, type: 'tested' | 'scaled' | 'paused', reason: string) => {
    try {
      const creative = creatives.find(c => c.id === creativeId)
      if (!creative) return

      const response = await axios.post('/api/lifecycle/action', {
        creativeId,
        type,
        reasonShort: `${type.charAt(0).toUpperCase() + type.slice(1)} by user`,
        reasonDetail: reason || `Creative ${type} based on performance analysis`,
        decidedBy: 'human',
        inputsJson: {
          metrics: {
            spend: creative.spend,
            ctr: creative.ctr,
            cpa: creative.cpa,
            roas: creative.roas,
          },
        },
      })

      if (response.data.success) {
        // Refresh actions
        loadRecentActions()
        // Show success message
        alert(`Creative ${type} successfully!`)
      }
    } catch (err: any) {
      console.error('Action error:', err)
      alert(`Failed to ${type} creative: ${err.response?.data?.error || err.message}`)
    }
  }

  const getSortedAnalysis = () => {
    if (!analysis.length) return []
    
    return [...analysis].sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.score - a.score
        case 'spend':
          return b.creative.spend - a.creative.spend
        case 'ctr':
          return b.creative.ctr - a.creative.ctr
        case 'conversions':
          return b.creative.conversions - a.creative.conversions
        case 'roas':
          return (b.creative.roas || 0) - (a.creative.roas || 0)
        default:
          return 0
      }
    })
  }

  const getInsightChip = (feature: any) => {
    const chips = []
    if (feature?.headline?.hasNumerals) chips.push('Numbers')
    if (feature?.image?.hasFace) chips.push('Face')
    if (feature?.image?.hasEyeContact) chips.push('Eye Contact')
    if (feature?.headline?.isQuestion) chips.push('Question')
    if (feature?.headline?.benefitKeywords?.length > 0) chips.push('Benefits')
    return chips
  }

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || value === null) return 'N/A'
    return `$${value.toFixed(2)}`
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Creative Analysis Engine...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <h3 className="text-red-800 font-semibold mb-2">Connection Error</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Creative Analysis Engine - Voluum Dashboard</title>
        <meta name="description" content="Taboola Creative Analysis Engine with performance insights and recommendations" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Creative Analysis Engine</h1>
                <p className="text-gray-600 mt-2">
                  Analyze creative performance and optimize with AI-powered insights
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowLifecyclePanel(!showLifecyclePanel)}
                  className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  {showLifecyclePanel ? 'Hide' : 'Show'} Lifecycle Log
                </button>
                <button
                  onClick={loadData}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <span className="text-sm">🔄</span>
                  Refresh Data
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">Date Range:</label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 text-sm"
                >
                  <option value="7">Last 7 days</option>
                  <option value="14">Last 14 days</option>
                  <option value="30">Last 30 days</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1 text-sm"
                >
                  <option value="score">Analysis Score</option>
                  <option value="spend">Spend</option>
                  <option value="ctr">CTR</option>
                  <option value="conversions">Conversions</option>
                  <option value="roas">ROAS</option>
                </select>
              </div>
              {specs && (
                <div className="ml-auto text-sm text-gray-500">
                  Specs: v{specs.version} | {new Date(specs.fetchedAt).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-6">
            {/* Main Content */}
            <div className={`${showLifecyclePanel ? 'w-2/3' : 'w-full'} transition-all duration-300`}>
              {/* Performance Table */}
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <div className="px-6 py-4 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Creative Performance Analysis ({analysis.length} items)
                  </h2>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Creative
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Insights
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Metrics
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Score
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {getSortedAnalysis().map((result) => (
                        <tr key={result.creative.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-16 w-16">
                                <Image
                                  src={result.creative.thumbnail.url}
                                  alt="Creative thumbnail"
                                  width={64}
                                  height={64}
                                  className="rounded-lg object-cover"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.src = '/placeholder-image.jpg'
                                  }}
                                />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                                  {result.creative.title}
                                </div>
                                <div className="text-sm text-gray-500">
                                  Campaign: {result.creative.campaign_id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1 mb-2">
                              {getInsightChip(result.features).map((chip, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                                >
                                  {chip}
                                </span>
                              ))}
                            </div>
                            <div className="space-y-1">
                              {result.insights.slice(0, 2).map((insight, idx) => (
                                <div
                                  key={idx}
                                  className={`text-xs px-2 py-1 rounded ${
                                    insight.type === 'positive'
                                      ? 'bg-green-100 text-green-800'
                                      : insight.type === 'negative'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {insight.feature}: {insight.impact}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="space-y-1">
                              <div>Spend: {formatCurrency(result.creative.spend)}</div>
                              <div>CTR: {formatPercentage(result.creative.ctr)}</div>
                              <div>Conv: {result.creative.conversions}</div>
                              <div>CPA: {formatCurrency(result.creative.cpa)}</div>
                              {result.creative.roas && (
                                <div>ROAS: {result.creative.roas.toFixed(2)}x</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className={`text-2xl font-bold ${
                                result.score >= 80 ? 'text-green-600' :
                                result.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                              }`}>
                                {result.score}
                              </div>
                              <div className="ml-2 text-xs text-gray-500">/100</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleAction(result.creative.id, 'scaled', 'Strong performance metrics')}
                                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                Scale
                              </button>
                              <button
                                onClick={() => handleAction(result.creative.id, 'paused', 'Performance below threshold')}
                                className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                              >
                                Pause
                              </button>
                              <button
                                onClick={() => setSelectedCreative(
                                  selectedCreative === result.creative.id ? null : result.creative.id
                                )}
                                className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                              >
                                Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recommendations Panel */}
              {selectedCreative && (
                <div className="mt-6 bg-white rounded-lg shadow-sm border">
                  <div className="px-6 py-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Recommendations for Creative {selectedCreative}
                    </h3>
                  </div>
                  <div className="p-6">
                    {(() => {
                      const result = analysis.find(r => r.creative.id === selectedCreative)
                      if (!result) return <p>No recommendations available</p>
                      
                      return (
                        <div className="grid md:grid-cols-2 gap-6">
                          {/* Headlines */}
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">Headline Variations</h4>
                            <div className="space-y-2">
                              {result.recommendations
                                .filter(r => r.type === 'headline')
                                .slice(0, 6)
                                .map((rec, idx) => (
                                  <div key={idx} className="p-3 border rounded-lg">
                                    <div className="font-medium text-sm">{rec.content}</div>
                                    <div className="text-xs text-gray-600 mt-1">{rec.reason}</div>
                                    <div className="text-xs text-blue-600 mt-1">
                                      Confidence: {rec.confidence}%
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>

                          {/* Image Recommendations */}
                          <div>
                            <h4 className="font-medium text-gray-900 mb-3">Image Optimization</h4>
                            <div className="space-y-2">
                              {result.recommendations
                                .filter(r => r.type === 'image')
                                .slice(0, 4)
                                .map((rec, idx) => (
                                  <div key={idx} className="p-3 border rounded-lg">
                                    <div className="font-medium text-sm">{rec.content}</div>
                                    <div className="text-xs text-gray-600 mt-1">{rec.reason}</div>
                                    <div className="text-xs text-blue-600 mt-1">
                                      Confidence: {rec.confidence}%
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Lifecycle Log Side Panel */}
            {showLifecyclePanel && (
              <div className="w-1/3">
                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="px-6 py-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">Lifecycle Log</h3>
                  </div>
                  <div className="p-4 max-h-96 overflow-y-auto">
                    <div className="space-y-3">
                      {actions.map((action) => (
                        <div key={action.id} className="flex items-start space-x-3">
                          <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                            action.type === 'scaled' ? 'bg-green-500' :
                            action.type === 'paused' ? 'bg-red-500' : 'bg-yellow-500'
                          }`}></div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900">
                              {action.reasonShort}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {action.creative.headline}
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(action.decidedAt).toLocaleString()}
                            </div>
                          </div>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            action.type === 'scaled' ? 'bg-green-100 text-green-800' :
                            action.type === 'paused' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {action.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}