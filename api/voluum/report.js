// /api/voluum/reports.js - Fixed Reports Endpoint
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log('=== VOLUUM REPORTS REQUEST ===');
        
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
                error: 'No token received from authentication'
            });
        }

        const token = authData.token;

        // Get query parameters
        const { 
            range = 'yesterday', 
            groupBy = 'campaign',
            campaignId 
        } = req.query;
        
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

        // Build report URL
        const reportUrl = new URL('https://api.voluum.com/report');
        reportUrl.searchParams.set('from', from);
        reportUrl.searchParams.set('to', to);
        reportUrl.searchParams.set('groupBy', groupBy);
        reportUrl.searchParams.set('columns', 'visits,clicks,conversions,revenue,cost,rpm,cpm,cpc,cpa,cv,ecpm,roi,profit,epv,ctr,cr');
        
        // Add campaign filter if specified
        if (campaignId) {
            reportUrl.searchParams.set('filter', `campaign:${campaignId}`);
        }

        console.log('Report URL:', reportUrl.toString());

        const reportResponse = await fetch(reportUrl.toString(), {
            method: 'GET',
            headers: {
                'cwauth-token': token,
                'Content-Type': 'application/json'
            }
        });

        const reportText = await reportResponse.text();

        if (!reportResponse.ok) {
            return res.status(reportResponse.status).json({
                success: false,
                error: 'Voluum reports API failed',
                status: reportResponse.status,
                response: reportText.substring(0, 200)
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

        return res.status(200).json({
            success: true,
            rows: reportData.rows || [],
            columns: reportData.columns || [],
            total: reportData.rows?.length || 0,
            dateRange: { from, to }
        });

    } catch (error) {
        console.error('Reports endpoint error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
