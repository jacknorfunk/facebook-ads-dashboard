// api/specs.js - GET Taboola specs snapshot
 let cache = { data: null, ts: 0 }
 const TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

 export default async function handler(req, res) {
 	res.setHeader('Access-Control-Allow-Origin', '*')
 	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
 	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
 	if (req.method === 'OPTIONS') return res.status(200).end()
 	const now = Date.now()
 	if (cache.data && now - cache.ts < TTL_MS) {
 		return res.json({ ...cache.data, cached: true })
 	}
 	try {
 		// Specs are typically static docs; encode concise policy rules here and mark version/date
 		const snapshot = {
 			version: 'taboola-specs-2025-01',
 			fetchedAt: new Date().toISOString(),
 			headline: { maxChars: 60, warnAt: 45, noAllCaps: true, misleadingClaims: false },
 			image: { aspect: '16:9', recommended: '1200x674', maxSizeMB: 5, formats: ['jpg','jpeg','png'] }
 		}
 		cache = { data: snapshot, ts: now }
 		return res.json(snapshot)
 	} catch (e) {
 		return res.status(500).json({ error: e.message })
 	}
 }