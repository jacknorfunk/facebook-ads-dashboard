// api/taboola-debug.js - Debug Taboola Connection Issues
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    console.log('=== TABOOLA DEBUG API CALLED ===');

    // Check environment variables
    const CLIENT_ID = process.env.TABOOLA_CLIENT_ID;
    const CLIENT_SECRET = process.env.TABOOLA_CLIENT_SECRET;
    const ACCOUNT_ID = process.env.TABOOLA_ACCOUNT_ID;

    const envCheck = {
      TABOOLA_CLIENT_ID: {
        exists: !!CLIENT_ID,
        length: CLIENT_ID ? CLIENT_ID.length : 0,
        preview: CLIENT_ID ? CLIENT_ID.substring(0, 8) + '...' : 'MISSING'
      },
      TABOOLA_CLIENT_SECRET: {
        exists: !!CLIENT_SECRET,
        length: CLIENT_SECRET ? CLIENT_SECRET.length : 0,
        preview: CLIENT_SECRET ? CLIENT_SECRET.substring(0, 8) + '...' : 'MISSING'
      },
      TABOOLA_ACCOUNT_ID: {
        exists: !!ACCOUNT_ID,
        length: ACCOUNT_ID ? ACCOUNT_ID.length : 0,
        preview: ACCOUNT_ID || 'MISSING'
      }
    };

    console.log('Environment variables check:', envCheck);

    // If any env vars are missing, return early
    if (!CLIENT_ID || !CLIENT_SECRET || !ACCOUNT_ID) {
      return res.json({
        status: 'error',
        message: 'Missing required environment variables',
        env_check: envCheck,
        next_steps: [
          'Add missing environment variables to Vercel',
          'Redeploy the application',
          'Test again'
        ]
      });
    }

    // Test OAuth token request
    console.log('Testing Taboola OAuth...');
    
    const tokenUrl = 'https://backstage.taboola.com/backstage/oauth/token';
    const tokenParams = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials'
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response status:', tokenResponse.status);
    console.log('Token response:', tokenData);

    if (!tokenResponse.ok) {
      return res.json({
        status: 'auth_error',
        message: 'Taboola authentication failed',
        env_check: envCheck,
        auth_response: {
          status: tokenResponse.status,
          error: tokenData
        },
        possible_causes: [
          'Invalid client credentials',
          'Expired or revoked API access',
          'Incorrect Taboola account configuration',
          'API endpoint changes'
        ],
        next_steps: [
          'Verify credentials in Taboola dashboard',
          'Check API permissions',
          'Contact Taboola support if needed'
        ]
      });
    }

    // Test basic API call with token
    console.log('Testing API call with token...');
    
    const testUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/campaigns`;
    
    const apiResponse = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    const apiData = await apiResponse.json();
    console.log('API response status:', apiResponse.status);

    if (!apiResponse.ok) {
      return res.json({
        status: 'api_error',
        message: 'Taboola API call failed',
        env_check: envCheck,
        auth_success: true,
        api_response: {
          status: apiResponse.status,
          error: apiData
        },
        possible_causes: [
          'Invalid account ID',
          'Insufficient API permissions',
          'Account not accessible with these credentials'
        ],
        next_steps: [
          'Verify TABOOLA_ACCOUNT_ID is correct',
          'Check account permissions in Taboola dashboard',
          'Ensure API access is enabled for this account'
        ]
      });
    }

    // Success!
    return res.json({
      status: 'success',
      message: 'Taboola connection working correctly',
      env_check: envCheck,
      auth_success: true,
      api_success: true,
      account_info: {
        account_id: ACCOUNT_ID,
        campaigns_found: apiData.results ? apiData.results.length : 0,
        access_confirmed: true
      },
      next_steps: [
        'Taboola integration is ready to use',
        'Check main dashboard for live data',
        'Delete this debug endpoint when no longer needed'
      ]
    });

  } catch (error) {
    console.error('Taboola debug error:', error);
    
    return res.json({
      status: 'system_error',
      message: 'System error during debug',
      error: error.message,
      possible_causes: [
        'Network connectivity issues',
        'Taboola API temporarily unavailable',
        'Server configuration problems'
      ],
      next_steps: [
        'Check internet connectivity',
        'Try again in a few minutes',
        'Contact support if error persists'
      ]
    });
  }
}
