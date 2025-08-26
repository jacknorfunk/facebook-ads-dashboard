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
    const PASSWORD = process.env.creative_pw;

    return res.status(200).json({
      success: true,
      environment_check: {
        VOLUME_KEY_ID: {
          set: !!CLIENT_ID,
          length: CLIENT_ID ? CLIENT_ID.length : 0,
          first_4_chars: CLIENT_ID ? CLIENT_ID.substring(0, 4) + '...' : 'not set'
        },
        VOLUME_KEY: {
          set: !!CLIENT_SECRET,
          length: CLIENT_SECRET ? CLIENT_SECRET.length : 0,
          first_4_chars: CLIENT_SECRET ? CLIENT_SECRET.substring(0, 4) + '...' : 'not set'
        },
        creative_pw: {
          set: !!PASSWORD,
          length: PASSWORD ? PASSWORD.length : 0
        }
      },
      note: "This shows if env vars are set without exposing actual values"
    });

  } catch (error) {
    console.error('Debug env error:', error);
    return res.status(500).json({
      success: false,
      error: 'Debug failed',
      details: error.message
    });
  }
}