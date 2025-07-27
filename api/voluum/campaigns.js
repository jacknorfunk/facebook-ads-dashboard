// /api/voluum/campaigns.js - Fixed Campaigns Endpoint
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log('=== VOLUUM CAMPAIGNS REQUEST ===');
        
        // Get environment variables for direct auth
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;

        if (!accessId || !accessKey) {
            return res.status(400).json({
                success: false,
                error: 'Missing environment variables'
            });
        }

        // First, get authentication token
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
            const authText = await authResponse.text();
            return res.status(500).json({
                success: false,
                error: 'Failed to authenticate with Voluum',
                authStatus: authResponse.status,
                authResponse: authText.substring(0, 200)
            });
        }

        const authData = await authResponse.json();
        if (!authData.token) {
            return res.status(500).json({
                success: false,
                error: 'No token received from authentication',
                authData: authData
            });
        }

        const token = authData.token;
        console.log('Got auth token:', token.substring(0, 20) + '...');

        // Get query parameters
        const { range = 'yesterday' } = req.query;
        
        // Calculate date range
        let from, to;
        const today = new Date();
        
        switch (range) {
            case 'yesterday':
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                from = yesterday.toISOString().split('T')[0];
                to = yesterday.toISOString().split('T')[0];
                break;
            case 'last7days':
                const week = new Date(today);
                week.setDate(week.getDate() - 7);
                from = week.toISOString().split('T')[0];
                to = today.toISOString().split('T')[0];
                break;
            case 'last30days':
                const month = new Date(today);
                month.setDate(month.getDate() - 30);
                from = month.toISOString().split('T')[0];
                to = today.toISOString().split('T')[0];
                break;
            default:
                const defaultYesterday = new Date(today);
                defaultYesterday.setDate(defaultYesterday.getDate() - 1);
                from = defaultYesterday.toISOString().split('T')[0];
                to = defaultYesterday.toISOString().split('T')[0];
        }

        console.log('Date range:', { from, to });

        // Call Voluum reports API with correct parameters
        const reportUrl = new URL('https://api.voluum.com/report');
        reportUrl.searchParams.set('from', from);
        reportUrl.searchParams.set('to', to);
        reportUrl.searchParams.set('groupBy', 'campaign');
        reportUrl.searchParams.set('columns', 'visits,clicks,conversions,revenue,cost,rpm,cpm,cpc,cpa,cv,ecpm,roi,profit,epv,ctr,cr,ictr,vcr');

        console.log('Report URL:', reportUrl.toString());

        const reportResponse = await fetch(reportUrl.toString(), {
            method: 'GET',
            headers: {
                'cwauth-token': token,
                'Content-Type': 'application/json'
            }
        });

        console.log('Report response status:', reportResponse.status);
        console.log('Report response headers:', Object.fromEntries(reportResponse.headers.entries()));

        const reportText = await reportResponse.text();
        console.log('Report response body:', reportText.substring(0, 500));

        if (!reportResponse.ok) {
            return res.status(reportResponse.status).json({
                success: false,
                error: 'Voluum reports API failed',
                status: reportResponse.status,
                response: reportText.substring(0, 200),
                url: reportUrl.toString()
            });
        }

        let reportData;
        try {
            reportData = JSON.parse(reportText);
        } catch (parseError) {
            return res.status(500).json({
                success: false,
                error: 'Invalid JSON response from Voluum reports',
                response: reportText.substring(0, 200)
            });
        }

        console.log('Reports data received:', {
            totalRows: reportData.rows?.length || 0,
            columns: reportData.columns?.length || 0
        });

        // Transform the data to match expected format
        const campaigns = (reportData.rows || []).map(row => {
            const rowData = {};
            (reportData.columns || []).forEach((column, index) => {
                rowData[column.name] = row[index];
            });
            
            return {
                id: rowData.campaignId || rowData.id,
                name: rowData.campaignName || rowData.name || 'Unknown Campaign',
                visits: parseInt(rowData.visits || 0),
                clicks: parseInt(rowData.clicks || 0),
                conversions: parseInt(rowData.conversions || 0),
                revenue: parseFloat(rowData.revenue || 0),
                cost: parseFloat(rowData.cost || 0),
                profit: parseFloat(rowData.profit || 0),
                roi: parseFloat(rowData.roi || 0),
                ctr: parseFloat(rowData.ctr || 0),
                cr: parseFloat(rowData.cr || 0),
                cpc: parseFloat(rowData.cpc || 0),
                cpm: parseFloat(rowData.cpm || 0),
                cpa: parseFloat(rowData.cpa || 0),
                epv: parseFloat(rowData.epv || 0),
                rpm: parseFloat(rowData.rpm || 0)
            };
        });

        // Filter out campaigns with no activity
        const activeCampaigns = campaigns.filter(campaign => 
            campaign.visits > 0 || campaign.clicks > 0 || campaign.cost > 0
        );

        console.log(`Returning ${activeCampaigns.length} active campaigns`);

        return res.status(200).json({
            success: true,
            campaigns: activeCampaigns,
            total: activeCampaigns.length,
            dateRange: { from, to }
        });

    } catch (error) {
        console.error('Campaigns endpoint error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
