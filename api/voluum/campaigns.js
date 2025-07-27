// /api/voluum/campaigns.js - FIXED VERSION

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { range = 'last7days' } = req.query;
        
        // FIXED: Simple date calculation - let Voluum handle timezone with tz parameter
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

        console.log(`📅 Date Range: ${dateFrom} to ${dateTo} (Voluum will use Eastern timezone)`);

        // FIXED: Simpler Voluum API Request - let Voluum handle the timezone conversion
        const volumeUrl = 'https://api.voluum.com/report';
        const volumeParams = new URLSearchParams({
            // Let Voluum handle timezone conversion
            tz: 'America/New_York',
            dateFrom: dateFrom,
            dateTo: dateTo,
            groupBy: 'campaign',
            // Get essential columns
            columns: 'campaignId,campaignName,visits,conversions,revenue,cost'
        });

        const response = await fetch(`${volumeUrl}?${volumeParams}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.VOLUUM_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`📡 Voluum API Request: ${volumeUrl}?${volumeParams}`);
        console.log(`📡 Response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ Voluum API Error Response: ${errorText}`);
            throw new Error(`Voluum API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`📊 Voluum API Response:`, data);
        console.log(`📊 Campaigns returned: ${data.rows?.length || 0}`);

        // FIXED: Process campaigns with better error handling
        const campaigns = (data.rows || [])
            .map(row => {
                console.log(`Processing campaign: ${row.campaignName} - visits: ${row.visits}`);
                return {
                    id: row.campaignId || `campaign_${Math.random().toString(36).substr(2, 9)}`,
                    name: row.campaignName || 'Unnamed Campaign',
                    visits: parseInt(row.visits || 0),
                    conversions: parseInt(row.conversions || 0),
                    revenue: parseFloat(row.revenue || 0),
                    cost: parseFloat(row.cost || 0),
                    deleted: false // Since we're not requesting deleted field, assume active
                };
            })
            .filter(campaign => {
                const hasVisits = campaign.visits > 0;
                
                if (!hasVisits) {
                    console.log(`🚫 Filtering out campaign with 0 visits: ${campaign.name}`);
                }
                
                return hasVisits;
            });

        console.log(`✅ Returning ${campaigns.length} campaigns with visits > 0 only`);
        console.log(`📈 Total visits: ${campaigns.reduce((sum, c) => sum + c.visits, 0)}`);
        console.log(`💰 Total revenue: ${campaigns.reduce((sum, c) => sum + c.revenue, 0)}`);

        return res.status(200).json({
            success: true,
            campaigns: campaigns,
            metadata: {
                dateRange: range,
                dateFrom,
                dateTo,
                timezone: 'America/New_York',
                totalCampaigns: campaigns.length,
                filterApplied: 'visits > 0 AND not deleted'
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
