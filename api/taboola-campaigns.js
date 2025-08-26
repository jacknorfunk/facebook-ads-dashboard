// api/taboola-campaigns.js - Taboola Campaign Performance Data (real)
export default async function handler(req, res) {
	try {
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		if (req.method === 'OPTIONS') return res.status(200).end();

		const { date_range = 'last_30d', accountId } = req.query;
		const ACCOUNT_ID = (accountId && String(accountId)) || process.env.TABOOLA_ACCOUNT_ID || '1789535';
		const CLIENT_ID = process.env.TABOOLA_CLIENT_ID;
		const CLIENT_SECRET = process.env.TABOOLA_CLIENT_SECRET;
		if (!CLIENT_ID || !CLIENT_SECRET) {
			return res.status(500).json({ error: 'Missing Taboola CLIENT_ID/CLIENT_SECRET' });
		}

		// OAuth
		const authResp = await fetch('https://backstage.taboola.com/backstage/oauth/token', {
			method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type:'client_credentials' })
		});
		const authData = await authResp.json();
		if (!authResp.ok) return res.status(authResp.status).json({ error: 'Taboola OAuth failed', details: authData });
		const accessToken = authData.access_token;

		// Dates
		const endDate = new Date();
		const startDate = new Date();
		switch(date_range) {
			case 'yesterday': startDate.setDate(startDate.getDate() - 1); endDate.setDate(endDate.getDate() - 1); break;
			case 'last_7d': startDate.setDate(startDate.getDate() - 7); break;
			case 'last_30d': startDate.setDate(startDate.getDate() - 30); break;
			case 'last_90d': startDate.setDate(startDate.getDate() - 90); break;
			default: startDate.setDate(startDate.getDate() - 30);
		}
		const startDateStr = startDate.toISOString().split('T')[0];
		const endDateStr = endDate.toISOString().split('T')[0];

		// Performance
		const performanceUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/reports/campaign-summary/dimensions/campaign_breakdown?start_date=${startDateStr}&end_date=${endDateStr}&format=json`;
		const performanceResponse = await fetch(performanceUrl, { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept':'application/json' } });
		const performanceData = await performanceResponse.json();
		if (!performanceResponse.ok) return res.status(performanceResponse.status).json({ error: 'Taboola performance API error', details: performanceData });

		// Campaign details (optional)
		const campaignsUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/campaigns`;
		const campaignsResponse = await fetch(campaignsUrl, { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept':'application/json' } });
		let campaignsData = { results: [] };
		if (campaignsResponse.ok) campaignsData = await campaignsResponse.json();

		const campaignData = [];
		for (const campaign of (performanceData.results || [])) {
			try {
				const details = (campaignsData.results || []).find(c => c.id === campaign.campaign) || {};
				const spend = Number(campaign.spent || 0);
				const impressions = Number(campaign.impressions || 0);
				const clicks = Number(campaign.clicks || 0);
				const conversions = Number(campaign.actions || 0);
				const revenue = Number(campaign.conversions_value || 0);
				const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
				const cpc = clicks > 0 ? spend / clicks : 0;
				const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
				const cpa = conversions > 0 ? spend / conversions : null;
				const roas = spend > 0 && revenue > 0 ? revenue / spend : null;
				campaignData.push({
					id: campaign.campaign,
					name: details.name || `Campaign ${campaign.campaign}`,
					platform: 'taboola', spend, revenue, roas, conversions, clicks, impressions, ctr, cpc, cpm, cpa,
					campaignStatus: details.status || 'UNKNOWN',
					objective: details.cpc_goal ? `CPC: $${details.cpc_goal}` : 'Traffic',
					debug_info: { raw_performance: campaign, raw_details: details }
				});
			} catch (e) {}
		}
		campaignData.sort((a, b) => b.spend - a.spend);
		return res.json(campaignData);
	} catch (error) {
		console.error('Error fetching Taboola campaigns:', error);
		return res.status(500).json({ error: error.message, platform: 'taboola' });
	}
}
