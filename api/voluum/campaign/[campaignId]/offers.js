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

        // Step 2: Use reports API to get offers with performance data for this campaign
        console.log(`📊 Using reports API to get offers for campaign ${campaignId}...`);
        
        // Calculate date range (last 7 days)
        const reportQuery = {
            from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            to: new Date().toISOString(),
            tz: 'Etc/GMT',
            columns: ['offerId', 'offerName', 'visits', 'clicks', 'conversions', 'revenue', 'cost', 'cvr', 'ctr'],
            filters: [
                {
                    column: 'campaignId',
                    operator: 'EQUALS',
                    value: campaignId
                }
            ],
            groupBy: ['offerId', 'offerName']
        };

        console.log('📋 Report query:', JSON.stringify(reportQuery, null, 2));

        const reportResponse = await fetch('https://api.voluum.com/report', {
            method: 'POST',
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(reportQuery)
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            console.error('❌ Reports API failed:', errorText);
            throw new Error(`Failed to fetch campaign offers from reports: ${reportResponse.status} - ${errorText}`);
        }

        const reportData = await reportResponse.json();
        console.log('📊 Report data for campaign offers:', reportData);
        
        // Transform report rows to offers format with performance data
        const offers = (reportData.rows || []).map(row => ({
            id: row.offerId,
            name: row.offerName || `Offer ${row.offerId}`,
            url: '', // URL not available in reports, will be fetched separately if needed
            status: 'active', // Assume active if has recent activity
            visits: row.visits || 0,
            clicks: row.clicks || 0,
            conversions: row.conversions || 0,
            revenue: row.revenue || 0,
            cost: row.cost || 0,
            cvr: row.cvr || 0,
            ctr: row.ctr || 0
        }));
        
        console.log(`📋 Found ${offers.length} offers with activity for campaign ${campaignId}`);

        // Step 3: Optionally enrich offers with additional details (URL, etc.)
        const enrichedOffers = await Promise.all(offers.map(async (offer) => {
            try {
                // Try to get detailed offer information for URL and other details
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
                        // Add URL and other details from offer API
                        url: detailedOffer.url || offer.url,
                        status: detailedOffer.status || offer.status
                    };
                }
            } catch (error) {
                console.warn(`⚠️ Could not fetch details for offer ${offer.id}:`, error.message);
            }
            
            // Return offer with performance data even if details fetch failed
            return offer;
        }));

        console.log(`✅ Successfully processed ${enrichedOffers.length} offers with performance data`);

        return res.status(200).json({
            success: true,
            offers: enrichedOffers,
            metadata: {
                campaignId: campaignId,
                offerCount: enrichedOffers.length,
                fetchTime: new Date().toISOString(),
                source: 'voluum_reports_api',
                dateRange: {
                    from: reportQuery.from,
                    to: reportQuery.to
                }
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