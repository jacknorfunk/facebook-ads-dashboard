export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const CLIENT_ID = process.env.VOLUME_KEY_ID;
    const CLIENT_SECRET = process.env.VOLUME_KEY;

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Credentials not configured'
      });
    }

    const results = [];

    // Test Method 1: /oauth/token with form encoding
    try {
      const tokenUrl1 = 'https://backstage.taboola.com/backstage/oauth/token';
      const tokenParams1 = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials'
      });

      const response1 = await fetch(tokenUrl1, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: tokenParams1.toString()
      });

      const text1 = await response1.text();
      results.push({
        method: 'OAuth endpoint with form encoding',
        url: tokenUrl1,
        status: response1.status,
        statusText: response1.statusText,
        response: text1
      });
    } catch (error) {
      results.push({
        method: 'OAuth endpoint with form encoding',
        error: error.message
      });
    }

    // Test Method 2: /api/1.0/token with JSON
    try {
      const tokenUrl2 = 'https://backstage.taboola.com/backstage/api/1.0/token';
      const tokenPayload2 = {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'client_credentials'
      };

      const response2 = await fetch(tokenUrl2, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(tokenPayload2)
      });

      const text2 = await response2.text();
      results.push({
        method: 'API endpoint with JSON',
        url: tokenUrl2,
        status: response2.status,
        statusText: response2.statusText,
        response: text2
      });
    } catch (error) {
      results.push({
        method: 'API endpoint with JSON',
        error: error.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Tested multiple authentication methods',
      results: results
    });

  } catch (error) {
    console.error('Test auth error:', error);
    return res.status(500).json({
      success: false,
      error: 'Test failed',
      details: error.message
    });
  }
}