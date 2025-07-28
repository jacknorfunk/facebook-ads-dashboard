// /api/voluum/debug-simple.js - Simple debug to see what campaigns we're getting

export default async function handler(req, res) {
    try {
        const { range = 'last_7_days' } = req.query;
        
        // Get credentials and create session (same as campaigns.js)
        const VOLUME_KEY = process.env.VOLUME_KEY;
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;
        
        if (!VOLUME_KEY || !VOLUME_KEY_ID) {
            throw new Error('Missing credentials');
        }

        // Create session
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

        const sessionData = await sessionResponse.json();
        const authToken = sessionData.token;

        // Calculate date range
        const { startDate, endDate } = calculateDateRange(range);

        // Make the same report request as campaigns.js
        const campaignColumns = [
            'campaignId',
            'campaignName', 
            'visits',
            'conversions',
            'revenue',
            'cost',
            'cpa',
            'cv',
            'cpm',
            'cpc',
            'rpm',
            'rpc',
            'epc',
            'campaignStatus'
        ].join(',');

        const reportUrl = `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=campaign&columns=${campaignColumns}&tz=America/New_York`;
        
        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            return res.json({
                success: false,
                error: 'Report API failed',
                status: reportResponse.status,
                response: await reportResponse.text()
            });
        }

        const reportData = await reportResponse.json();

        // Process the data exactly like campaigns.js does
        let campaigns = [];
        
        if (reportData.rows && Array.isArray(reportData.rows)) {
            const { rows = [], columns = [] } = reportData;
            
            if (columns && columns.length > 0) {
                campaigns = rows.map((row, index) => {
                    const campaignData = {};
                    columns.forEach((column, colIndex) => {
                        campaignData[column] = row[colIndex];
                    });
                    return processCampaignFromReport(campaignData);
                });
            } else {
                campaigns = rows.map(rowData => {
                    if (typeof rowData === 'object' && rowData !== null) {
                        return processCampaignFromReport(rowData);
                    }
                    return null;
                }).filter(Boolean);
            }
        }

        // Show the filtering process step by step
        const allCampaigns = campaigns.filter(Boolean);
        const campaignsWithVisits = allCampaigns.filter(c => c.visits > 0);
        const activeCampaigns = campaignsWithVisits.filter(c => !c.deleted && c.status !== 'deleted' && c.status !== 'archived');

        return res.json({
            success: true,
            debug_analysis: {
                date_range: `${startDate} to ${endDate}`,
                selected_range: range,
                api_response: {
                    hasRows: !!reportData.rows,
                    rowCount: reportData.rows?.length || 0,
                    hasColumns: !!reportData.columns,
                    columnCount: reportData.columns?.length || 0
                },
                processing_results: {
                    total_processed: allCampaigns.length,
                    campaigns_with_visits: campaignsWithVisits.length,
                    active_campaigns: activeCampaigns.length
                },
                sample_campaigns: allCampaigns.slice(0, 5).map(c => ({
                    name: c.name,
                    visits: c.visits,
                    conversions: c.conversions,
                    revenue: c.revenue,
                    cost: c.cost,
                    status: c.status,
                    deleted: c.deleted
                })),
                campaigns_filtered_out: {
                    no_visits: allCampaigns.filter(c => c.visits === 0).length,
                    deleted_status: allCampaigns.filter(c => c.deleted || c.status === 'deleted' || c.status === 'archived').length
                },
                filtering_breakdown: {
                    step1_all_campaigns: allCampaigns.length,
                    step2_with_visits: campaignsWithVisits.length,
                    step3_active_only: activeCampaigns.length
                }
            },
            recommendations: activeCampaigns.length === 0 ? [
                'Try a different date range (e.g., last_30_days)',
                'Check if campaigns have traffic in the selected period',
                'Verify timezone settings match your Voluum account'
            ] : [
                'Data looks good - campaigns found with visits'
            ]
        });

    } catch (error) {
        return res.json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
}

function processCampaignFromReport(campaignData) {
    const visits = parseInt(campaignData.visits || campaignData.uniqueClicks || campaignData.clicks || 0);
    const conversions = parseInt(campaignData.conversions || campaignData.cv || 0);
    const revenue = parseFloat(campaignData.revenue || campaignData.payout || 0);
    const cost = parseFloat(campaignData.cost || campaignData.spend || 0);
    
    return {
        id: campaignData.campaignId || campaignData.id || Math.random().toString(36).substr(2, 9),
        name: campaignData.campaignName || campaignData.name || 'Unnamed Campaign',
        visits: visits,
        conversions: conversions,
        revenue: revenue,
        cost: cost,
        spend: cost,
        cpa: conversions > 0 ? cost / conversions : 0,
        cv: parseFloat(campaignData.cv || (visits > 0 ? (conversions / visits) * 100 : 0)),
        epc: visits > 0 ? revenue / visits : 0,
        deleted: campaignData.deleted || campaignData.status === 'archived' || campaignData.status === 'deleted',
        status: campaignData.campaignStatus || campaignData.status || 'active'
    };
}

function calculateDateRange(range) {
    const now = new Date();
    const timezone = 'America/New_York';
    
    const getEasternDate = (date) => {
        return new Date(date.toLocaleString("en-US", { timeZone: timezone }));
    };
    
    const easternNow = getEasternDate(now);
    let startDate, endDate;

    switch (range) {
        case 'today':
            startDate = new Date(easternNow);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'yesterday':
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'last_7_days':
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'last_30_days':
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 29);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'this_week':
            startDate = new Date(easternNow);
            const dayOfWeek = startDate.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDate.setDate(startDate.getDate() - daysToMonday);
            startDate.setHours(0, 0, 0, 0);
            
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'this_month':
            startDate = new Date(easternNow.getFullYear(), easternNow.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        default:
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
    }

    const formatDate = (date) => {
        return date.toISOString().split('T')[0];
    };

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
}
