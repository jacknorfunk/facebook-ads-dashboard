// /api/voluum/test-filter-deleted.js - Test filtering out deleted campaigns
export default async function handler(req, res) {
    try {
        const volumeKeyId = process.env.VOLUME_KEY_ID;
        const volumeKey = process.env.VOLUME_KEY;

        if (!volumeKeyId || !volumeKey) {
            return res.status(500).json({
                success: false,
                error: 'Missing Voluum API credentials'
            });
        }

        // Step 1: Get authentication token
        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessId: volumeKeyId,
                accessKey: volumeKey
            })
        });

        if (!authResponse.ok) {
            return res.status(500).json({
                success: false,
                error: `Authentication failed: ${authResponse.status}`
            });
        }

        const authData = await authResponse.json();
        const token = authData.token;

        // Step 2: Get campaign data
        const now = new Date();
        const endDate = now.toISOString().split('T')[0];
        const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const columns = [
            'campaignId',
            'campaignName',
            'visits',
            'conversions',
            'revenue',
            'cost',
            'deleted',
            'status'
        ].join(',');

        const reportUrl = `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=campaign&columns=${columns}&tz=America/New_York&limit=100`;
        
        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': token,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            return res.status(500).json({
                success: false,
                error: `Report API failed: ${reportResponse.status}`
            });
        }

        const reportData = await reportResponse.json();
        const rows = reportData.rows || [];

        // Analyze campaign statuses
        const analysis = {
            total_campaigns: rows.length,
            deleted_campaigns: 0,
            active_campaigns: 0,
            campaigns_with_data: 0,
            total_revenue_all: 0,
            total_revenue_active_only: 0,
            deleted_campaign_names: [],
            active_campaign_names: []
        };

        rows.forEach(row => {
            const isDeleted = row.deleted === true;
            const revenue = parseFloat(row.revenue || 0);
            const visits = parseInt(row.visits || 0);
            const conversions = parseInt(row.conversions || 0);
            
            analysis.total_revenue_all += revenue;
            
            if (isDeleted) {
                analysis.deleted_campaigns++;
                analysis.deleted_campaign_names.push({
                    name: row.campaignName,
                    revenue: revenue,
                    visits: visits,
                    conversions: conversions,
                    status: row.status
                });
            } else {
                analysis.active_campaigns++;
                analysis.total_revenue_active_only += revenue;
                analysis.active_campaign_names.push({
                    name: row.campaignName,
                    revenue: revenue,
                    visits: visits,
                    conversions: conversions,
                    status: row.status
                });
                
                if (visits > 0 || conversions > 0 || revenue > 0) {
                    analysis.campaigns_with_data++;
                }
            }
        });

        // Summary and recommendations
        const summary = {
            issue_identified: analysis.deleted_campaigns > 0 && analysis.total_revenue_all > analysis.total_revenue_active_only,
            revenue_difference: analysis.total_revenue_all - analysis.total_revenue_active_only,
            recommendation: '',
            dashboard_fix_needed: false
        };

        if (analysis.deleted_campaigns > 0) {
            summary.recommendation = `Found ${analysis.deleted_campaigns} deleted campaigns. These should be excluded from dashboard to show accurate current data.`;
            summary.dashboard_fix_needed = true;
        } else {
            summary.recommendation = 'No deleted campaigns found. The revenue discrepancy might be due to other factors.';
        }

        if (analysis.campaigns_with_data === 0) {
            summary.recommendation += ' All campaigns have zero metrics for the selected date range. Try a longer date range or check if campaigns are active.';
        }

        return res.json({
            success: true,
            analysis: analysis,
            summary: summary,
            filter_test: {
                before_filter: {
                    campaigns: analysis.total_campaigns,
                    total_revenue: analysis.total_revenue_all
                },
                after_filter: {
                    campaigns: analysis.active_campaigns,
                    total_revenue: analysis.total_revenue_active_only,
                    campaigns_with_data: analysis.campaigns_with_data
                }
            },
            debugging_info: {
                date_range: `${startDate} to ${endDate}`,
                timezone: 'America/New_York',
                url: reportUrl,
                voluum_interface_expected_revenue: 18516.91,
                dashboard_showing_revenue: 24507412
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Filter test error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
