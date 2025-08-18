// /api/voluum/reports/offer/[offerId].js - Get performance metrics for a specific offer
// Following official Voluum API documentation: https://developers.voluum.com/

function calculateDateRangeForVoluumAPI(range) {
    const now = new Date();
    let startDate, endDate;

    // Set endDate to current time
    endDate = now.toISOString();

    switch (range) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            break;
        case 'yesterday':
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
            endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59).toISOString();
            break;
        case 'last7days':
        case 'last_7_days':
            startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();
            break;
        case 'last30days':
        case 'last_30_days':
            startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString();
            break;
        default:
            // Default to last 7 days
            startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();
    }

    return { startDate, endDate };
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { offerId, campaignId, range = 'last7days', from, to } = req.query;
        
        if (!offerId) {
            return res.status(400).json({
                success: false,
                error: 'offerId is required'
            });
        }

        console.log(`📊 Fetching performance metrics for offer: ${offerId}, campaign: ${campaignId || 'any'}`);

        // Calculate date range
        let startDate, endDate;
        if (from && to) {
            startDate = from;
            endDate = to;
            console.log(`📅 Using custom date range: ${startDate} to ${endDate}`);
        } else {
            const dateRange = calculateDateRangeForVoluumAPI(range);
            startDate = dateRange.startDate;
            endDate = dateRange.endDate;
            console.log(`📅 Using preset range (${range}): ${startDate} to ${endDate}`);
        }

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

        // Step 2: Build report query for offer metrics
        const reportQuery = {
            from: startDate,
            to: endDate,
            tz: 'Etc/GMT',
            columns: ['visits', 'clicks', 'conversions', 'revenue', 'cost', 'cvr', 'ctr', 'cpa'],
            filters: [
                {
                    column: 'offerId',
                    operator: 'EQUALS',
                    value: offerId
                }
            ]
        };

        // Add campaign filter if specified
        if (campaignId) {
            reportQuery.filters.push({
                column: 'campaignId',
                operator: 'EQUALS',
                value: campaignId
            });
        }

        console.log(`📊 Running report query:`, JSON.stringify(reportQuery, null, 2));

        // Step 3: Get performance report
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
            console.error('❌ Report fetch failed:', errorText);
            throw new Error(`Failed to fetch offer report: ${reportResponse.status} - ${errorText}`);
        }

        const reportData = await reportResponse.json();
        console.log('✅ Offer report data fetched successfully');

        // Step 4: Process and aggregate metrics
        let metrics = {
            visits: 0,
            clicks: 0,
            conversions: 0,
            revenue: 0,
            cost: 0,
            cvr: 0,
            ctr: 0,
            cpa: 0,
            roas: 0
        };

        if (reportData.rows && reportData.rows.length > 0) {
            // Aggregate metrics from all rows
            reportData.rows.forEach(row => {
                metrics.visits += row.visits || 0;
                metrics.clicks += row.clicks || 0;
                metrics.conversions += row.conversions || 0;
                metrics.revenue += row.revenue || 0;
                metrics.cost += row.cost || 0;
            });

            // Calculate derived metrics
            metrics.cvr = metrics.visits > 0 ? (metrics.conversions / metrics.visits) : 0;
            metrics.ctr = metrics.visits > 0 ? (metrics.clicks / metrics.visits) : 0;
            metrics.cpa = metrics.conversions > 0 ? (metrics.cost / metrics.conversions) : 0;
            metrics.roas = metrics.cost > 0 ? (metrics.revenue / metrics.cost) : 0;
        }

        console.log(`✅ Processed metrics for offer ${offerId}:`, metrics);

        return res.status(200).json({
            success: true,
            ...metrics,
            metadata: {
                offerId: offerId,
                campaignId: campaignId,
                dateRange: { from: startDate, to: endDate, range },
                rowCount: reportData.rows ? reportData.rows.length : 0,
                fetchTime: new Date().toISOString(),
                source: 'voluum_api'
            }
        });

    } catch (error) {
        console.error('❌ Error fetching offer metrics:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            offerId: req.query.offerId,
            campaignId: req.query.campaignId
        });
    }
}