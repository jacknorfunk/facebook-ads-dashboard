// server.js - Main backend server
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Facebook API configuration
const FACEBOOK_API_BASE = 'https://graph.facebook.com/v18.0';
const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.AD_ACCOUNT_ID;

// Facebook API helper function
async function callFacebookAPI(endpoint, params = {}) {
  try {
    const url = `${FACEBOOK_API_BASE}/${endpoint}`;
    console.log('Calling Facebook API:', url);
    
    const response = await axios.get(url, {
      params: {
        access_token: ACCESS_TOKEN,
        ...params
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log('Facebook API Response:', response.status);
    return response.data;
  } catch (error) {
    console.error('Facebook API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Facebook API Error');
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    env: {
      hasAccessToken: !!ACCESS_TOKEN,
      hasAccountId: !!AD_ACCOUNT_ID,
      accessTokenLength: ACCESS_TOKEN ? ACCESS_TOKEN.length : 0
    }
  });
});

// Test Facebook API connection
app.get('/api/test-connection', async (req, res) => {
  try {
    console.log('Testing Facebook API connection...');
    
    if (!ACCESS_TOKEN) {
      return res.status(500).json({ 
        success: false, 
        error: 'Facebook Access Token not found in environment variables' 
      });
    }
    
    if (!AD_ACCOUNT_ID) {
      return res.status(500).json({ 
        success: false, 
        error: 'Ad Account ID not found in environment variables' 
      });
    }
    
    const response = await callFacebookAPI(`act_${AD_ACCOUNT_ID}`, {
      fields: 'name,account_status,currency'
    });
    
    res.json({ 
      success: true, 
      account: response,
      message: 'Successfully connected to Facebook API'
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get account overview
app.get('/api/account-overview', async (req, res) => {
  try {
    const { date_preset = 'last_30d' } = req.query;
    
    console.log('Fetching account overview...');
    
    // Get account insights
    const accountInsights = await callFacebookAPI(`act_${AD_ACCOUNT_ID}/insights`, {
      fields: 'spend,impressions,clicks,ctr,cpc,cpm,conversions,conversion_values,cost_per_conversion',
      date_preset,
      level: 'account'
    });

    const data = accountInsights.data && accountInsights.data[0] ? accountInsights.data[0] : {};
    
    const overview = {
      totalSpend: parseFloat(data.spend || 0),
      totalRevenue: parseFloat(data.conversion_values || 0),
      totalConversions: parseInt(data.conversions || 0),
      totalClicks: parseInt(data.clicks || 0),
      totalImpressions: parseInt(data.impressions || 0),
      averageCTR: parseFloat(data.ctr || 0),
      averageCPC: parseFloat(data.cpc || 0),
      averageCPM: parseFloat(data.cpm || 0),
      averageCPA: parseFloat(data.cost_per_conversion || 0)
    };

    // Calculate ROAS
    overview.totalROAS = overview.totalRevenue > 0 ? overview.totalRevenue / overview.totalSpend : 0;

    console.log('Account overview fetched successfully');
    res.json(overview);
  } catch (error) {
    console.error('Error fetching account overview:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get campaigns performance
app.get('/api/campaigns', async (req, res) => {
  try {
    const { date_preset = 'last_30d' } = req.query;
    
    console.log('Fetching campaigns...');
    
    // Get campaigns with insights
    const campaigns = await callFacebookAPI(`act_${AD_ACCOUNT_ID}/campaigns`, {
      fields: 'name,status,objective',
      limit: 50
    });

    // Get insights for each campaign separately to avoid timeout
    const campaignData = [];
    
    for (const campaign of campaigns.data || []) {
      try {
        const insights = await callFacebookAPI(`${campaign.id}/insights`, {
          fields: 'spend,impressions,clicks,ctr,cpc,cpm,conversions,conversion_values,cost_per_conversion',
          date_preset
        });
        
        const insightData = insights.data && insights.data[0] ? insights.data[0] : {};
        
        const spend = parseFloat(insightData.spend || 0);
        const revenue = parseFloat(insightData.conversion_values || 0);
        const conversions = parseInt(insightData.conversions || 0);
        const clicks = parseInt(insightData.clicks || 0);
        const roas = revenue > 0 && spend > 0 ? revenue / spend : 0;
        const ctr = parseFloat(insightData.ctr || 0);
        const cpc = parseFloat(insightData.cpc || 0);
        
        // Determine status based on performance
        let status = 'neutral';
        if (roas >= 2.5) status = 'winning';
        else if (roas < 1.5 && spend > 0) status = 'losing';
        
        campaignData.push({
          id: campaign.id,
          name: campaign.name,
          spend,
          revenue,
          roas,
          conversions,
          clicks,
          ctr,
          cpc,
          status,
          objective: campaign.objective,
          campaignStatus: campaign.status
        });
      } catch (campaignError) {
        console.error(`Error fetching insights for campaign ${campaign.id}:`, campaignError.message);
        // Continue with next campaign
      }
    }

    // Sort by spend descending
    campaignData.sort((a, b) => b.spend - a.spend);

    console.log(`Fetched ${campaignData.length} campaigns`);
    res.json(campaignData);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get insights and recommendations
app.get('/api/insights', async (req, res) => {
  try {
    console.log('Generating insights...');
    
    // Get campaign data first from our own API
    const campaignsResponse = await axios.get(`https://facebook-ads-dashboard-git-main-jacks-projects-e0e84f4f.vercel.app/api/campaigns`, {
      timeout: 15000
    });
    const campaigns = campaignsResponse.data;
    
    const insights = {
      whatsWorking: [],
      needsImprovement: []
    };

    // Analyze what's working
    const winningCampaigns = campaigns.filter(c => c.status === 'winning').slice(0, 3);
    winningCampaigns.forEach(campaign => {
      insights.whatsWorking.push({
        title: campaign.name,
        description: `${campaign.roas.toFixed(2)}x ROAS - Strong performer! Consider scaling up budget.`,
        metric: `${campaign.roas.toFixed(2)}x ROAS`
      });
    });

    // Find best CTR
    const validCampaigns = campaigns.filter(c => c.clicks > 0);
    if (validCampaigns.length > 0) {
      const bestCTR = validCampaigns.reduce((best, current) => 
        current.ctr > best.ctr ? current : best, validCampaigns[0]);
      
      if (bestCTR && bestCTR.ctr > 2) {
        insights.whatsWorking.push({
          title: `High CTR: ${bestCTR.name}`,
          description: `${bestCTR.ctr.toFixed(1)}% CTR - Your ads are very relevant to this audience.`,
          metric: `${bestCTR.ctr.toFixed(1)}% CTR`
        });
      }
    }

    // Analyze what needs improvement
    const losingCampaigns = campaigns.filter(c => c.status === 'losing').slice(0, 3);
    losingCampaigns.forEach(campaign => {
      insights.needsImprovement.push({
        title: campaign.name,
        description: `${campaign.roas.toFixed(2)}x ROAS - ${campaign.roas < 1 ? 'Losing money! Consider pausing.' : 'Below target, review targeting and creatives.'}`,
        metric: `${campaign.roas.toFixed(2)}x ROAS`,
        severity: campaign.roas < 1 ? 'high' : 'medium'
      });
    });

    // Find low CTR campaigns
    const lowCTRCampaigns = campaigns.filter(c => c.ctr < 1.5 && c.clicks > 100);
    lowCTRCampaigns.slice(0, 2).forEach(campaign => {
      insights.needsImprovement.push({
        title: `Low CTR: ${campaign.name}`,
        description: `${campaign.ctr.toFixed(1)}% CTR - Your ads may not be relevant enough to this audience.`,
        metric: `${campaign.ctr.toFixed(1)}% CTR`,
        severity: 'low'
      });
    });

    console.log('Insights generated successfully');
    res.json(insights);
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: error.message });
  }
});

// Default route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Facebook Ads API Server',
    endpoints: [
      '/api/health',
      '/api/test-connection',
      '/api/account-overview',
      '/api/campaigns',
      '/api/insights'
    ]
  });
});

// Handle all other routes
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Export for Vercel
module.exports = app;
