export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { password } = req.body;
    const correctPassword = process.env.DASHBOARD_PASSWORD;

    console.log('Password validation attempt');
    console.log('Environment password set:', !!correctPassword);

    if (!correctPassword) {
      return res.status(500).json({
        success: false,
        error: 'DASHBOARD_PASSWORD not configured in Vercel environment variables'
      });
    }

    if (password === correctPassword) {
      return res.status(200).json({
        success: true,
        message: 'Authentication successful'
      });
    } else {
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

  } catch (error) {
    console.error('Password validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
      details: error.message
    });
  }
}