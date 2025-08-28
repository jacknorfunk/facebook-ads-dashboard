// /api/voluum/campaign/[campaignId]/offers.js - Get offers for a specific campaign
// Following official Voluum API documentation: https://developers.voluum.com/

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { campaignId, range = 'last_7_days', from, to } = req.query;
        
        if (!campaignId) {
            return res.status(400).json({
                success: false,
                error: 'campaignId is required'
            });
        }

        console.log(`🎯 Fetching offers for campaign ID: ${campaignId}, range: ${range}`);

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
                accessId: VOLUME_KEY_ID,
                accessKey: VOLUME_KEY
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

        // Step 2: First get the campaign configuration to see which offers are assigned to it
        console.log(`🔍 Getting campaign configuration for ${campaignId}...`);
        
        const campaignResponse = await fetch(`https://api.voluum.com/campaign/${campaignId}`, {
            method: 'GET',
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (!campaignResponse.ok) {
            console.warn('⚠️ Could not fetch campaign config, falling back to reports method');
        }

        let campaignOfferIds = [];
        if (campaignResponse.ok) {
            const campaignData = await campaignResponse.json();
            console.log('📋 Campaign configuration:', campaignData);
            
            // Extract offer IDs from campaign configuration
            if (campaignData.offers && Array.isArray(campaignData.offers)) {
                campaignOfferIds = campaignData.offers.map(offer => offer.id || offer.offerId);
                console.log(`✅ Found ${campaignOfferIds.length} offers configured in campaign:`, campaignOfferIds);
            } else if (campaignData.landingPages) {
                // Sometimes offers are nested in landing pages
                campaignData.landingPages.forEach(lp => {
                    if (lp.offers && Array.isArray(lp.offers)) {
                        lp.offers.forEach(offer => {
                            campaignOfferIds.push(offer.id || offer.offerId);
                        });
                    }
                });
                console.log(`✅ Found ${campaignOfferIds.length} offers from landing pages:`, campaignOfferIds);
            }
        }

        // Step 3: Calculate date range based on the dashboard selection
        let startDate, endDate;
        
        if (from && to) {
            // Custom date range
            startDate = from;
            endDate = to;
            console.log(`📅 Using custom date range: ${startDate} to ${endDate}`);
        } else {
            // Calculate based on range parameter
            const now = new Date();
            endDate = now.toISOString().split('T')[0];
            
            switch (range) {
                case 'today':
                    startDate = endDate;
                    break;
                case 'yesterday':
                    const yesterday = new Date(now);
                    yesterday.setDate(yesterday.getDate() - 1);
                    startDate = yesterday.toISOString().split('T')[0];
                    endDate = startDate;
                    break;
                case 'last_7_days':
                case 'last7days':
                    startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
                    break;
                case 'last_30_days':
                case 'last30days':
                    startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
                    break;
                default:
                    startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
            }
            console.log(`📅 Using preset range (${range}): ${startDate} to ${endDate}`);
        }
        
        console.log(`📊 Fetching offers for campaign ${campaignId} from ${startDate} to ${endDate}`);
        
        // Step 4: Get performance data for the campaign's offers
        let reportUrl;
        if (campaignOfferIds.length > 0) {
            // If we have specific offer IDs from campaign config, use only those
            console.log(`🎯 Using campaign-specific offer IDs: ${campaignOfferIds.length} offers`);
            reportUrl = `https://api.voluum.com/report?from=${startDate}T00Z&to=${endDate}T00Z&tz=America/New_York&groupBy=offer&campaignId=${campaignId}&limit=1000`;
        } else {
            // If no campaign config available, try to get campaign structure from different API
            console.log(`🔍 No offers found in campaign config, trying alternative method...`);
            
            try {
                // Try bulk campaign select API to get campaign structure
                const bulkResponse = await fetch(`https://api.voluum.com/bulk/campaign/select`, {
                    method: 'POST',
                    headers: {
                        'cwauth-token': authToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        campaignIds: [campaignId]
                    })
                });

                if (bulkResponse.ok) {
                    const bulkData = await bulkResponse.json();
                    console.log('📋 Bulk campaign data:', JSON.stringify(bulkData, null, 2));
                    
                    if (bulkData.campaigns && bulkData.campaigns.length > 0) {
                        const campaign = bulkData.campaigns[0];
                        
                        // Extract offer IDs from bulk campaign data
                        if (campaign.offers && Array.isArray(campaign.offers)) {
                            campaignOfferIds = campaign.offers.map(offer => offer.id || offer.offerId).filter(Boolean);
                            console.log(`✅ Found ${campaignOfferIds.length} offers from bulk API:`, campaignOfferIds);
                        } else if (campaign.funnel && campaign.funnel.offers) {
                            campaignOfferIds = campaign.funnel.offers.map(offer => offer.id || offer.offerId).filter(Boolean);
                            console.log(`✅ Found ${campaignOfferIds.length} offers from funnel:`, campaignOfferIds);
                        } else if (campaign.landingPages) {
                            campaign.landingPages.forEach(lp => {
                                if (lp.offers && Array.isArray(lp.offers)) {
                                    const lpOffers = lp.offers.map(offer => offer.id || offer.offerId).filter(Boolean);
                                    campaignOfferIds.push(...lpOffers);
                                }
                            });
                            console.log(`✅ Found ${campaignOfferIds.length} offers from landing pages:`, campaignOfferIds);
                        }
                    }
                } else {
                    console.warn('⚠️ Bulk campaign API failed:', bulkResponse.status);
                }
            } catch (bulkError) {
                console.error('❌ Error with bulk campaign API:', bulkError.message);
            }
            
            reportUrl = `https://api.voluum.com/report?from=${startDate}T00Z&to=${endDate}T00Z&tz=America/New_York&groupBy=offer&campaignId=${campaignId}&limit=1000`;
        }
        
        console.log(`🎯 Fetching offers using official API structure:`, reportUrl);

        const reportResponse = await fetch(reportUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            console.error('❌ Offers report API failed:', errorText);
            throw new Error(`Failed to fetch campaign offers: ${reportResponse.status} - ${errorText}`);
        }

        const reportData = await reportResponse.json();
        console.log('📊 Raw offers report data:', {
            hasRows: !!reportData.rows,
            rowCount: reportData.rows?.length || 0,
            hasColumns: !!reportData.columns,
            sampleRow: reportData.rows?.[0]
        });
        
        if (!reportData.rows || reportData.rows.length === 0) {
            console.log(`⚠️ No offers found for campaign ${campaignId} in the specified date range`);
            return res.status(200).json({
                success: true,
                offers: [],
                metadata: {
                    campaignId: campaignId,
                    offerCount: 0,
                    message: 'No offers found for this campaign in the selected date range',
                    fetchTime: new Date().toISOString(),
                    source: 'voluum_reports_api',
                    dateRange: {
                        from: startDate,
                        to: endDate
                    }
                }
            });
        }
        
        // Transform report rows to offers format with performance data
        // Filter to only offers that are configured in this campaign (if we have that info)
        let offers = reportData.rows.map(row => ({
            id: row.offerId,
            name: row.offerName || `Offer ${row.offerId}`,
            url: row.offerUrl || '',
            status: 'active',
            visits: row.visits || 0,
            clicks: row.clicks || 0,
            conversions: row.conversions || 0,
            revenue: row.revenue || 0,
            cost: row.cost || 0,
            cvr: row.cvr || 0,
            ctr: row.ctr || 0,
            roas: row.cost > 0 ? (row.revenue / row.cost) : 0
        }));

        // Additional filtering: if we have campaign offer IDs, only include those
        if (campaignOfferIds.length > 0) {
            const beforeCount = offers.length;
            offers = offers.filter(offer => campaignOfferIds.includes(offer.id));
            console.log(`🔍 Filtered from ${beforeCount} to ${offers.length} offers based on campaign configuration`);
        }
        
        console.log(`📋 Found ${offers.length} offers with activity for campaign ${campaignId}`);

        console.log(`✅ Successfully processed ${offers.length} offers with performance data`);

        return res.status(200).json({
            success: true,
            offers: offers,
            metadata: {
                campaignId: campaignId,
                offerCount: offers.length,
                fetchTime: new Date().toISOString(),
                source: 'voluum_reports_api',
                dateRange: {
                    from: startDate,
                    to: endDate
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