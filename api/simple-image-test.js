// api/simple-image-test.js - Test image generation in creative context
export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    console.log('=== TESTING CREATIVE IMAGE GENERATION ===');

    // Simulate your creative generator flow
    const baseCreative = {
      title: "Car Finance Available Now",
      ctr: 2.5,
      conversions: 3
    };

    console.log('Base creative:', baseCreative.title);

    // Test the same logic your generator uses
    const imagePrompt = `Professional car finance advertisement featuring a modern car, clean minimal design, trustworthy business aesthetic, professional photography style, bright lighting, based on successful headline: "${baseCreative.title}". High-quality marketing image, 1200x630 resolution, optimized for facebook`;

    console.log('Image prompt:', imagePrompt);
    console.log('Starting DALL-E generation...');

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "vivid"
      })
    });

    console.log('DALL-E response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('DALL-E error:', errorData);
      throw new Error(`DALL-E failed: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const imageData = await response.json();
    const imageUrl = imageData.data[0].url;

    console.log('✅ Image generated successfully:', imageUrl);

    // Return creative-style response
    res.json({
      success: true,
      creative_generated: {
        id: `test_${Date.now()}`,
        type: 'ai_generated_image',
        platform: 'facebook',
        generation_method: 'openai_dalle3',
        
        creative_data: {
          title: 'AI-Generated Car Finance Creative',
          description: 'DALL-E 3 generated image based on successful elements',
          style: 'professional_trust',
          dimensions: '1024x1024',
          image_url: imageUrl,
          prompt_used: imagePrompt,
          download_url: imageUrl
        },

        predicted_improvements: {
          visual_appeal_lift: '+25-45%',
          engagement_score: 85,
          thumb_stopping_power: 'high'
        }
      },
      
      timing: {
        generation_time: 'success',
        ready_for_campaign: true
      }
    });

  } catch (error) {
    console.error('Creative image generation error:', error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      step: 'creative_image_generation'
    });
  }
}
