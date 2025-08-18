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

        // Step 2: Use reports API following the same pattern as campaigns.js
        // Calculate date range (last 7 days) 
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        console.log(`📊 Fetching offers for campaign ${campaignId} from ${startDateStr} to ${endDateStr}`);
        
        // Build report URL following the same pattern as campaigns.js
        // Group by offer and filter by campaign
        const reportUrl = `https://api.voluum.com/report?from=${startDateStr}T00:00:00Z&to=${endDateStr}T23:00:00Z&tz=America/New_York&groupBy=offer&campaignId=${campaignId}&limit=1000`;
        
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
                        from: startDateStr,
                        to: endDateStr
                    }
                }
            });
        }
        
        // Transform report rows to offers format with performance data
        const offers = reportData.rows.map(row => ({
            id: row.offerId,
            name: row.offerName || `Offer ${row.offerId}`,
            url: row.offerUrl || '', // URL might be in the report data
            status: 'active', // Assume active if has recent activity
            visits: row.visits || 0,
            clicks: row.clicks || 0,
            conversions: row.conversions || 0,
            revenue: row.revenue || 0,
            cost: row.cost || 0,
            cvr: row.cvr || 0,
            ctr: row.ctr || 0,
            roas: row.cost > 0 ? (row.revenue / row.cost) : 0
        }));
        
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
                    from: startDateStr,
                    to: endDateStr
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