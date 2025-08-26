import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) return null

  return (
    <>
      <Head>
        <title>Voluum Dashboard - Enhanced</title>
        <meta name="description" content="Voluum Dashboard with Taboola Creative Analysis Engine" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Navigation Header */}
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center">
                  <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">V</span>
                  </div>
                  <span className="ml-2 text-xl font-bold text-gray-900">Voluum Dashboard</span>
                </div>
                
                {/* Navigation Links */}
                <div className="hidden md:ml-6 md:flex md:space-x-8">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      activeTab === 'overview'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('campaigns')}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      activeTab === 'campaigns'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Campaigns
                  </button>
                  <Link
                    href="/creative-engine"
                    className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  >
                    <span className="mr-1">🎯</span>
                    Creative Analysis Engine
                  </Link>
                </div>
              </div>

              {/* User Menu */}
              <div className="flex items-center">
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-700">
                    Welcome, {session.user?.name || 'User'}
                  </span>
                  <button
                    onClick={() => signOut()}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'overview' && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Dashboard Overview</h1>
                <p className="text-gray-600 mt-2">
                  Welcome to your enhanced Voluum Dashboard with Taboola Creative Analysis Engine
                </p>
              </div>

              {/* Quick Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <span className="text-blue-600 text-sm">📊</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Campaigns</p>
                      <p className="text-2xl font-semibold text-gray-900">--</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-green-600 text-sm">💰</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Spend</p>
                      <p className="text-2xl font-semibold text-gray-900">--</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                        <span className="text-yellow-600 text-sm">🎯</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Conversions</p>
                      <p className="text-2xl font-semibold text-gray-900">--</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="text-purple-600 text-sm">📈</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">ROAS</p>
                      <p className="text-2xl font-semibold text-gray-900">--</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature Highlight */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-8 text-white mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">🎯 Creative Analysis Engine</h2>
                    <p className="text-blue-100 mb-4">
                      Analyze your Taboola creatives with AI-powered insights, get recommendations, 
                      and track the full creative lifecycle with automated learning.
                    </p>
                    <ul className="text-sm text-blue-100 space-y-1 mb-6">
                      <li>• Real-time creative performance analysis</li>
                      <li>• AI-generated headline and image recommendations</li>
                      <li>• Automated action logging and outcome learning</li>
                      <li>• Spec-compliant content validation</li>
                    </ul>
                  </div>
                  <div className="flex-shrink-0 ml-8">
                    <Link href="/creative-engine">
                      <button className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
                        Launch Analysis Engine
                      </button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-4">
                    <Link href="/creative-engine">
                      <button className="w-full text-left p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center">
                          <span className="text-2xl mr-3">🎯</span>
                          <div>
                            <div className="font-medium text-gray-900">Analyze Creatives</div>
                            <div className="text-sm text-gray-600">Get AI-powered insights and recommendations</div>
                          </div>
                        </div>
                      </button>
                    </Link>
                    
                    <button className="w-full text-left p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">📊</span>
                        <div>
                          <div className="font-medium text-gray-900">View Reports</div>
                          <div className="text-sm text-gray-600">Access detailed performance reports</div>
                        </div>
                      </div>
                    </button>
                    
                    <button className="w-full text-left p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center">
                        <span className="text-2xl mr-3">⚙️</span>
                        <div>
                          <div className="font-medium text-gray-900">Settings</div>
                          <div className="text-sm text-gray-600">Configure dashboard preferences</div>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-4 text-sm text-gray-600">
                    <p>• Dashboard initialized</p>
                    <p>• Authentication system active</p>
                    <p>• Creative Analysis Engine ready</p>
                    <p>• Taboola API integration configured</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
                <p className="text-gray-600 mt-2">
                  Campaign management and performance overview
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                <div className="text-6xl mb-4">🚧</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Coming Soon</h3>
                <p className="text-gray-600 mb-6">
                  Campaign management features are currently under development.
                  Use the Creative Analysis Engine for detailed creative performance analysis.
                </p>
                <Link href="/creative-engine">
                  <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                    Go to Creative Analysis
                  </button>
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}