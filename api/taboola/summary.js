// api/taboola/summary.js
 import qs from 'qs'

 export default async function handler(req, res) {
 	res.setHeader('Access-Control-Allow-Origin', '*')
 	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
 	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
 	if (req.method === 'OPTIONS') return res.status(200).end()
	const queryAccountId = (req.query.accountId && String(req.query.accountId)) || undefined
	const ACCOUNT_ID = queryAccountId || process.env.TABOOLA_ACCOUNT_ID || '1789535'
	const CLIENT_ID = process.env.TABOOLA_CLIENT_ID
	const CLIENT_SECRET = process.env.TABOOLA_CLIENT_SECRET
	if (!CLIENT_ID || !CLIENT_SECRET) {
		return res.status(500).json({ error: 'Missing Taboola CLIENT_ID/CLIENT_SECRET' })
	}

	try {
		const { date = 'last_30d' } = req.query
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

		const rows = json.results || []
		function median(nums){ if(nums.length===0) return 0; const s=[...nums].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2? s[m]: (s[m-1]+s[m])/2 }
		const ctrs = rows.map(r=> (Number(r.impressions||0)>0? Number(r.clicks||0)/Number(r.impressions||0)*100:0))
		const cvrs = rows.map(r=> (Number(r.clicks||0)>0? Number(r.actions||0)/Number(r.clicks||0):0))
		const medians = { ctr: median(ctrs), cvr: median(cvrs) }
		return res.json({ medians, meta: { start: startStr, end: endStr, count: rows.length, accountId: ACCOUNT_ID } })
	} catch (e) {
		console.error('taboola/summary error', e)
		return res.status(500).json({ error: e.message })
	}
 }