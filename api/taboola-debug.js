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

    const send = (payload, status = 200) => {
      const accept = (req.headers.accept || '').toLowerCase();
      const wantsJson = (req.query && (req.query.format === 'json' || req.query.json === '1')) || accept.includes('application/json');
      if (wantsJson) {
        return res.status(status).json(payload);
      }
      const pretty = JSON.stringify(payload, null, 2);
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Taboola Debug</title><style>body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#0b0f15;color:#e6edf3;margin:0;padding:16px} .card{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:18px;max-width:980px} pre{background:#0b1220;color:#e6edf3;border:1px solid #1f2937;border-radius:10px;padding:14px;overflow:auto;font-size:12px} a{color:#93c5fd}</style></head><body><div class="card"><h1 style="margin:0 0 10px 0;font-size:18px">Taboola Debug</h1><p style="margin:0 0 12px 0">Append <code>?format=json</code> to get raw JSON.</p><pre>${pretty.replace(/[&<>]/g, s=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[s]))}</pre></div></body></html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(status).send(html);
    };

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
      return send({
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
      return send({
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
      }, tokenResponse.status);
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
      return send({
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
      }, apiResponse.status);
    }

    // Success!
    return send({
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
