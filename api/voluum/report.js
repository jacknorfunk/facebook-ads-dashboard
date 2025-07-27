// /api/voluum/report.js - Voluum Report API Endpoint (for offer-level data)

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        console.log('=== VOLUUM REPORT API ===');
        
        // Get environment variables
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;
        
        if (!accessId || !accessKey) {
            return res.status(500).json({
                success: false,
                error: 'Missing Voluum API credentials',
                debug: 'VOLUME_KEY_ID and VOLUME_KEY environment variables required'
            });
        }

        // Get parameters from query
        const { campaignId, groupBy = 'offer', range = 'yesterday', dateRange } = req.query;
        
        if (!campaignId) {
            return res.status(400).json({
                success: false,
                error: 'campaignId parameter is required'
            });
        }

        const selectedRange = dateRange || range;
        console.log('Report requested for campaign:', campaignId, 'Range:', selectedRange, 'GroupBy:', groupBy);

        // Step 1: Authenticate with Voluum API
        console.log('Authenticating with Voluum API...');
        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                accessId: accessId,
                accessKey: accessKey
            })
        });

        if (!authResponse.ok) {
            const authError = await authResponse.text();
            console.error('Voluum auth failed:', authResponse.status, authError);
            return res.status(401).json({
                success: false,
                error: 'Voluum authentication failed',
                debug: `Status: ${authResponse.status}, Response: ${authError.substring(0, 200)}`
            });
        }

        const authData = await authResponse.json();
        const token = authData.token;
        
        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token received from Voluum API',
                debug: authData
            });
        }

        console.log('✅ Voluum authentication successful');

        // Step 2: Convert date range to Voluum format
        const volumeDateRange = convertDateRange(selectedRange);
        console.log('Converted date range:', volumeDateRange);

        // Step 3: Build report query based on groupBy parameter
        let reportParams;
        let columnsString;

        if (groupBy === 'offer') {
            // Report grouped by offers
            columnsString = 'visits,clicks,conversions,revenue,cost,offerId,offerName,campaignId,campaignName';
            reportParams = new URLSearchParams({
                from: volumeDateRange.from,
                to: volumeDateRange.to,
                tz: 'UTC',
                groupBy: 'offer',
                include: 'ACTIVE',
                filter1: `campaign:${campaignId}`,
                columns: columnsString
            });
        } else {
            // Default campaign-level report
            columnsString = 'visits,clicks,conversions,revenue,cost,campaignId,campaignName';
            reportParams = new URLSearchParams({
                from: volumeDateRange.from,
                to: volumeDateRange.to,
                tz: 'UTC',
                groupBy: 'campaign',
                include: 'ACTIVE',
                filter1: `campaign:${campaignId}`,
                columns: columnsString
            });
        }

        console.log('Report params:', reportParams.toString());

        // Step 4: Fetch report data
        const reportResponse = await fetch(`https://api.voluum.com/report?${reportParams}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const reportError = await reportResponse.text();
            console.error('Report fetch failed:', reportResponse.status, reportError);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch report from Voluum',
                debug: `Status: ${reportResponse.status}, Response: ${reportError.substring(0, 200)}`
            });
        }

        const reportData = await reportResponse.json();
        console.log(`Report data received: ${reportData.rows?.length || 0} rows`);

        if (!reportData.rows || reportData.rows.length === 0) {
            return res.status(200).json({
                success: true,
                offers: [],
                data: [],
                message: `No ${groupBy} data found for campaign ${campaignId} in the selected date range`,
                debug: {
                    campaignId,
                    dateRange: volumeDateRange,
                    groupBy,
                    totalRows: 0
                }
            });
        }

        // Step 5: Process the report data
        let processedData = [];

        if (groupBy === 'offer') {
            // Process offer-level data
            processedData = reportData.rows.map(row => {
                const visits = parseInt(row.visits) || 0;
                const conversions = parseInt(row.conversions) || 0;
                const revenue = parseFloat(row.revenue) || 0;
                const cost = parseFloat(row.cost) || 0;

                return {
                    offerId: row.offerId || 'unknown',
                    offerName: row.offerName || 'Unknown Offer',
                    campaignId: row.campaignId || campaignId,
                    campaignName: row.campaignName || 'Unknown Campaign',
                    visits: visits,
                    clicks: parseInt(row.clicks) || visits, // Fallback to visits if clicks not available
                    conversions: conversions,
                    revenue: revenue,
                    cost: cost,
                    cvr: visits > 0 ? (conversions / visits) * 100 : 0,
                    epc: visits > 0 ? revenue / visits : 0, // Earnings Per Click
                    cpa: conversions > 0 ? cost / conversions : 0,
                    roas: cost > 0 ? revenue / cost : 0,
                    profit: revenue - cost
                };
            }).filter(offer => offer.visits > 0); // Only return offers with visits
        } else {
            // Process campaign-level data
            processedData = reportData.rows.map(row => {
                const visits = parseInt(row.visits) || 0;
                const conversions = parseInt(row.conversions) || 0;
                const revenue = parseFloat(row.revenue) || 0;
                const cost = parseFloat(row.cost) || 0;

                return {
                    campaignId: row.campaignId || campaignId,
                    campaignName: row.campaignName || 'Unknown Campaign',
                    visits: visits,
                    clicks: parseInt(row.clicks) || visits,
                    conversions: conversions,
                    revenue: revenue,
                    cost: cost,
                    cvr: visits > 0 ? (conversions / visits) * 100 : 0,
                    cpa: conversions > 0 ? cost / conversions : 0,
                    roas: cost > 0 ? revenue / cost : 0,
                    profit: revenue - cost
                };
            });
        }

        console.log(`✅ Processed ${processedData.length} ${groupBy} records`);

        // Step 6: Return the processed data
        const response = {
            success: true,
            [groupBy === 'offer' ? 'offers' : 'campaigns']: processedData,
            data: processedData, // Alternative key for compatibility
            total: processedData.length,
            campaignId: campaignId,
            dateRange: selectedRange,
            groupBy: groupBy,
            debug: {
                originalRows: reportData.rows.length,
                processedRows: processedData.length,
                dateRange: volumeDateRange,
                columns: columnsString
            }
        };

        return res.status(200).json(response);

    } catch (error) {
        console.error('Voluum report API error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

// Helper function to convert date range to Voluum API format
function convertDateRange(range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let from, to;
    
    switch (range) {
        case 'today':
            from = to = formatDate(today);
            break;
        case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            from = to = formatDate(yesterday);
            break;
        case 'last_7_days':
            const week = new Date(today);
            week.setDate(week.getDate() - 7);
            from = formatDate(week);
            to = formatDate(today);
            break;
        case 'last_14_days':
            const twoWeeks = new Date(today);
            twoWeeks.setDate(twoWeeks.getDate() - 14);
            from = formatDate(twoWeeks);
            to = formatDate(today);
            break;
        case 'last_30_days':
            const month = new Date(today);
            month.setDate(month.getDate() - 30);
            from = formatDate(month);
            to = formatDate(today);
            break;
        case 'this_month':
            from = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
            to = formatDate(today);
            break;
        case 'last_month':
            const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
            from = formatDate(lastMonth);
            to = formatDate(lastMonthEnd);
            break;
        default:
            // Default to yesterday
            const defaultDay = new Date(today);
            defaultDay.setDate(defaultDay.getDate() - 1);
            from = to = formatDate(defaultDay);
    }
    
    return { from, to };
}

// Helper function to format date for Voluum API
function formatDate(date) {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}
