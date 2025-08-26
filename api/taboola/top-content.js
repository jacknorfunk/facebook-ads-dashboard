// api/taboola/top-content.js
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
		const { date = 'last_30d', rank = 'roas' } = req.query
		const tokenResp = await fetch('https://backstage.taboola.com/backstage/oauth/token', {
			method: 'POST', headers: { 'Content-Type':'application/x-www-form-urlencoded' },
			body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type:'client_credentials' })
		})
		const tokenJson = await tokenResp.json()
		if (!tokenResp.ok) return res.status(tokenResp.status).json({ error: 'Taboola OAuth failed', details: tokenJson })
		const accessToken = tokenJson.access_token

		const end = new Date(); const start = new Date();
		if (date === 'last_7d') start.setDate(end.getDate() - 7)
		else if (date === 'last_14d') start.setDate(end.getDate() - 14)
		else start.setDate(end.getDate() - 30)
		const startStr = start.toISOString().split('T')[0]; const endStr = end.toISOString().split('T')[0]

		const base = `https://backstage.taboola.com/backstage/api/1.0/${ACCOUNT_ID}/reports/campaign-summary/dimensions/item_breakdown`
		const q = qs.stringify({ start_date: startStr, end_date: endStr, format: 'json' })
		const resp = await fetch(`${base}?${q}`, { headers: { 'Authorization': `Bearer ${accessToken}` } })
		const json = await resp.json()
		if (!resp.ok) return res.status(resp.status).json({ error: 'Taboola items report error', details: json })

		const items = (json.results || []).map(r => {
			const spend = Number(r.spent || 0)
			const impr = Number(r.impressions || 0)
			const clicks = Number(r.clicks || 0)
			const conv = Number(r.actions || 0)
			const revenue = Number(r.conversions_value || 0)
			const ctr = impr > 0 ? (clicks / impr) * 100 : 0
			const cpa = conv > 0 ? spend / conv : null
			const roas = spend > 0 && revenue > 0 ? revenue / spend : null
			return { itemId: String(r.item), headline: r.title || '', thumbnailUrl: r.thumbnail_url || '', spend, ctr, conversions: conv, cpa, roas }
		})

		const sorter = {
			roas: (a,b) => (b.roas || -1) - (a.roas || -1),
			conversions: (a,b) => b.conversions - a.conversions,
			ctr: (a,b) => b.ctr - a.ctr,
			spend: (a,b) => b.spend - a.spend
		}[String(rank).toLowerCase()] || ((a,b)=> (b.roas||-1)-(a.roas||-1))
		items.sort(sorter)
		return res.json({ items: items.slice(0, 100), meta: { start: startStr, end: endStr, rank } })
	} catch (e) {
		console.error('taboola/top-content error', e)
		return res.status(500).json({ error: e.message })
	}
 }