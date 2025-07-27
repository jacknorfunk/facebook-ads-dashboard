// /api/voluum/campaigns.js - FIXED VERSION

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { range = 'last7days' } = req.query;
        
        // Calculate date range in Eastern Time (UTC-04:00)
        const now = new Date();
        const easternOffset = -4 * 60; // UTC-04:00 in minutes
        const easternNow = new Date(now.getTime() + (easternOffset * 60 * 1000));
        
        let dateFrom, dateTo;
        
        switch (range) {
            case 'yesterday':
                const yesterday = new Date(easternNow);
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                const yesterdayEnd = new Date(yesterday);
                yesterdayEnd.setHours(23, 59, 59, 999);
                dateFrom = yesterday.toISOString().split('T')[0];
                dateTo = yesterdayEnd.toISOString().split('T')[0];
                break;
            case 'last30days':
                const thirtyDaysAgo = new Date(easternNow);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                thirtyDaysAgo.setHours(0, 0, 0, 0);
                dateFrom = thirtyDaysAgo.toISOString().split('T')[0];
                dateTo = easternNow.toISOString().split('T')[0];
                break;
            case 'last7days':
            default:
                const sevenDaysAgo = new Date(easternNow);
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                sevenDaysAgo.setHours(0, 0, 0, 0);
                dateFrom = sevenDaysAgo.toISOString().split('T')[0];
                dateTo = easternNow.toISOString().split('T')[0];
                break;
        }

        console.log(`📅 Date Range (Eastern): ${dateFrom} to ${dateTo}`);

        // Voluum API Request with CORRECT timezone and parameters
        const volumeUrl = 'https://api.voluum.com/report';
        const volumeParams = new URLSearchParams({
            // FIXED: Use Eastern timezone
            tz: 'America/New_York',
            // FIXED: Correct date format
            dateFrom: dateFrom,
            dateTo: dateTo,
            // FIXED: Group by campaigns, not offers
            groupBy: 'campaign',
            // FIXED: Remove limit to get ALL campaigns
            // limit: 1000, // REMOVED - get all campaigns
            // FIXED: Get all columns needed
            columns: 'campaignId,campaignName,visits,conversions,revenue,cost,deleted'
        });

        const response = await fetch(`${volumeUrl}?${volumeParams}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.VOLUUM_API_TOKEN}`,
                'Content-Type': 'application/json',
                // FIXED: Add cache busting
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`Voluum API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`📊 Voluum API Response: ${data.rows?.length || 0} campaigns returned`);

        // FIXED: Less aggressive filtering - match your Voluum screenshots
        const campaigns = (data.rows || [])
            .map(row => ({
                id: row.campaignId || Math.random().toString(36).substr(2, 9),
                name: row.campaignName || 'Unnamed Campaign',
                visits: parseInt(row.visits || 0),
                conversions: parseInt(row.conversions || 0),
                revenue: parseFloat(row.revenue || 0),
                cost: parseFloat(row.cost || 0),
                // FIXED: Don't filter by deleted status here - let frontend decide
                deleted: row.deleted === true || row.deleted === 'true'
            }))
            // FIXED: Only filter out completely empty campaigns, keep 0-visit active campaigns
            .filter(campaign => {
                // Keep campaigns that have ANY activity OR are not deleted
                const hasAnyActivity = campaign.visits > 0 || campaign.conversions > 0 || campaign.revenue > 0 || campaign.cost > 0;
                const isNotDeleted = !campaign.deleted;
                
                // Include if: (has activity) OR (not deleted AND has a name)
                return hasAnyActivity || (isNotDeleted && campaign.name && campaign.name !== 'Unnamed Campaign');
            });

        console.log(`✅ Returning ${campaigns.length} campaigns (less aggressive filtering)`);
        console.log(`📈 Total visits: ${campaigns.reduce((sum, c) => sum + c.visits, 0)}`);
        console.log(`💰 Total revenue: $${campaigns.reduce((sum, c) => sum + c.revenue, 0)}`);

        return res.status(200).json({
            success: true,
            campaigns: campaigns,
            metadata: {
                dateRange: range,
                dateFrom,
                dateTo,
                timezone: 'America/New_York',
                totalCampaigns: campaigns.length,
                filterApplied: 'minimal - keeping campaigns with any activity or active status'
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
