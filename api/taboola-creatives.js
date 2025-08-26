// api/taboola-creatives.js - Real Taboola creatives via Backstage item breakdown
export default async function handler(req, res) {
	try {
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
		if (req.method === 'OPTIONS') return res.status(200).end();

		const { date_preset = 'last_30d', accountId } = req.query;
		const ACCOUNT_ID = (accountId && String(accountId)) || process.env.TABOOLA_ACCOUNT_ID || '1789535';
		const CLIENT_ID = process.env.TABOOLA_CLIENT_ID;
		const CLIENT_SECRET = process.env.TABOOLA_CLIENT_SECRET;
		if (!CLIENT_ID || !CLIENT_SECRET) {
			return res.status(500).json({ success: false, error: 'Missing Taboola CLIENT_ID/CLIENT_SECRET' });
		}

		// OAuth
		const tokenResponse = await fetch('https://backstage.taboola.com/backstage/oauth/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
			body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' }).toString()
		});
		const tokenData = await tokenResponse.json();
		if (!tokenResponse.ok) {
			return res.status(tokenResponse.status).json({ success: false, error: 'Failed to authenticate with Taboola', details: tokenData });
		}
		const accessToken = tokenData.access_token;

		// Dates
		const end = new Date();
		const start = new Date();
		switch (date_preset) {
			case 'yesterday': start.setDate(end.getDate() - 1); end.setDate(end.getDate() - 1); break;
			case 'last_7d': start.setDate(end.getDate() - 7); break;
			case 'last_14d': start.setDate(end.getDate() - 14); break;
			case 'last_30d': default: start.setDate(end.getDate() - 30);
		}
		const startStr = start.toISOString().split('T')[0];
		const endStr = end.toISOString().split('T')[0];

		// Fetch item-level performance
		const itemsUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/reports/campaign-summary/dimensions/item_breakdown?start_date=${startStr}&end_date=${endStr}&format=json`;
		const itemsResp = await fetch(itemsUrl, { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept':'application/json' } });
		const itemsJson = await itemsResp.json();
		if (!itemsResp.ok) {
			return res.status(itemsResp.status).json({ success: false, error: 'Taboola items report error', details: itemsJson });
		}
		const rows = Array.isArray(itemsJson.results) ? itemsJson.results : [];

		// Fetch campaign details to map names (optional)
		const campaignsResp = await fetch(`https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/campaigns`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
		let campaignMap = new Map();
		if (campaignsResp.ok) {
			const campaigns = await campaignsResp.json();
			(campaigns.results || []).forEach(c => campaignMap.set(String(c.id), c.name || `Campaign ${c.id}`));
		}

		// For real metadata (title/thumb/url), fetch per-campaign items and map itemId -> meta
		const uniqueCampaigns = Array.from(new Set(rows.map(r => String(r.campaign))));
		const metaMap = new Map();
		for (const cid of uniqueCampaigns.slice(0, 25)) {
			try {
				const ciUrl = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/campaigns/${cid}/items`;
				const ciResp = await fetch(ciUrl, { headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept':'application/json' } });
				if (!ciResp.ok) continue;
				const ciJson = await ciResp.json();
				for (const it of (ciJson.results || [])) {
					metaMap.set(String(it.id), { title: it.title || '', image_url: it.thumbnail_url || it.image_url || '', url: it.url || '' });
				}
			} catch {}
		}

		const creatives = rows.map(r => {
			const spend = Number(r.spent || 0);
			const impressions = Number(r.impressions || 0);
			const clicks = Number(r.clicks || 0);
			const conversions = Number(r.actions || 0);
			const revenue = Number(r.conversions_value || 0);
			const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
			const cpc = clicks > 0 ? spend / clicks : 0;
			const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
			const cpa = conversions > 0 ? spend / conversions : null;
			const roas = spend > 0 && revenue > 0 ? revenue / spend : null;
			const meta = metaMap.get(String(r.item)) || { title: r.title || '', image_url: r.thumbnail_url || '', url: r.url || '' };
			return {
				id: `taboola_item_${r.item}`,
				name: meta.title || r.item_name || `Item ${r.item}`,
				campaign_id: r.campaign,
				campaign_name: campaignMap.get(String(r.campaign)) || `Campaign ${r.campaign}`,
				platform: 'Taboola',
				creative_type: 'image',
				status: 'active',
				title: meta.title,
				description: '',
				image_url: meta.image_url,
				landing_page_url: meta.url,
				spend, revenue, roas,
				impressions, clicks, conversions,
				ctr, cpc, cpm, cpa,
				performance_score: null,
				debug_info: { source: 'taboola_item_breakdown', accountId: ACCOUNT_ID, start: startStr, end: endStr }
			};
		});

		creatives.sort((a, b) => (b.roas || -1) - (a.roas || -1));
		return res.json(creatives);
	} catch (error) {
		console.error('Error in Taboola creatives API:', error);
		return res.status(500).json({ success: false, error: error.message });
	}
}
