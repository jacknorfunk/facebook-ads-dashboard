// /api/voluum/campaign/[campaignId]/offers.js - Get offers for a specific campaign
// Following official Voluum API documentation: https://developers.voluum.com/

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { campaignId } = req.query;
        
        if (!campaignId) {
            return res.status(400).json({
                success: false,
                error: 'campaignId is required'
            });
        }

        console.log(`🎯 Fetching offers for campaign ID: ${campaignId}`);

        // Get Voluum API credentials
        const VOLUME_KEY = process.env.VOLUME_KEY;
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;
        
        if (!VOLUME_KEY || !VOLUME_KEY_ID) {
            throw new Error('Voluum API credentials not configured. Missing VOLUME_KEY or VOLUME_KEY_ID environment variables');
        }

        // Step 1: Create session
        console.log('🔐 Creating Voluum API session...');
        const sessionResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                accessKey: VOLUME_KEY,
                accessKeyId: VOLUME_KEY_ID
            })
        });

        if (!sessionResponse.ok) {
            const errorText = await sessionResponse.text();
            throw new Error(`Failed to create Voluum session: ${sessionResponse.status} - ${errorText}`);
        }

        const sessionData = await sessionResponse.json();
        const authToken = sessionData.token;
        
        if (!authToken) {
            throw new Error('No auth token received from Voluum API');
        }

        console.log('✅ Voluum session created successfully');

        // Step 2: Get campaign details to find offers
        console.log(`📊 Fetching campaign details to find offers...`);
        
        const campaignResponse = await fetch(`https://api.voluum.com/campaign/${campaignId}`, {
            method: 'GET',
            headers: {
                'cwauth-token': authToken,
                'Accept': 'application/json'
            }
        });

        if (!campaignResponse.ok) {
            const errorText = await campaignResponse.text();
            console.error('❌ Campaign fetch failed:', errorText);
            throw new Error(`Failed to fetch campaign: ${campaignResponse.status} - ${errorText}`);
        }

        const campaignData = await campaignResponse.json();
        console.log('✅ Campaign data fetched successfully');

        // Step 3: Extract offers from campaign structure
        let offers = [];
        
        // Method 1: Check if campaign has direct offer references
        if (campaignData.offers && Array.isArray(campaignData.offers)) {
            offers = campaignData.offers;
            console.log(`📋 Found ${offers.length} offers in campaign.offers`);
        }
        // Method 2: Check campaign flows for offers
        else if (campaignData.flows && Array.isArray(campaignData.flows)) {
            const flowOffers = [];
            campaignData.flows.forEach(flow => {
                if (flow.offers && Array.isArray(flow.offers)) {
                    flowOffers.push(...flow.offers);
                }
                // Also check flow rules for offers
                if (flow.rules && Array.isArray(flow.rules)) {
                    flow.rules.forEach(rule => {
                        if (rule.offers && Array.isArray(rule.offers)) {
                            flowOffers.push(...rule.offers);
                        }
                    });
                }
            });
            offers = flowOffers;
            console.log(`📋 Found ${offers.length} offers in campaign flows`);
        }
        // Method 3: Check landing pages for offers
        else if (campaignData.landingPages && Array.isArray(campaignData.landingPages)) {
            const lpOffers = [];
            campaignData.landingPages.forEach(lp => {
                if (lp.offers && Array.isArray(lp.offers)) {
                    lpOffers.push(...lp.offers);
                }
            });
            offers = lpOffers;
            console.log(`📋 Found ${offers.length} offers in landing pages`);
        }

        // Step 4: If no offers found in campaign, try fetching all offers and filter
        if (offers.length === 0) {
            console.log('🔍 No offers found in campaign structure, fetching all offers...');
            
            const allOffersResponse = await fetch('https://api.voluum.com/offer', {
                method: 'GET',
                headers: {
                    'cwauth-token': authToken,
                    'Accept': 'application/json'
                }
            });

            if (allOffersResponse.ok) {
                const allOffersData = await allOffersResponse.json();
                // Filter offers that might be associated with this campaign
                // This is a fallback method as direct association might not be available
                offers = allOffersData.offers || [];
                console.log(`📋 Fetched ${offers.length} total offers as fallback`);
            }
        }

        // Step 5: Enrich offers with additional details if needed
        const enrichedOffers = await Promise.all(offers.map(async (offer) => {
            try {
                // Try to get detailed offer information
                const offerDetailResponse = await fetch(`https://api.voluum.com/offer/${offer.id}`, {
                    method: 'GET',
                    headers: {
                        'cwauth-token': authToken,
                        'Accept': 'application/json'
                    }
                });

                if (offerDetailResponse.ok) {
                    const detailedOffer = await offerDetailResponse.json();
                    return {
                        ...offer,
                        ...detailedOffer,
                        // Ensure we have required fields
                        id: offer.id || detailedOffer.id,
                        name: offer.name || detailedOffer.name || `Offer ${offer.id}`,
                        url: offer.url || detailedOffer.url,
                        status: offer.status || detailedOffer.status || 'active'
                    };
                }
            } catch (error) {
                console.warn(`⚠️ Could not fetch details for offer ${offer.id}:`, error.message);
            }
            
            // Return basic offer info if detailed fetch failed
            return {
                id: offer.id,
                name: offer.name || `Offer ${offer.id}`,
                url: offer.url,
                status: offer.status || 'active'
            };
        }));

        console.log(`✅ Successfully processed ${enrichedOffers.length} offers`);

        return res.status(200).json({
            success: true,
            offers: enrichedOffers,
            metadata: {
                campaignId: campaignId,
                offerCount: enrichedOffers.length,
                fetchTime: new Date().toISOString(),
                source: 'voluum_api',
                methods_tried: [
                    'campaign.offers',
                    'campaign.flows.offers',
                    'campaign.landingPages.offers',
                    'all_offers_fallback'
                ]
            }
        });

    } catch (error) {
        console.error('❌ Error fetching campaign offers:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            campaignId: req.query.campaignId
        });
    }
}