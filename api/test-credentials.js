export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const CLIENT_ID = process.env.TABOOLA_CLIENT_ID;
    const CLIENT_SECRET = process.env.TABOOLA_CLIENT_SECRET;

    // Check if credentials are set
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Credentials not configured in Vercel',
        details: {
          TABOOLA_CLIENT_ID_set: !!CLIENT_ID,
          TABOOLA_CLIENT_SECRET_set: !!CLIENT_SECRET
        }
      });
    }

    // Test 1: Simple OAuth token request
    console.log('Testing Taboola credentials...');
    
    const tokenUrl = 'https://backstage.taboola.com/backstage/oauth/token';
    const tokenParams = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials'
    });

    const startTime = Date.now();
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    let responseText;
    let responseData;
    
    try {
      responseText = await tokenResponse.text();
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      responseData = { parseError: parseError.message };
    }

    const result = {
      success: tokenResponse.ok,
      status: tokenResponse.status,
      statusText: tokenResponse.statusText,
      responseTime: `${responseTime}ms`,
      credentials_info: {
        client_id_length: CLIENT_ID.length,
        client_secret_length: CLIENT_SECRET.length,
        client_id_starts: CLIENT_ID.substring(0, 4) + '...',
        client_secret_starts: CLIENT_SECRET.substring(0, 4) + '...'
      },
      request_details: {
        url: tokenUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body_params: 'client_id, client_secret, grant_type'
      },
      response: responseData,
      raw_response: responseText
    };

    // If successful, test a simple API call
    if (tokenResponse.ok && responseData.access_token) {
      try {
        const testApiUrl = 'https://backstage.taboola.com/backstage/api/1.0/users/current';
        const apiResponse = await fetch(testApiUrl, {
          headers: {
            'Authorization': `Bearer ${responseData.access_token}`,
            'Accept': 'application/json'
          }
        });

        const apiText = await apiResponse.text();
        let apiData;
        try {
          apiData = apiText ? JSON.parse(apiText) : {};
        } catch (parseError) {
          apiData = { parseError: parseError.message };
        }

        result.api_test = {
          success: apiResponse.ok,
          status: apiResponse.status,
          statusText: apiResponse.statusText,
          response: apiData,
          raw_response: apiText
        };
      } catch (apiError) {
        result.api_test = {
          error: apiError.message
        };
      }
    }

    return res.status(200).json({
      message: 'Credential test completed',
      timestamp: new Date().toISOString(),
      result: result
    });

  } catch (error) {
    console.error('Credential test error:', error);
    return res.status(500).json({
      success: false,
      error: 'Test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}