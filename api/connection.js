export default async function handler(req, res) {
  try {
    if (!process.env.FACEBOOK_ACCESS_TOKEN) {
      return res.status(500).json({ 
        success: false, 
        error: 'Facebook Access Token not found' 
      });
    }
    
    if (!process.env.AD_ACCOUNT_ID) {
      return res.status(500).json({ 
        success: false, 
        error: 'Ad Account ID not found' 
      });
    }

    // Test Facebook API call
    const url = `https://graph.facebook.com/v18.0/act_${process.env.AD_ACCOUNT_ID}?fields=name,account_status,currency&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(500).json({
        success: false,
        error: data.error?.message || 'Facebook API Error',
        facebookError: data
      });
    }
    
    res.json({ 
      success: true, 
      account: data,
      message: 'Successfully connected to Facebook API'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
