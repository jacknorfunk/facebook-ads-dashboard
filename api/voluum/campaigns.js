// api/voluum/campaigns.js - Debug Version
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Debug: Check all environment variables
        console.log('=== ENVIRONMENT VARIABLES DEBUG ===');
        console.log('NODE_ENV:', process.env.NODE_ENV);
        console.log('VERCEL_ENV:', process.env.VERCEL_ENV);
        
        // Check if variables exist
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;
        const VOLUME_KEY = process.env.VOLUME_KEY;
        
        console.log('VOLUME_KEY_ID exists:', !!VOLUME_KEY_ID);
        console.log('VOLUME_KEY exists:', !!VOLUME_KEY);
        
        if (VOLUME_KEY_ID) {
            console.log('VOLUME_KEY_ID length:', VOLUME_KEY_ID.length);
            console.log('VOLUME_KEY_ID first 8 chars:', VOLUME_KEY_ID.substring(0, 8));
        }
        
        if (VOLUME_KEY) {
            console.log('VOLUME_KEY length:', VOLUME_KEY.length);
            console.log('VOLUME_KEY first 8 chars:', VOLUME_KEY.substring(0, 8));
        }
        
        console.log('=== END DEBUG ===');

        // If no credentials, return detailed error with debug info
        if (!VOLUME_KEY_ID || !VOLUME_KEY) {
            console.log('Missing credentials, returning mock data...');
            
            return res.status(200).json({
                debug: {
                    message: 'Using mock data - credentials missing',
                    VOLUME_KEY_ID_present: !!VOLUME_KEY_ID,
                    VOLUME_KEY_present: !!VOLUME_KEY,
                    VOLUME_KEY_ID_length: VOLUME_KEY_ID ? VOLUME_KEY_ID.length : 0,
                    VOLUME_KEY_length: VOLUME_KEY ? VOLUME_KEY.length : 0,
                    all_env_keys: Object.keys(process.env).filter(key => key.includes('VOLUME'))
                },
                campaigns: getMockCampaignData()
            });
        }

        console.log('Credentials found, attempting Voluum API connection...');
        
        // Step 1: Authenticate with Voluum using Access ID and Access Key
        const authPayload = {
            accessId: VOLUME_KEY_ID.trim(),
            accessKey: VOLUME_KEY.trim()
        };
        
        console.log('Auth payload structure:', {
            accessId: authPayload.accessId.substring(0, 8) + '...',
            accessKey: authPayload.accessKey.substring(0, 8) + '...'
        });

        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
            },
            body: JSON.stringify(authPayload)
        });

        console.log('Auth response status:', authResponse.status);
        
        if (!authResponse.ok) {
            const authError = await authResponse.text();
            console.error('Voluum authentication failed:', authError);
            
            // Return mock data with auth error details
            return res.status(200).json({
                debug: {
                    message: 'Authentication failed, using mock data',
                    auth_error: authError,
                    auth_status: authResponse.status,
                    credentials_used: {
                        accessId_preview: VOLUME_KEY_ID.substring(0, 8) + '...',
                        accessKey_preview: VOLUME_KEY.substring(0, 8) + '...',
                        accessId_length: VOLUME_KEY_ID.length,
                        accessKey_length: VOLUME_KEY.length
                    }
                },
                campaigns: getMockCampaignData()
            });
        }

        const authData = await authResponse.json();
        const accessToken = authData.token;
        console.log('Voluum authentication successful, token received');

        // Step 2: Get current date range for analysis
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (24 * 60 * 60 * 1000)); // Last 24 hours

        const formatDate = (date) => date.toISOString().split('T')[0];

        // Step 3: Fetch current period campaign data
        console.log('Fetching campaign data...');
        const reportUrl = `https://api.voluum.com/report?from=${formatDate(startDate)}&to=${formatDate(endDate)}&groupBy=campaign&include=ACTIVE`;
        
        const currentDataResponse = await fetch(reportUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': accessToken,
                'Content-Type': 'application/json'
            }
        });

        console.log('Report response status:', currentDataResponse.status);

        if (!currentDataResponse.ok) {
            const currentError = await currentDataResponse.text();
            console.error('Failed to fetch campaign data:', currentError);
            
            // Return mock data with API error details
            return res.status(200).json({
                debug: {
                    message: 'Report API failed, using mock data',
                    report_error: currentError,
                    report_status: currentDataResponse.status,
                    report_url: reportUrl
                },
                campaigns: getMockCampaignData()
            });
        }

        const currentData = await currentDataResponse.json();
        console.log('Campaign data fetched successfully:', currentData.rows?.length || 0, 'campaigns');

        // Step 4: Process the real data
        const processedCampaigns = processCampaignData(currentData);
        console.log('Processed campaigns:', processedCampaigns.length);

        return res.status(200).json({
            debug: {
                message: 'Real Voluum data successfully retrieved',
                campaigns_count: processedCampaigns.length,
                date_range: `${formatDate(startDate)} to ${formatDate(endDate)}`
            },
            campaigns: processedCampaigns
        });

    } catch (error) {
        console.error('Voluum API Error:', error);
        
        // Return mock data with error details
        return res.status(200).json({
            debug: {
                message: 'Unexpected error, using mock data',
                error: error.message,
                stack: error.stack
            },
            campaigns: getMockCampaignData()
        });
    }
}

function getMockCampaignData() {
    return [
        {
            id: 'camp_001',
            name: 'Weight Loss Supplement - US',
            clicks: 1247,
            conversions: 23,
            revenue: 487.50,
            cost: 156.30,
            avgPayout: 21.20,
            impressions: 15670,
            offerId: 'offer_123',
            offerName: 'Ultra Slim Pro',
            status: 'active',
            roas: 3.12,
            ctr: 7.95,
            cvr: 1.84,
            cpc: 0.125,
            epc: 0.391,
            trend: {
                revenueChange: 15.3,
                costChange: 8.2,
                roasChange: 6.5,
                conversionChange: 12.1,
                payoutChange: 2.1
            },
            trendStatus: 'UP',
            primaryMetric: 'Revenue',
            primaryChange: 15.3,
            flags: [{ type: 'opportunity', message: 'High growth potential' }]
        },
        {
            id: 'camp_002',
            name: 'Crypto Trading Course - UK',
            clicks: 892,
            conversions: 7,
            revenue: 280.00,
            cost: 234.67,
            avgPayout: 40.00,
            impressions: 12450,
            offerId: 'offer_456',
            offerName: 'Crypto Mastery',
            status: 'active',
            roas: 1.19,
            ctr: 7.17,
            cvr: 0.78,
            cpc: 0.263,
            epc: 0.314,
            trend: {
                revenueChange: -23.1,
                costChange: 12.5,
                roasChange: -31.6,
                conversionChange: -18.7,
                payoutChange: 0.0
            },
            trendStatus: 'DOWN',
            primaryMetric: 'ROAS',
            primaryChange: -31.6,
            flags: [
                { type: 'critical', message: 'Significant performance decline' },
                { type: 'warning', message: 'Low ROAS with significant spend' }
            ]
        },
        {
            id: 'camp_003',
            name: 'Gaming Laptop - DE',
            clicks: 567,
            conversions: 12,
            revenue: 1200.00,
            cost: 89.45,
            avgPayout: 100.00,
            impressions: 8900,
            offerId: 'offer_789',
            offerName: 'Gaming Beast Pro',
            status: 'active',
            roas: 13.42,
            ctr: 6.37,
            cvr: 2.12,
            cpc: 0.158,
            epc: 2.116,
            trend: {
                revenueChange: 45.2,
                costChange: 15.8,
                roasChange: 25.4,
                conversionChange: 33.3,
                payoutChange: 0.0
            },
            trendStatus: 'UP',
            primaryMetric: 'Revenue',
            primaryChange: 45.2,
            flags: [{ type: 'opportunity', message: 'High growth potential' }]
        },
        {
            id: 'camp_004',
            name: 'Dating App - AU',
            clicks: 2156,
            conversions: 18,
            revenue: 126.00,
            cost: 167.89,
            avgPayout: 7.00,
            impressions: 45600,
            offerId: 'offer_101',
            offerName: 'Love Connect',
            status: 'active',
            roas: 0.75,
            ctr: 4.73,
            cvr: 0.83,
            cpc: 0.078,
            epc: 0.058,
            trend: {
                revenueChange: -5.2,
                costChange: 3.1,
                roasChange: -8.1,
                conversionChange: -11.1,
                payoutChange: 0.0
            },
            trendStatus: 'STABLE',
            primaryMetric: 'Performance',
            primaryChange: -6.65,
            flags: [{ type: 'warning', message: 'Low ROAS with significant spend' }]
        },
        {
            id: 'camp_005',
            name: 'Forex Signals - CA',
            clicks: 1834,
            conversions: 31,
            revenue: 620.00,
            cost: 298.45,
            avgPayout: 20.00,
            impressions: 23400,
            offerId: 'offer_202',
            offerName: 'Forex Pro Signals',
            status: 'active',
            roas: 2.08,
            ctr: 7.84,
            cvr: 1.69,
            cpc: 0.163,
            epc: 0.338,
            trend: {
                revenueChange: -12.3,
                costChange: -5.7,
                roasChange: -7.1,
                conversionChange: -15.2,
                payoutChange: 0.0
            },
            trendStatus: 'DOWN',
            primaryMetric: 'Conversions',
            primaryChange: -15.2,
            flags: [{ type: 'warning', message: 'Declining conversion rate' }]
        }
    ];
}

function processCampaignData(currentData) {
    if (!currentData.rows || currentData.rows.length === 0) {
        console.log('No current campaign data available');
        return [];
    }

    return currentData.rows.map(campaign => {
        // Extract campaign data with fallbacks for different API response formats
        const campaignId = campaign.campaignId || campaign.campaign_id || campaign.id;
        const campaignName = campaign.campaignName || campaign.campaign_name || campaign.name || `Campaign ${campaignId}`;
        
        // Current period metrics
        const current = {
            id: campaignId,
            name: campaignName,
            clicks: parseInt(campaign.clicks || 0),
            conversions: parseInt(campaign.conversions || campaign.conv || 0),
            revenue: parseFloat(campaign.revenue || campaign.conversionsValue || 0),
            cost: parseFloat(campaign.cost || campaign.totalCost || 0),
            avgPayout: parseFloat(campaign.avgPayout || campaign.averagePayout || 0),
            impressions: parseInt(campaign.impressions || campaign.impr || 0),
            offerId: campaign.offerId || campaign.offer_id || null,
            offerName: campaign.offerName || campaign.offer_name || null,
            status: campaign.status || 'active'
        };

        // Calculate derived metrics
        current.roas = current.cost > 0 ? current.revenue / current.cost : 0;
        current.ctr = current.impressions > 0 ? (current.clicks / current.impressions) * 100 : 0;
        current.cvr = current.clicks > 0 ? (current.conversions / current.clicks) * 100 : 0;
        current.cpc = current.clicks > 0 ? current.cost / current.clicks : 0;
        current.epc = current.clicks > 0 ? current.revenue / current.clicks : 0;

        // Mock trend data for now (would need previous period comparison)
        current.trend = {
            revenueChange: Math.random() * 40 - 20, // -20% to +20%
            costChange: Math.random() * 30 - 15,
            roasChange: Math.random() * 35 - 17.5,
            conversionChange: Math.random() * 50 - 25,
            payoutChange: Math.random() * 10 - 5
        };

        // Determine trend status
        const primaryChange = current.trend.revenueChange;
        if (primaryChange >= 10) {
            current.trendStatus = 'UP';
        } else if (primaryChange <= -10) {
            current.trendStatus = 'DOWN';
        } else {
            current.trendStatus = 'STABLE';
        }
        
        current.primaryChange = primaryChange;

        return current;
    });
}
