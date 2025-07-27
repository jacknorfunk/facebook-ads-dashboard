// /api/voluum/campaigns.js - Fixed with Better Date Ranges
export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        console.log('=== VOLUUM CAMPAIGNS REQUEST (FIXED) ===');
        
        // Get environment variables
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
        console.log('Authentication successful, token received');

        // Get query parameters with WIDER date ranges
        const { range = 'last30days' } = req.query; // Default to 30 days instead of yesterday
        
        // Calculate date range - use wider ranges to find data
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
            case 'last90days':
                const quarter = new Date(today);
                quarter.setDate(quarter.getDate() - 90);
                from = quarter.toISOString().split('T')[0];
                to = today.toISOString().split('T')[0];
                break;
            default:
                // Default to last 30 days
                const defaultMonth = new Date(today);
                defaultMonth.setDate(defaultMonth.getDate() - 30);
                from = defaultMonth.toISOString().split('T')[0];
                to = today.toISOString().split('T')[0];
        }

        console.log('Date range:', { from, to, range });

        // Try multiple API calls to find where the data is
        const testRanges = [
            { name: 'Requested Range', from, to },
            { name: 'Last 7 Days', from: new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0], to: today.toISOString().split('T')[0] },
            { name: 'Last 30 Days', from: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0], to: today.toISOString().split('T')[0] },
            { name: 'Last 90 Days', from: new Date(Date.now() - 90*24*60*60*1000).toISOString().split('T')[0], to: today.toISOString().split('T')[0] }
        ];

        let allCampaigns = [];
        let successfulRange = null;

        for (const testRange of testRanges) {
            console.log(`Testing range: ${testRange.name} (${testRange.from} to ${testRange.to})`);
            
            try {
                // Build report URL with broader parameters
                const reportUrl = new URL('https://api.voluum.com/report');
                reportUrl.searchParams.set('from', testRange.from);
                reportUrl.searchParams.set('to', testRange.to);
                reportUrl.searchParams.set('groupBy', 'campaign');
                reportUrl.searchParams.set('limit', '1000'); // Get more campaigns
                
                // Use basic columns first to avoid permission issues
                reportUrl.searchParams.set('columns', 'campaignId,campaignName,visits,clicks,conversions,revenue,cost,impressions');
                
                // Don't filter by status - get ALL campaigns
                // reportUrl.searchParams.set('include', 'ACTIVE,PAUSED,ARCHIVED');

                console.log('Report URL:', reportUrl.toString());

                const reportResponse = await fetch(reportUrl.toString(), {
                    method: 'GET',
                    headers: {
                        'cwauth-token': token,
                        'Content-Type': 'application/json'
                    }
                });

                console.log(`Report response status: ${reportResponse.status}`);

                if (reportResponse.ok) {
                    const reportText = await reportResponse.text();
                    console.log(`Report response body preview: ${reportText.substring(0, 300)}`);
                    
                    let reportData;
                    try {
                        reportData = JSON.parse(reportText);
                    } catch (parseError) {
                        console.log(`Parse error for ${testRange.name}:`, parseError.message);
                        continue;
                    }

                    console.log(`${testRange.name} - Rows found:`, reportData.rows?.length || 0);
                    console.log(`${testRange.name} - Total rows:`, reportData.totalRows || 0);
                    
                    if (reportData.rows && reportData.rows.length > 0) {
                        console.log(`✅ Found campaigns in ${testRange.name}!`);
                        successfulRange = testRange;
                        
                        // Transform the data
                        allCampaigns = reportData.rows.map((row, index) => {
                            const rowData = {};
                            (reportData.columns || []).forEach((column, colIndex) => {
                                rowData[column.name] = row[colIndex];
                            });
                            
                            return {
                                id: rowData.campaignId || `campaign_${index}`,
                                name: rowData.campaignName || 'Unknown Campaign',
                                visits: parseInt(rowData.visits || 0),
                                clicks: parseInt(rowData.clicks || 0),
                                conversions: parseInt(rowData.conversions || 0),
                                revenue: parseFloat(rowData.revenue || 0),
                                cost: parseFloat(rowData.cost || 0),
                                profit: parseFloat(rowData.revenue || 0) - parseFloat(rowData.cost || 0),
                                roi: rowData.cost > 0 ? ((parseFloat(rowData.revenue || 0) - parseFloat(rowData.cost || 0)) / parseFloat(rowData.cost || 0)) * 100 : 0,
                                ctr: rowData.impressions > 0 ? (parseInt(rowData.clicks || 0) / parseInt(rowData.impressions || 0)) * 100 : 0,
                                cr: rowData.visits > 0 ? (parseInt(rowData.conversions || 0) / parseInt(rowData.visits || 0)) * 100 : 0,
                                cpc: rowData.clicks > 0 ? parseFloat(rowData.cost || 0) / parseInt(rowData.clicks || 0) : 0,
                                cpm: rowData.impressions > 0 ? (parseFloat(rowData.cost || 0) / parseInt(rowData.impressions || 0)) * 1000 : 0,
                                cpa: rowData.conversions > 0 ? parseFloat(rowData.cost || 0) / parseInt(rowData.conversions || 0) : 0,
                                epv: rowData.visits > 0 ? parseFloat(rowData.revenue || 0) / parseInt(rowData.visits || 0) : 0,
                                rpm: rowData.impressions > 0 ? (parseFloat(rowData.revenue || 0) / parseInt(rowData.impressions || 0)) * 1000 : 0
                            };
                        });
                        
                        break; // Found data, stop testing other ranges
                    }
                } else {
                    const errorText = await reportResponse.text();
                    console.log(`${testRange.name} failed with status ${reportResponse.status}:`, errorText.substring(0, 200));
                }
            } catch (rangeError) {
                console.log(`Error testing ${testRange.name}:`, rangeError.message);
                continue;
            }
        }

        // Filter out campaigns with no activity if requested
        const activeCampaigns = allCampaigns.filter(campaign => 
            campaign.visits > 0 || campaign.clicks > 0 || campaign.cost > 0
        );

        console.log(`Final results: ${allCampaigns.length} total campaigns, ${activeCampaigns.length} with activity`);

        return res.status(200).json({
            success: true,
            campaigns: activeCampaigns,
            total: activeCampaigns.length,
            dateRange: successfulRange ? { from: successfulRange.from, to: successfulRange.to, name: successfulRange.name } : { from, to },
            debug: {
                totalCampaignsFound: allCampaigns.length,
                activeCampaignsFound: activeCampaigns.length,
                successfulRange: successfulRange?.name || 'None',
                testedRanges: testRanges.map(r => r.name)
            }
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
