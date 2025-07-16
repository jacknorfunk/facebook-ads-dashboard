// /api/voluum/campaigns-minimal.js - Minimal Voluum API for immediate debugging

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const debugLogs = [];
    
    function log(message) {
        const timestamp = new Date().toISOString();
        debugLogs.push(`[${timestamp}] ${message}`);
        console.log(message);
    }

    try {
        log('=== MINIMAL VOLUUM API START ===');
        
        // Step 1: Check environment variables
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;
        
        log(`Environment check:`);
        log(`- VOLUME_KEY_ID exists: ${!!accessId}`);
        log(`- VOLUME_KEY exists: ${!!accessKey}`);
        log(`- VOLUME_KEY_ID length: ${accessId?.length || 0}`);
        log(`- VOLUME_KEY length: ${accessKey?.length || 0}`);
        
        if (!accessId || !accessKey) {
            log('ERROR: Missing environment variables');
            return res.status(200).json({
                success: false,
                error: 'Missing environment variables. Please set VOLUME_KEY_ID and VOLUME_KEY in Vercel dashboard.',
                debug_logs: debugLogs,
                env_check: {
                    volume_key_id_exists: !!accessId,
                    volume_key_exists: !!accessKey,
                    volume_key_id_length: accessId?.length || 0,
                    volume_key_length: accessKey?.length || 0
                }
            });
        }

        // Step 2: Try authentication
        log('Attempting Voluum authentication...');
        
        const authPayload = {
            accessId: accessId,
            accessKey: accessKey
        };
        
        log(`Auth payload: ${JSON.stringify(authPayload).substring(0, 100)}...`);
        
        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(authPayload)
        });

        log(`Auth response status: ${authResponse.status}`);
        
        if (!authResponse.ok) {
            const authError = await authResponse.text();
            log(`Auth failed: ${authError.substring(0, 300)}`);
            return res.status(200).json({
                success: false,
                error: `Voluum authentication failed: ${authResponse.status}`,
                debug_logs: debugLogs,
                auth_error: authError.substring(0, 500)
            });
        }

        const authData = await authResponse.json();
        log(`Auth successful, token length: ${authData.token?.length || 0}`);
        
        // Step 3: Try simple data fetch
        const today = new Date().toISOString().split('T')[0];
        const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const reportUrl = `https://api.voluum.com/report?from=${lastWeek}&to=${today}&groupBy=campaign&limit=50`;
        log(`Fetching data: ${reportUrl}`);
        
        const reportResponse = await fetch(reportUrl, {
            method: 'GET',
            headers: {
                'cwauth-token': authData.token,
                'Content-Type': 'application/json'
            }
        });

        log(`Report response status: ${reportResponse.status}`);
        
        if (!reportResponse.ok) {
            const reportError = await reportResponse.text();
            log(`Report failed: ${reportError.substring(0, 300)}`);
            return res.status(200).json({
                success: false,
                error: `Voluum report failed: ${reportResponse.status}`,
                debug_logs: debugLogs,
                report_error: reportError.substring(0, 500)
            });
        }

        const reportData = await reportResponse.json();
        log(`Report successful - Total rows: ${reportData.totalRows}`);
        log(`Sample data: ${JSON.stringify(reportData.rows?.[0] || {}).substring(0, 200)}`);
        
        // Step 4: Process minimal data
        const campaigns = (reportData.rows || []).map((row, index) => ({
            id: row.campaignId || `camp_${index}`,
            name: row.campaignName || `Campaign ${index + 1}`,
            trafficSource: row.trafficSourceName || 'Unknown',
            visits: parseFloat(row.visits || 0),
            conversions: parseFloat(row.conversions || 0),
            revenue: parseFloat(row.revenue || 0),
            cost: parseFloat(row.cost || 0),
            roas: row.cost > 0 ? row.revenue / row.cost : 0,
            hasTraffic: (row.visits || 0) > 0 || (row.conversions || 0) > 0 || (row.cost || 0) > 0,
            status: (row.visits || 0) > 0 ? 'ACTIVE' : 'PAUSED'
        }));

        const activeCampaigns = campaigns.filter(c => c.hasTraffic);
        
        const overview = {
            liveCampaigns: campaigns.length,
            activeCampaigns: activeCampaigns.length,
            totalRevenue: campaigns.reduce((sum, c) => sum + c.revenue, 0),
            totalSpend: campaigns.reduce((sum, c) => sum + c.cost, 0),
            averageRoas: activeCampaigns.length > 0 ? 
                activeCampaigns.reduce((sum, c) => sum + c.roas, 0) / activeCampaigns.length : 0,
            totalConversions: campaigns.reduce((sum, c) => sum + c.conversions, 0),
            trendingUp: 0,
            trendingDown: 0
        };

        log(`Final result: ${campaigns.length} campaigns, ${activeCampaigns.length} active`);
        log(`Revenue: $${overview.totalRevenue.toFixed(2)}, Spend: $${overview.totalSpend.toFixed(2)}`);

        return res.status(200).json({
            success: true,
            data: {
                campaigns: campaigns,
                overview: overview
            },
            debug_logs: debugLogs,
            debug_info: {
                total_rows: reportData.totalRows,
                campaigns_processed: campaigns.length,
                active_campaigns: activeCampaigns.length,
                date_range: `${lastWeek} to ${today}`,
                data_source: 'voluum_api_direct'
            }
        });

    } catch (error) {
        log(`CRITICAL ERROR: ${error.message}`);
        
        return res.status(200).json({
            success: false,
            error: error.message,
            debug_logs: debugLogs,
            stack: error.stack
        });
    }
}
