export default function handler(req, res) {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    env: {
      hasAccessToken: !!process.env.FACEBOOK_ACCESS_TOKEN,
      hasAccountId: !!process.env.AD_ACCOUNT_ID,
      accessTokenLength: process.env.FACEBOOK_ACCESS_TOKEN ? process.env.FACEBOOK_ACCESS_TOKEN.length : 0
    }
  });
}
