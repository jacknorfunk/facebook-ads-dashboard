// api/real-creative-generator.js - Debug Version with Enhanced Logging
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method === 'GET') {
      // Health check
      const availableServices = {
        openai_dalle: !!process.env.OPENAI_API_KEY,
        google_gemini: !!process.env.GOOGLE_GEMINI_API_KEY
      };
      
      return res.status(200).json({
        status: 'ready',
        available_services: availableServices,
        openai_key_present: !!process.env.OPENAI_API_KEY,
        gemini_key_present: !!process.env.GOOGLE_GEMINI_API_KEY,
        endpoint: '/api/real-creative-generator'
      });
    }

    const { 
      base_creative_id = 'default_creative', 
      generation_type = 'variation',
      target_platform = 'facebook',
      success_factors = [],
      creative_format = 'image'
    } = req.body || req.query;

    console.log('=== REAL CREATIVE GENERATOR DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Base creative:', base_creative_id);
    console.log('Generation type:', generation_type);
    console.log('Target platform:', target_platform);
    console.log('Success factors count:', success_factors.length);
    console.log('Success factors:', JSON.stringify(success_factors, null, 2));

    // Check available AI services
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
    
    const availableServices = {
      openai_dalle: !!OPENAI_API_KEY,
      google_gemini: !!GOOGLE_GEMINI_API_KEY
    };

    console.log('Available AI services:', availableServices);
    console.log('OpenAI key length:', OPENAI_API_KEY ? OPENAI_API_KEY.length : 0);
    console.log('Gemini key length:', GOOGLE_GEMINI_API_KEY ? GOOGLE_GEMINI_API_KEY.length : 0);

    if (!availableServices.openai_dalle && !availableServices.google_gemini) {
      console.log('❌ No AI services available');
      return res.status(500).json({
        error: 'No AI generation services available',
        available_services: availableServices
      });
    }

    // Add default success factors if none provided
    if (success_factors.length === 0) {
      console.log('⚠️ No success factors provided, using defaults');
      success_factors.push(
        { factor: 'Eye-catching visuals', category: 'visual', impact_score: 0.8 },
        { factor: 'Strong emotional hook', category: 'psychological', impact_score: 0.7 },
        { factor: 'Clear value proposition', category: 'textual', impact_score: 0.9 }
      );
    }

    // Generate creative variations
    const generatedCreatives = [];
    const errors = [];
    
    // Generate 3 variations
    for (let i = 0; i < 3; i++) {
      try {
        console.log(`\n--- Generating creative variant ${i + 1}/3 ---`);
        
        const creative = await generateSingleCreative({
          base_creative_id,
          generation_type,
          target_platform,
          success_factors,
          creative_format,
          variant_number: i + 1,
          availableServices
        });
        
        if (creative) {
          console.log(`✅ Variant ${i + 1} generated successfully`);
          console.log('Creative type:', creative.content?.type);
          generatedCreatives.push(creative);
        } else {
          console.log(`❌ Variant ${i + 1} failed - no creative returned`);
          errors.push(`Variant ${i + 1}: No creative generated`);
        }
      } catch (genError) {
        console.error(`❌ Error generating variant ${i + 1}:`, genError.message);
        console.error('Full error:', genError);
        errors.push(`Variant ${i + 1}: ${genError.message}`);
      }
    }

    console.log('\n=== GENERATION SUMMARY ===');
    console.log('Total creatives generated:', generatedCreatives.length);
    console.log('Errors encountered:', errors.length);
    if (errors.length > 0) {
      console.log('Errors:', errors);
    }

    // Response
    const response = {
      success: true,
      base_creative_id,
      generation_type,
      target_platform,
      creative_format,
      generated_count: generatedCreatives.length,
      creatives: generatedCreatives,
      services_used: Object.keys(availableServices).filter(key => availableServices[key]),
      generated_at: new Date().toISOString(),
      
      // Debug info
      debug_info: {
        success_factors_provided: success_factors.length,
        errors_encountered: errors,
        api_keys_available: availableServices
      },
      
      // Generation summary
      generation_summary: {
        success_factors_applied: success_factors.length,
        variants_created: generatedCreatives.length,
        estimated_performance_lift: calculatePerformanceLift(success_factors),
        testing_recommendations: generateTestingStrategy(generatedCreatives, target_platform)
      }
    };

    console.log('=== FINAL RESPONSE ===');
    console.log('Returning response with', generatedCreatives.length, 'creatives');

    res.json(response);

  } catch (error) {
    console.error('❌ MAIN ERROR in Real Creative Generator:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      service: 'real-creative-generator'
    });
  }
}

async function generateSingleCreative({ 
  base_creative_id, 
  generation_type, 
  target_platform, 
  success_factors, 
  creative_format,
  variant_number,
  availableServices 
}) {
  
  console.log(`\n🎨 Starting generation for variant ${variant_number}`);
  
  try {
    // Create generation prompt based on success factors
    const prompt = buildGenerationPrompt({
      generation_type,
      target_platform,
      success_factors,
      creative_format,
      variant_number
    });

    console.log(`📝 Prompt built for variant ${variant_number}`);
    console.log('Image prompt preview:', prompt.image_prompt.substring(0, 150) + '...');

    let generatedContent = null;
    let serviceUsed = null;

    // Try DALL-E 3 first for images
    if (creative_format === 'image' && availableServices.openai_dalle) {
      try {
        console.log(`🖼️ Attempting DALL-E 3 generation (variant ${variant_number})...`);
        generatedContent = await generateWithDALLE3(prompt.image_prompt);
        serviceUsed = 'dalle3';
        console.log(`✅ DALL-E 3 generation successful for variant ${variant_number}`);
      } catch (dalleError) {
        console.error(`❌ DALL-E 3 generation failed for variant ${variant_number}:`, dalleError.message);
        console.error('DALL-E error details:', dalleError);
      }
    }

    // Try Google Gemini for text/conceptual generation
    if (!generatedContent && availableServices.google_gemini) {
      try {
        console.log(`🧠 Attempting Google Gemini generation (variant ${variant_number})...`);
        generatedContent = await generateWithGemini(prompt.text_prompt, creative_format);
        serviceUsed = 'gemini';
        console.log(`✅ Gemini generation successful for variant ${variant_number}`);
      } catch (geminiError) {
        console.error(`❌ Gemini generation failed for variant ${variant_number}:`, geminiError.message);
        console.error('Gemini error details:', geminiError);
      }
    }

    // Fallback: Create detailed creative brief
    if (!generatedContent) {
      console.log(`📄 Creating detailed brief fallback for variant ${variant_number}`);
      generatedContent = generateDetailedBrief(prompt, success_factors, variant_number);
      serviceUsed = 'detailed_brief';
      console.log(`✅ Detailed brief created for variant ${variant_number}`);
    }

    // Calculate performance prediction
    const performancePrediction = predictPerformance(success_factors, generation_type, target_platform);

    const creative = {
      id: `generated_${base_creative_id}_v${variant_number}`,
      name: `AI Generated Variant ${variant_number}`,
      generation_method: serviceUsed,
      generation_type,
      target_platform,
      creative_format,
      
      // Generated content
      content: generatedContent,
      
      // Applied success factors
      applied_factors: success_factors.map(factor => ({
        factor: factor.factor,
        how_applied: getFactorApplication(factor, generation_type),
        expected_impact: factor.impact_score || 0.5
      })),
      
      // Performance prediction
      performance_prediction: performancePrediction,
      
      // Testing info
      testing_strategy: {
        recommended_budget: calculateRecommendedBudget(performancePrediction.confidence),
        test_duration: '7-14 days',
        success_metrics: ['CTR > 1.5%', 'CPC < £3.00', 'ROAS > 2.0x'],
        launch_priority: performancePrediction.confidence > 0.7 ? 'high' : 'medium'
      },
      
      created_at: new Date().toISOString()
    };

    console.log(`✅ Creative object created for variant ${variant_number}, service: ${serviceUsed}`);
    return creative;

  } catch (error) {
    console.error(`❌ ERROR in generateSingleCreative for variant ${variant_number}:`, error);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

// Keep all the other functions the same...
function buildGenerationPrompt({ generation_type, target_platform, success_factors, creative_format, variant_number }) {
  console.log(`🔧 Building prompt for variant ${variant_number}`);
  
  // Extract key success factors
  const visualFactors = success_factors.filter(f => f.category === 'visual');
  const psychologicalFactors = success_factors.filter(f => f.category === 'psychological');
  const textualFactors = success_factors.filter(f => f.category === 'textual');

  console.log(`Visual factors: ${visualFactors.length}, Psychological: ${psychologicalFactors.length}, Textual: ${textualFactors.length}`);

  // Build context
  const context = {
    platform: target_platform,
    format: creative_format,
    variant: variant_number,
    key_elements: success_factors.map(f => f.factor).join(', ')
  };

  let basePrompt = '';

  // Generation type specific prompts
  switch (generation_type) {
    case 'variation':
      basePrompt = `Create a ${creative_format} variation that incorporates these proven success elements: ${context.key_elements}. `;
      break;
    case 'style_transfer':
      basePrompt = `Create a ${creative_format} with a different visual style but maintaining these core success factors: ${context.key_elements}. `;
      break;
    case 'concept_remix':
      basePrompt = `Create a conceptually different ${creative_format} that uses these psychological triggers: ${psychologicalFactors.map(f => f.factor).join(', ')}. `;
      break;
    case 'platform_adaptation':
      basePrompt = `Adapt this concept for ${target_platform} using these success elements: ${context.key_elements}. `;
      break;
  }

  // Platform-specific optimization
  if (target_platform === 'facebook') {
    basePrompt += 'Optimize for Facebook feeds with thumb-stopping visuals and mobile viewing. ';
  } else if (target_platform === 'taboola') {
    basePrompt += 'Optimize for Taboola native ads with curiosity-driven, editorial-style approach. ';
  }

  // Image generation prompt (DALL-E)
  const image_prompt = basePrompt + buildVisualPrompt(visualFactors, psychologicalFactors, variant_number);
  
  // Text generation prompt (Gemini)  
  const text_prompt = basePrompt + buildTextPrompt(success_factors, target_platform, creative_format);

  console.log(`✅ Prompts built for variant ${variant_number}`);
  return { image_prompt, text_prompt, context };
}

function buildVisualPrompt(visualFactors, psychologicalFactors, variant_number) {
  let prompt = 'Create a compelling advertising image that ';
  
  // Visual elements
  if (visualFactors.length > 0) {
    const visualElements = visualFactors.map(f => f.explanation || f.factor).join(', ');
    prompt += `incorporates these visual success elements: ${visualElements}. `;
  }

  // Psychological elements  
  if (psychologicalFactors.length > 0) {
    const emotions = psychologicalFactors.map(f => f.factor).join(', ');
    prompt += `The image should evoke these emotions: ${emotions}. `;
  }

  // Variant-specific adjustments
  switch (variant_number) {
    case 1:
      prompt += 'Use vibrant, attention-grabbing colors. ';
      break;
    case 2:
      prompt += 'Focus on human emotion and facial expressions. ';
      break;
    case 3:
      prompt += 'Emphasize the product/service benefit visually. ';
      break;
  }

  prompt += 'Professional advertising quality, high resolution, optimized for social media.';
  
  return prompt;
}

function buildTextPrompt(success_factors, target_platform, creative_format) {
  let prompt = `Generate a complete ${creative_format} creative concept including:\n\n`;
  
  prompt += '1. HEADLINE: Compelling hook that incorporates these success factors:\n';
  success_factors.forEach(factor => {
    prompt += `   - ${factor.factor}: ${factor.explanation || 'Apply this element effectively'}\n`;
  });
  
  prompt += '\n2. VISUAL DESCRIPTION: Detailed description of the image/video concept\n';
  prompt += '3. COPY/DESCRIPTION: Body text that reinforces the psychological triggers\n';
  prompt += '4. CALL-TO-ACTION: Platform-optimized CTA\n';
  
  if (target_platform === 'facebook') {
    prompt += '\nOptimize for Facebook: Mobile-first, thumb-stopping, emotion-driven\n';
  } else if (target_platform === 'taboola') {
    prompt += '\nOptimize for Taboola: Curiosity-driven, editorial tone, native feel\n';
  }

  prompt += '\nProvide specific, actionable creative direction that applies the success factors.';
  
  return prompt;
}

async function generateWithDALLE3(prompt) {
  console.log('🔑 Starting DALL-E 3 API call...');
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  console.log('OpenAI API Key present:', !!OPENAI_API_KEY);
  console.log('Prompt length:', prompt.length);
  
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard'
    })
  });

  console.log('DALL-E API response status:', response.status);

  if (!response.ok) {
    const errorData = await response.json();
    console.error('DALL-E API error response:', errorData);
    throw new Error(`DALL-E 3 API error: ${errorData.error?.message || response.status}`);
  }

  const data = await response.json();
  console.log('✅ DALL-E API successful, image URL:', data.data[0].url);
  
  return {
    type: 'generated_image',
    image_url: data.data[0].url,
    revised_prompt: data.data[0].revised_prompt,
    download_url: data.data[0].url,
    generation_details: {
      model: 'dall-e-3',
      size: '1024x1024',
      quality: 'standard'
    }
  };
}

async function generateWithGemini(prompt, creative_format) {
  console.log('🔑 Starting Gemini API call...');
  const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
  
  console.log('Gemini API Key present:', !!GOOGLE_GEMINI_API_KEY);
  console.log('Prompt length:', prompt.length);
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GOOGLE_GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    })
  });

  console.log('Gemini API response status:', response.status);

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Gemini API error response:', errorData);
    throw new Error(`Gemini API error: ${errorData.error?.message || response.status}`);
  }

  const data = await response.json();
  const generatedText = data.candidates[0].content.parts[0].text;
  
  console.log('✅ Gemini API successful, text length:', generatedText.length);
  
  return {
    type: 'creative_concept',
    concept: generatedText,
    format: creative_format,
    generation_details: {
      model: 'gemini-pro',
      temperature: 0.7
    }
  };
}

function generateDetailedBrief(prompt, success_factors, variant_number) {
  console.log(`📄 Creating detailed brief for variant ${variant_number}`);
  
  return {
    type: 'detailed_brief',
    title: `AI-Optimized Creative Brief - Variant ${variant_number}`,
    concept: `This creative variant is designed to leverage ${success_factors.length} proven success factors from your top-performing ads.`,
    
    visual_direction: {
      primary_elements: success_factors.filter(f => f.category === 'visual').map(f => f.factor),
      psychological_triggers: success_factors.filter(f => f.category === 'psychological').map(f => f.factor),
      recommended_style: variant_number === 1 ? 'Bold, high-contrast' : 
                         variant_number === 2 ? 'Human-focused, emotional' : 
                         'Product-centric, benefit-driven'
    },
    
    copy_direction: {
      headline_approach: getHeadlineApproach(success_factors, variant_number),
      key_messages: success_factors.map(f => f.explanation || f.factor).slice(0, 3),
      cta_recommendation: getCTARecommendation(prompt.context?.platform || 'facebook')
    },
    
    production_notes: [
      'Incorporate A/B test variations for headline and CTA',
      'Ensure mobile-first design approach',
      'Test with and without text overlays',
      'Consider video version if static performs well'
    ]
  };
}

// Keep all other helper functions the same...
function getHeadlineApproach(success_factors, variant_number) {
  const approaches = [
    'Question-based hook to create curiosity',
    'Benefit-focused statement with social proof',
    'Problem-solution narrative with urgency'
  ];
  
  return approaches[variant_number - 1] || approaches[0];
}

function getCTARecommendation(platform) {
  const ctas = {
    facebook: 'Learn More / Shop Now / Sign Up',
    taboola: 'Read More / Discover How / Find Out Why'
  };
  
  return ctas[platform] || 'Learn More';
}

function getFactorApplication(factor, generation_type) {
  const applications = {
    variation: `Enhanced ${factor.factor} with subtle modifications`,
    style_transfer: `${factor.factor} adapted to new visual style`,
    concept_remix: `${factor.factor} applied to different concept`,
    platform_adaptation: `${factor.factor} optimized for target platform`
  };
  
  return applications[generation_type] || `Applied ${factor.factor}`;
}

function predictPerformance(success_factors, generation_type, target_platform) {
  // Calculate confidence based on success factors
  const avgImpactScore = success_factors.reduce((sum, f) => sum + (f.impact_score || 0.5), 0) / Math.max(success_factors.length, 1);
  
  // Adjust based on generation type
  const typeMultiplier = {
    variation: 0.9,
    style_transfer: 0.7,
    concept_remix: 0.6,
    platform_adaptation: 0.8
  };
  
  const confidence = Math.min(0.95, avgImpactScore * (typeMultiplier[generation_type] || 0.7));
  
  // Predict metrics
  const baselineCTR = 1.2; // Industry average
  const expectedCTRLift = confidence * 0.5; // Up to 50% lift
  
  return {
    confidence: confidence,
    expected_ctr_range: `${(baselineCTR * (1 + expectedCTRLift * 0.5)).toFixed(2)}-${(baselineCTR * (1 + expectedCTRLift)).toFixed(2)}%`,
    expected_performance: confidence > 0.8 ? 'high' : confidence > 0.6 ? 'medium' : 'low',
    risk_level: confidence > 0.7 ? 'low' : 'medium',
    recommended_action: confidence > 0.8 ? 'Launch immediately' : 'Test with small budget first'
  };
}

function calculateRecommendedBudget(confidence) {
  if (confidence > 0.8) return '£50-100';
  if (confidence > 0.6) return '£25-50';
  return '£10-25';
}

function calculatePerformanceLift(success_factors) {
  const avgImpact = success_factors.reduce((sum, f) => sum + (f.impact_score || 0.5), 0) / Math.max(success_factors.length, 1);
  return `${Math.round(avgImpact * 40)}-${Math.round(avgImpact * 60)}%`;
}

function generateTestingStrategy(creatives, platform) {
  return {
    approach: 'A/B/C test all variants simultaneously',
    budget_split: '33/33/34 split across variants',
    duration: '7-14 days for statistical significance',
    success_criteria: [
      'CTR improvement > 25%',
      'CPC reduction > 15%', 
      'Conversion rate improvement > 20%'
    ],
    next_steps: [
      'Scale winning variant',
      'Iterate on best-performing elements',
      'Apply learnings to new campaigns'
    ]
  };
}
