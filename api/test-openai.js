// api/test-openai.js - Test OpenAI Connection
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    console.log('=== TESTING OPENAI CONNECTION ===');

    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({
        error: 'OpenAI API key not found in environment variables',
        check: 'Add OPENAI_API_KEY to Vercel environment variables'
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    console.log('API Key found:', apiKey.substring(0, 10) + '...');

    // Test 1: Simple text completion to verify API key
    console.log('Testing OpenAI text completion...');
    const textResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{"role": "user", "content": "Hello, this is a test. Respond with 'OpenAI connection working!'"}],
        max_tokens: 20
      })
    });

    console.log('Text API response status:', textResponse.status);

    if (!textResponse.ok) {
      const textError = await textResponse.json();
      return res.status(500).json({
        error: 'OpenAI text API failed',
        status: textResponse.status,
        details: textError,
        step: 'text_completion_test'
      });
    }

    const textData = await textResponse.json();
    console.log('Text completion successful:', textData.choices[0].message.content);

    // Test 2: DALL-E image generation
    console.log('Testing DALL-E image generation...');
    const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: "A simple test image: professional car advertisement with blue background",
        n: 1,
        size: "1024x1024",
        quality: "standard"
      })
    });

    console.log('Image API response status:', imageResponse.status);

    if (!imageResponse.ok) {
      const imageError = await imageResponse.json();
      return res.status(500).json({
        error: 'DALL-E image generation failed',
        status: imageResponse.status,
        details: imageError,
        step: 'dalle_image_test',
        text_completion_worked: true
      });
    }

    const imageData = await imageResponse.json();
    const imageUrl = imageData.data[0].url;
    console.log('Image generation successful:', imageUrl);

    // Success response
    res.json({
      success: true,
      message: 'OpenAI connection fully working!',
      tests: {
        api_key_present: true,
        text_completion: {
          status: 'success',
          response: textData.choices[0].message.content
        },
        image_generation: {
          status: 'success',
          image_url: imageUrl,
          prompt_used: "A simple test image: professional car advertisement with blue background"
        }
      },
      ready_for_creative_generation: true
    });

  } catch (error) {
    console.error('OpenAI test error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      service: 'openai-test'
    });
  }
}
