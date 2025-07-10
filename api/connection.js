export default async function handler(req, res) {
  try {
    res.json({ 
      success: true,
      message: "Connection endpoint is working",
      env: {
        hasToken: !!process.env.FACEBOOK_ACCESS_TOKEN,
        hasAccountId: !!process.env.AD_ACCOUNT_ID,
        tokenLength: process.env.FACEBOOK_ACCESS_TOKEN ? process.env.FACEBOOK_ACCESS_TOKEN.length : 0
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
