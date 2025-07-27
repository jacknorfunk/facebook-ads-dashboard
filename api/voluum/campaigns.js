// /api/voluum/campaigns.js - WORKING VERSION (REVERTED)

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { range = 'last7days' } = req.query;
        
        // Calculate date range
        const now = new Date();
        let dateFrom, dateTo;
        
        switch (range) {
            case 'yesterday':
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                dateFrom = yesterday.toISOString().split('T')[0];
                dateTo = yesterday.toISOString().split('T')[0];
                break;
            case 'last30days':
                const thirtyDaysAgo = new Date(now);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
                dateTo = now.toISOString().split('T')[0];
                break;
            case 'last7days':
            default:
                const sevenDaysAgo = new Date(now);
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                dateFrom = sevenDaysAgo.toISOString().split('T')[0];
                dateTo = now.toISOString().split('T')[0];
                break;
        }

        console.log(`📅 Date Range: ${dateFrom} to ${dateTo}`);

        // Voluum API Request
        const volumeUrl = 'https://api.voluum.com/report';
        const volumeParams = new URLSearchParams({
            tz: 'America/New_York',
            dateFrom: dateFrom,
            dateTo: dateTo,
            groupBy: 'campaign',
            columns: 'campaignId,campaignName,visits,conversions,revenue,cost,deleted'
        });

        const response = await fetch(`${volumeUrl}?${volumeParams}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.VOLUUM_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Voluum API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`📊 Voluum API Response: ${data.rows?.length || 0} campaigns returned`);

        // Filter to only active campaigns with visits
        const campaigns = (data.rows || [])
            .map(row => ({
                id: row.campaignId || Math.random().toString(36).substr(2, 9),
                name: row.campaignName || 'Unnamed Campaign',
                visits: parseInt(row.visits || 0),
                conversions: parseInt(row.conversions || 0),
                revenue: parseFloat(row.revenue || 0),
                cost: parseFloat(row.cost || 0),
                deleted: row.deleted === true || row.deleted === 'true'
            }))
            .filter(campaign => {
                const isNotDeleted = !campaign.deleted;
                const hasVisits = campaign.visits > 0;
                return isNotDeleted && hasVisits;
            });

        console.log(`✅ Returning ${campaigns.length} active campaigns with visits`);

        return res.status(200).json({
            success: true,
            campaigns: campaigns,
            metadata: {
                dateRange: range,
                dateFrom,
                dateTo,
                timezone: 'America/New_York',
                totalCampaigns: campaigns.length
            }
        });

    } catch (error) {
        console.error('❌ API Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            campaigns: []
        });
    }
}
