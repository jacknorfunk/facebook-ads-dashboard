import axios from 'axios';

const FACEBOOK_API_BASE = 'https://graph.facebook.com/v18.0';

async function callFacebookAPI(endpoint, params = {}) {
  const url = `${FACEBOOK_API_BASE}/${endpoint}`;
  const response = await axios.get(url, {
    params: {
      access_token: process.env.FACEBOOK_ACCESS_TOKEN,
      ...params
    },
    timeout: 10000
  });
  return response.data;
}

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
    
    const response = await callFacebookAPI(`act_${process.env.AD_ACCOUNT_ID}`, {
      fields: 'name,account_status,currency'
    });
    
    res.json({ 
      success: true, 
      account: response,
      message: 'Successfully connected to Facebook API'
    });
  } catch (error) {
    console.error('Connection test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}