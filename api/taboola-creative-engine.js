// api/taboola-creative-engine.js - Creative Analysis Engine API
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const CLIENT_ID = process.env.VOLUME_KEY_ID;
    const CLIENT_SECRET = process.env.VOLUME_KEY;
    
    console.log('=== CREATIVE ANALYSIS ENGINE API CALLED ===');
    console.log('Method:', req.method);
    console.log('Query:', req.query);

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Taboola credentials not configured',
        details: 'VOLUME_KEY_ID and VOLUME_KEY environment variables are required'
      });
    }

    // Get OAuth token from Taboola - following official documentation
    const tokenUrl = 'https://backstage.taboola.com/backstage/api/1.0/token';
    
    const tokenPayload = {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials'
    };

    console.log('Requesting Taboola OAuth token using official API endpoint...');
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(tokenPayload)
    });

    let tokenData;
    let responseText;
    
    try {
      responseText = await tokenResponse.text();
      tokenData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Failed to parse Taboola response:', parseError);
      return res.status(500).json({
        success: false,
        error: 'Invalid response from Taboola',
        details: {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          responseText: responseText || 'Empty response',
          parseError: parseError.message
        }
      });
    }

    if (!tokenResponse.ok) {
      console.error('Taboola auth error:', tokenData);
      return res.status(500).json({
        success: false,
        error: 'Failed to authenticate with Taboola',
        details: tokenData,
        debug: {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          responseText: responseText
        }
      });
    }

    console.log('Taboola token received successfully');
    const accessToken = tokenData.access_token;

    // Get account information first
    const accountsUrl = 'https://backstage.taboola.com/backstage/api/1.0/users/current/allowed-accounts';
    const accountsResponse = await fetch(accountsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    let accountsData;
    try {
      const accountsText = await accountsResponse.text();
      accountsData = accountsText ? JSON.parse(accountsText) : {};
    } catch (parseError) {
      return res.status(500).json({
        success: false,
        error: 'Invalid accounts response from Taboola',
        details: parseError.message
      });
    }
    console.log('Accounts response:', accountsData);

    if (!accountsResponse.ok || !accountsData.results || accountsData.results.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'No Taboola accounts found',
        details: accountsData
      });
    }

    // Use first available account
    const accountId = accountsData.results[0].account_id;
    console.log('Using account:', accountId);

    // Get date range from query params
    const {
      start_date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end_date = new Date().toISOString().split('T')[0]
    } = req.query;

    // Get campaigns first
    const campaignsUrl = `https://backstage.taboola.com/backstage/api/1.0/${accountId}/campaigns`;
    const campaignsResponse = await fetch(campaignsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    const campaignsData = await campaignsResponse.json();
    
    if (!campaignsResponse.ok) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch campaigns',
        details: campaignsData
      });
    }

    const campaigns = campaignsData.results || [];
    console.log(`Found ${campaigns.length} campaigns`);

    // Get creative items for each active campaign
    const creativesPromises = campaigns
      .filter(camp => camp.is_active)
      .slice(0, 5) // Limit to first 5 campaigns to avoid timeout
      .map(async (campaign) => {
        try {
          const itemsUrl = `https://backstage.taboola.com/backstage/api/1.0/${accountId}/campaigns/${campaign.id}/items`;
          const itemsResponse = await fetch(itemsUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          });

          if (itemsResponse.ok) {
            const itemsData = await itemsResponse.json();
            return (itemsData.results || []).map(item => ({
              ...item,
              campaign_id: campaign.id,
              campaign_name: campaign.name
            }));
          }
          return [];
        } catch (error) {
          console.error(`Error fetching items for campaign ${campaign.id}:`, error);
          return [];
        }
      });

    const creativesArrays = await Promise.all(creativesPromises);
    const allCreatives = creativesArrays.flat();

    // Get performance data for creatives
    const reportUrl = `https://backstage.taboola.com/backstage/api/1.0/${accountId}/reports/campaign-summary/dimensions`;
    const reportParams = new URLSearchParams({
      start_date,
      end_date,
      dimensions: 'item_id,campaign_id',
      order_by: 'spend',
      order_direction: 'desc'
    });

    const reportResponse = await fetch(`${reportUrl}?${reportParams}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    let performanceData = [];
    if (reportResponse.ok) {
      const reportData = await reportResponse.json();
      performanceData = reportData.results || [];
    }

    console.log(`Found ${performanceData.length} performance records`);

    // Merge creatives with performance data
    const creativesWithPerformance = allCreatives.map(creative => {
      const performance = performanceData.find(p => p.item_id === creative.id) || {};
      
      return {
        id: creative.id,
        campaign_id: creative.campaign_id,
        campaign_name: creative.campaign_name,
        title: creative.content || creative.text || creative.title || 'Untitled Creative',
        thumbnail: {
          url: creative.thumbnail_url || creative.image_url || 'https://via.placeholder.com/300x200'
        },
        url: creative.url || '',
        status: creative.is_active ? 'active' : 'paused',
        created_date: creative.created_date || '',
        
        // Performance metrics
        spend: parseFloat(performance.spend || 0),
        impressions: parseInt(performance.impressions || 0),
        clicks: parseInt(performance.clicks || 0),
        ctr: parseFloat(performance.ctr || 0),
        cpc: parseFloat(performance.cpc || 0),
        cpm: parseFloat(performance.cpm || 0),
        conversions: parseInt(performance.conversions_value || performance.actions || 0),
        conversion_rate: parseFloat(performance.conversion_rate || 0),
        cpa: performance.cpa ? parseFloat(performance.cpa) : null,
        roas: performance.roas ? parseFloat(performance.roas) : null,
        revenue: performance.revenue ? parseFloat(performance.revenue) : null
      };
    });

    // Sort by spend descending and take top performers
    const sortedCreatives = creativesWithPerformance
      .filter(c => c.spend > 0) // Only include creatives with spend
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 50); // Limit to top 50

    console.log(`Returning ${sortedCreatives.length} creatives with performance data`);

    res.json({
      success: true,
      data: sortedCreatives,
      metadata: {
        account_id: accountId,
        date_range: { start_date, end_date },
        total_creatives: sortedCreatives.length,
        total_campaigns: campaigns.length,
        active_campaigns: campaigns.filter(c => c.is_active).length
      }
    });

  } catch (error) {
    console.error('Creative Analysis Engine API error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error occurred',
      details: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}