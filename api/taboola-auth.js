// api/taboola-auth.js - Taboola OAuth Token Management
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const CLIENT_ID = process.env.TABOOLA_CLIENT_ID;
    const CLIENT_SECRET = process.env.TABOOLA_CLIENT_SECRET;
    
    console.log('=== TABOOLA AUTH API CALLED ===');

    // Get OAuth token from Taboola
    const tokenUrl = 'https://backstage.taboola.com/backstage/oauth/token';
    const tokenParams = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials'
    });

    console.log('Requesting Taboola OAuth token...');
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams.toString()
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Taboola auth error:', tokenData);
      return res.status(500).json({
        success: false,
        error: 'Failed to authenticate with Taboola',
        details: tokenData
      });
    }

    console.log('Taboola token received successfully');

    // Store token for use in other API calls
    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;

    res.json({
      success: true,
      access_token: accessToken,
      expires_in: expiresIn,
      expires_at: Date.now() + (expiresIn * 1000),
      token_type: tokenData.token_type || 'Bearer'
    });

  } catch (error) {
    console.error('Taboola auth error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
