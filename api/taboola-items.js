// api/taboola-items.js - Fetch Taboola items (creative-level performance)
 import qs from 'qs'

 export default async function handler(req, res) {
 	res.setHeader('Access-Control-Allow-Origin', '*')
 	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
 	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
 	if (req.method === 'OPTIONS') return res.status(200).end()
	const ACCOUNT_ID = process.env.TABOOLA_ACCOUNT_ID
	const CLIENT_ID = process.env.TABOOLA_CLIENT_ID
	const CLIENT_SECRET = process.env.TABOOLA_CLIENT_SECRET
	if (!ACCOUNT_ID || !CLIENT_ID || !CLIENT_SECRET) {
		return res.status(500).json({ error: 'Missing Taboola credentials' })
	}

	try {
		const { date = 'last_30d', campaign, site, platform, country } = req.query
		// OAuth
		const tokenResp = await fetch('https://backstage.taboola.com/backstage/oauth/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'client_credentials' })
		})
		const tokenJson = await tokenResp.json()
		if (!tokenResp.ok) {
			return res.status(tokenResp.status).json({ error: 'Taboola OAuth failed', details: tokenJson })
		}
		const accessToken = tokenJson.access_token

		// Dates
		const end = new Date()
		const start = new Date()
		if (date === 'last_7d') start.setDate(end.getDate() - 7)
		else if (date === 'last_14d') start.setDate(end.getDate() - 14)
		else if (date === 'last_30d') start.setDate(end.getDate() - 30)
		else start.setDate(end.getDate() - 30)
		const startStr = start.toISOString().split('T')[0]
		const endStr = end.toISOString().split('T')[0]

		// Report: item-level breakdown
		const base = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/reports/campaign-summary/dimensions/item_breakdown`
		const params = {
			start_date: startStr,
			end_date: endStr,
			format: 'json'
		}
		const q = qs.stringify(params)
		const resp = await fetch(`${base}?${q}`, {
			headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
		})
		const json = await resp.json()
		if (!resp.ok) {
			return res.status(resp.status).json({ error: 'Taboola items report error', details: json })
		}

		const results = Array.isArray(json.results) ? json.results : []
		// Optional filters (client can filter, but we provide server filter too)
		const filtered = results.filter(r => {
			if (campaign && String(r.campaign) !== String(campaign)) return false
			if (site && r.site && !String(r.site).includes(String(site))) return false
			if (platform && r.platform && String(r.platform).toLowerCase() !== String(platform).toLowerCase()) return false
			if (country && r.country && String(r.country).toLowerCase() !== String(country).toLowerCase()) return false
			return true
		})

		const items = filtered.map(r => {
			const spend = Number(r.spent || 0)
			const impr = Number(r.impressions || 0)
			const clicks = Number(r.clicks || 0)
			const conv = Number(r.actions || 0)
			const revenue = Number(r.conversions_value || 0)
			const ctr = impr > 0 ? (clicks / impr) * 100 : 0
			const cpc = clicks > 0 ? spend / clicks : 0
			const cpm = impr > 0 ? (spend / impr) * 1000 : 0
			const cvr = clicks > 0 ? conv / clicks : 0
			const cpa = conv > 0 ? spend / conv : null
			const roas = spend > 0 && revenue > 0 ? revenue / spend : null
			return {
				itemId: String(r.item),
				campaignId: String(r.campaign),
				headline: r.title || r.item_name || '',
				thumbnailUrl: r.thumbnail_url || '',
				destinationUrl: r.url || '',
				spend, impr, clicks, ctr, cpc, cpm,
				conversions: conv, cvr, cpa, revenue, roas,
				country: r.country || null,
				site: r.site || null,
				platform: r.platform || null,
				day: r.day || null
			}
		})

		return res.json({ items, meta: { start: startStr, end: endStr, count: items.length } })
	} catch (e) {
		console.error('taboola-items error', e)
		return res.status(500).json({ error: e.message })
	}
 }