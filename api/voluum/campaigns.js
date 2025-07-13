// api/voluum/campaigns.js - Detailed Debug Version
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Comprehensive environment debug
        const envDebug = {
            node_env: process.env.NODE_ENV,
            vercel_env: process.env.VERCEL_ENV,
            all_env_keys: Object.keys(process.env).sort(),
            volume_related_keys: Object.keys(process.env).filter(key => key.includes('VOLUME')),
            total_env_count: Object.keys(process.env).length
        };

        // Check credentials
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;
        const VOLUME_KEY = process.env.VOLUME_KEY;
        
        const credentialDebug = {
            VOLUME_KEY_ID_exists: !!VOLUME_KEY_ID,
            VOLUME_KEY_exists: !!VOLUME_KEY,
            VOLUME_KEY_ID_type: typeof VOLUME_KEY_ID,
            VOLUME_KEY_type: typeof VOLUME_KEY,
            VOLUME_KEY_ID_length: VOLUME_KEY_ID ? VOLUME_KEY_ID.length : 0,
            VOLUME_KEY_length: VOLUME_KEY ? VOLUME_KEY.length : 0,
            VOLUME_KEY_ID_preview: VOLUME_KEY_ID ? VOLUME_KEY_ID.substring(0, 12) + '...' : 'null',
            VOLUME_KEY_preview: VOLUME_KEY ? VOLUME_KEY.substring(0, 12) + '...' : 'null'
        };

        console.log('=== ENVIRONMENT DEBUG ===');
        console.log('Environment debug:', envDebug);
        console.log('Credential debug:', credentialDebug);
        console.log('========================');

        // If no credentials found, return detailed debug info
        if (!VOLUME_KEY_ID || !VOLUME_KEY) {
            return res.status(200).json({
                status: 'missing_credentials',
                debug: {
                    message: 'Environment variables not found or empty',
                    environment: envDebug,
                    credentials: credentialDebug,
                    suggestion: 'Check Vercel environment variables configuration'
                },
                campaigns: getMockCampaignData()
            });
        }

        // Credentials found - try authentication
        console.log('Credentials found, attempting authentication...');
        
        const authPayload = {
            accessId: VOLUME_KEY_ID.trim(),
            accessKey: VOLUME_KEY.trim()
        };

        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
            },
            body: JSON.stringify(authPayload)
        });

        if (!authResponse.ok) {
            const authError = await authResponse.text();
            console.error('Authentication failed:', authError);
            
            return res.status(200).json({
                status: 'auth_failed',
                debug: {
                    message: 'Voluum authentication failed',
                    environment: envDebug,
                    credentials: credentialDebug,
                    auth_response_status: authResponse.status,
                    auth_error: authError,
                    auth_payload_structure: {
                        accessId_length: authPayload.accessId.length,
                        accessKey_length: authPayload.accessKey.length,
                        accessId_format: authPayload.accessId.includes('-') ? 'UUID format' : 'Non-UUID format',
                        accessKey_format: 'String format'
                    }
                },
                campaigns: getMockCampaignData()
            });
        }

        // Authentication successful
        const authData = await authResponse.json();
        const accessToken = authData.token;
        console.log('Authentication successful');

        // Get date range
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (24 * 60 * 60 * 1000));
        const formatDate = (date) => date.toISOString().split('T')[0];

        // Fetch campaign data
        const reportUrl = `https://api.voluum.com/report?from=${formatDate(startDate)}&to=${formatDate(endDate)}&groupBy=campaign&include=ACTIVE`;
        
        const reportResponse = await fetch(reportUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': accessToken,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const reportError = await reportResponse.text();
            console.error('Report API failed:', reportError);
            
            return res.status(200).json({
                status: 'report_failed',
                debug: {
                    message: 'Successfully authenticated but report API failed',
                    environment: envDebug,
                    credentials: credentialDebug,
                    report_url: reportUrl,
                    report_status: reportResponse.status,
                    report_error: reportError
                },
                campaigns: getMockCampaignData()
            });
        }

        // Success - process real data
        const reportData = await reportResponse.json();
        const processedCampaigns = processCampaignData(reportData);

        return res.status(200).json({
            status: 'success',
            debug: {
                message: 'Successfully retrieved real Voluum data',
                environment: envDebug,
                credentials: credentialDebug,
                report_url: reportUrl,
                campaigns_found: processedCampaigns.length,
                date_range: `${formatDate(startDate)} to ${formatDate(endDate)}`
            },
            campaigns: processedCampaigns
        });

    } catch (error) {
        console.error('Unexpected error:', error);
        
        return res.status(200).json({
            status: 'error',
            debug: {
                message: 'Unexpected error occurred',
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
            name: 'Weight Loss Supplement - US (MOCK DATA)',
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
            name: 'Crypto Trading Course - UK (MOCK DATA)',
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
            name: 'Gaming Laptop - DE (MOCK DATA)',
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
        }
    ];
}

function processCampaignData(reportData) {
    if (!reportData.rows || reportData.rows.length === 0) {
        console.log('No campaign data in report');
        return [];
    }

    return reportData.rows.map(campaign => {
        const campaignId = campaign.campaignId || campaign.campaign_id || campaign.id;
        const campaignName = campaign.campaignName || campaign.campaign_name || campaign.name || `Campaign ${campaignId}`;
        
        const processed = {
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
        processed.roas = processed.cost > 0 ? processed.revenue / processed.cost : 0;
        processed.ctr = processed.impressions > 0 ? (processed.clicks / processed.impressions) * 100 : 0;
        processed.cvr = processed.clicks > 0 ? (processed.conversions / processed.clicks) * 100 : 0;
        processed.cpc = processed.clicks > 0 ? processed.cost / processed.clicks : 0;
        processed.epc = processed.clicks > 0 ? processed.revenue / processed.clicks : 0;

        // Add mock trend data (would need historical comparison)
        processed.trend = {
            revenueChange: Math.random() * 40 - 20,
            costChange: Math.random() * 30 - 15,
            roasChange: Math.random() * 35 - 17.5,
            conversionChange: Math.random() * 50 - 25,
            payoutChange: Math.random() * 10 - 5
        };

        const primaryChange = processed.trend.revenueChange;
        if (primaryChange >= 10) {
            processed.trendStatus = 'UP';
        } else if (primaryChange <= -10) {
            processed.trendStatus = 'DOWN';
        } else {
            processed.trendStatus = 'STABLE';
        }
        
        processed.primaryChange = primaryChange;

        return processed;
    });
}
