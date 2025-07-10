// server.js - Main backend server
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Facebook API configuration
const FACEBOOK_API_BASE = 'https://graph.facebook.com/v18.0';
const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN || 'EAAKNO5oUGRgBPPvhsVTmELZBZATafVxtFooqtErXjwaJssMMyDoyyt735wdZCtSVyoYTItvmJRcZB0xz2xHxuHUC2mV2bSJDvgsT4K9LOV34vZBxOcTgBrbYxE3vhEyI2zZB6BWSTpt4BmjEKZAth1b53Ot8EXc3CheIhHRalfnmDfr1hFlZC2arY0PoBpQKTFPsaT6hWo6v';
const AD_ACCOUNT_ID = process.env.AD_ACCOUNT_ID || '24320487237555069';

// Facebook API helper function
async function callFacebookAPI(endpoint, params = {}) {
  try {
    const url = `${FACEBOOK_API_BASE}/${endpoint}`;
    const response = await axios.get(url, {
      params: {
        access_token: ACCESS_TOKEN,
        ...params
      }
    });
    return response.data;
  } catch (error) {
    console.error('Facebook API Error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error?.message || 'Facebook API Error');
  }
}

// Get account overview
app.get('/api/account-overview', async (req, res) => {
  try {
    const { date_preset = 'last_30d' } = req.query;
    
    // Get account insights
    const accountInsights = await callFacebookAPI(`act_${AD_ACCOUNT_ID}/insights`, {
      fields: 'spend,impressions,clicks,ctr,cpc,cpm,conversions,conversion_values,cost_per_conversion',
      date_preset,
      level: 'account'
    });

    const data = accountInsights.data[0] || {};
    
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
    
    // Get campaigns with insights
    const campaigns = await callFacebookAPI(`act_${AD_ACCOUNT_ID}/campaigns`, {
      fields: 'name,status,objective,insights{spend,impressions,clicks,ctr,cpc,cpm,conversions,conversion_values,cost_per_conversion}',
      date_preset,
      limit: 50
    });

    const campaignData = campaigns.data.map(campaign => {
      const insights = campaign.insights?.data[0] || {};
      
      const spend = parseFloat(insights.spend || 0);
      const revenue = parseFloat(insights.conversion_values || 0);
      const conversions = parseInt(insights.conversions || 0);
      const clicks = parseInt(insights.clicks || 0);
      const roas = revenue > 0 ? revenue / spend : 0;
      const ctr = parseFloat(insights.ctr || 0);
      const cpc = parseFloat(insights.cpc || 0);
      
      // Determine status based on performance
      let status = 'neutral';
      if (roas >= 2.5) status = 'winning';
      else if (roas < 1.5) status = 'losing';
      
      return {
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
      };
    });

    // Sort by spend descending
    campaignData.sort((a, b) => b.spend - a.spend);

    res.json(campaignData);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get insights and recommendations
app.get('/api/insights', async (req, res) => {
  try {
    // Get campaign data first
    const campaignsResponse = await axios.get(`http://localhost:${PORT}/api/campaigns`);
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
    const bestCTR = campaigns.reduce((best, current) => 
      current.ctr > best.ctr ? current : best, campaigns[0]);
    
    if (bestCTR && bestCTR.ctr > 2) {
      insights.whatsWorking.push({
        title: `High CTR: ${bestCTR.name}`,
        description: `${bestCTR.ctr}% CTR - Your ads are very relevant to this audience.`,
        metric: `${bestCTR.ctr}% CTR`
      });
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
    lowCTRCampaigns.forEach(campaign => {
      insights.needsImprovement.push({
        title: `Low CTR: ${campaign.name}`,
        description: `${campaign.ctr}% CTR - Your ads may not be relevant enough to this audience.`,
        metric: `${campaign.ctr}% CTR`,
        severity: 'low'
      });
    });

    res.json(insights);
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test Facebook API connection
app.get('/api/test-connection', async (req, res) => {
  try {
    const response = await callFacebookAPI(`act_${AD_ACCOUNT_ID}`, {
      fields: 'name,account_status'
    });
    res.json({ 
      success: true, 
      account: response,
      message: 'Successfully connected to Facebook API'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Facebook Ad Account ID: ${AD_ACCOUNT_ID}`);
  console.log(`🔗 Test connection: http://localhost:${PORT}/api/test-connection`);
});