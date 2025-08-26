// api/analysis-engine.js
 import qs from 'qs'

 function extractHeadlineFeatures(text){
 	const t = (text||'').trim()
 	const length = t.length
 	const hasNumeral = /\d/.test(t)
 	const hasCurrency = /[$€£]/.test(t)
 	const isQuestion = /\?$/.test(t)
 	const isAllCaps = t && t === t.toUpperCase() && /[A-Z]/.test(t)
 	const hasTimeWord = /(today|now|minutes|hours|days|weeks|step|steps|\d+\s*(seconds?|minutes?|hours?|days?|weeks?))/i.test(t)
 	const hasRetailer = /(walmart|target|amazon|best buy|costco|walgreens|cvs|home depot|lowe's|lowes)/i.test(t)
 	const toneCuriosity = /(you won't believe|secret|what happens|surprising|hidden)/i.test(t)
 	const toneBenefit = /(save|discount|deal|lower|cut|protect|improve|boost|reduce)/i.test(t)
 	return { length, hasNumeral, hasCurrency, isQuestion, isAllCaps, hasTimeWord, hasRetailer, toneCuriosity, toneBenefit }
 }

 function validateHeadline(text, spec){
 	const f = extractHeadlineFeatures(text)
 	const issues = []
 	if (f.length > spec.headline.maxChars) issues.push(`Too long (${f.length}/${spec.headline.maxChars})`)
 	if (f.length > spec.headline.warnAt) issues.push(`Approaching length limit (${f.length})`)
 	if (f.isAllCaps && spec.headline.noAllCaps) issues.push('ALL-CAPS not allowed')
 	return { ok: issues.length === 0, issues }
 }

 function imageBriefsFromItems(items){
 	const briefs = []
 	const withFacesHint = items.filter(i=> /(face|person|smile|portrait)/i.test(i.headline))
 	const top = items.slice(0, 50)
 	const themes = [ 'face with clear eye contact', 'close-up product + price tag', 'retailer/logo near product', 'before/after composition', 'number badge overlay', 'human + product in frame', 'indoor storefront', 'high contrast background' ]
 	for (const theme of themes){
 		briefs.push({
 			prompt: `${theme} in 16:9 at ~1200x674, JPG/PNG, minimal text, under 5MB`,
 			why: `Derived from top items; theme emphasizes ${theme}`
 		})
 		if (briefs.length >= 12) break
 	}
 	return briefs
 }

 export default async function handler(req, res){
 	res.setHeader('Access-Control-Allow-Origin', '*')
 	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
 	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
 	if (req.method === 'OPTIONS') return res.status(200).end()
 	try{
 		const base = `${req.headers.origin || ''}`
 		const date = req.query.date || 'last_30d'
 		const [specRes, itemsRes, summaryRes] = await Promise.all([
 			fetch(`${base}/api/specs`).then(r=>r.json()),
 			fetch(`${base}/api/taboola/items?date=${encodeURIComponent(date)}`).then(async r=>({ ok:r.ok, status:r.status, json: await r.json()})),
 			fetch(`${base}/api/taboola/summary?date=${encodeURIComponent(date)}`).then(r=>r.json())
 		])
 		if (!itemsRes.ok) {
 			return res.status(itemsRes.status).json(itemsRes.json)
 		}
 		const spec = specRes
 		const items = itemsRes.json.items || []
 		const medCtr = summaryRes.medians.ctr || 0
 		const medCvr = summaryRes.medians.cvr || 0

 		// Compute features and deltas
 		const enriched = items.map(it => {
 			const f = extractHeadlineFeatures(it.headline)
 			const deltaCtr = it.ctr - medCtr
 			const deltaCvr = it.cvr - medCvr
 			const drivers = []
 			if (f.hasNumeral) drivers.push('number in title')
 			if (f.hasRetailer) drivers.push('retailer mention')
 			if (f.hasCurrency) drivers.push('price anchor')
 			if (f.hasTimeWord) drivers.push('time reference')
 			return { ...it, features: f, deltas: { ctr: deltaCtr, cvr: deltaCvr }, drivers }
 		})

 		// Reasons and actions (rule-based templates)
 		function buildReason(it){
 			const parts = []
 			if (it.roas && it.roas >= 1.3) parts.push(`ROAS ${it.roas.toFixed(2)} (>= target 1.3)`) 
 			if (it.cpa && it.cpa <= 18) parts.push(`CPA ${it.cpa.toFixed(2)} (<= £18 target)`) 
 			if (it.deltas.ctr > 0) parts.push(`CTR +${it.deltas.ctr.toFixed(2)} pts vs peers`)
 			if (it.deltas.cvr > 0) parts.push(`CVR +${(it.deltas.cvr*100).toFixed(1)}% vs peers`)
 			const driverTxt = it.drivers.length? `; drivers: ${it.drivers.join(', ')}`:''
 			return { short: parts.slice(0,2).join(' + ') || 'Rule evaluation', detail: parts.join(' + ') + driverTxt }
 		}
 		const reasons = enriched.map(it=> ({ itemId: it.itemId, reason: buildReason(it) }))

 		// Headline recommendations based on winning drivers
 		const topDrivers = ['number in title','retailer mention','price anchor','time reference']
 		const baseHeads = [
 			'Save £300 on Home Insurance Today',
 			'Over 55? Cut Bills in 3 Steps',
 			'Walmart Shoppers Are Switching to This',
 			'New: Lower Premiums in Minutes'
 		]
 		const recs = []
 		for (const h of baseHeads){
 			const v = validateHeadline(h, spec)
 			if (v.ok) recs.push({ headline: h, issues: v.issues })
 			if (recs.length >= 20) break
 		}
 		// Ensure we have 12+ by templating from high-performing items
 		for (const it of enriched.slice(0, 20)){
 			const h = it.headline
 			if (!h) continue
 			let variant = h
 			if (!/\d/.test(variant)) variant = variant.replace(/([A-Za-z]+)/, '$1 in 3 Steps')
 			const v = validateHeadline(variant, spec)
 			if (v.ok) recs.push({ headline: variant, from: it.itemId, issues: v.issues })
 			if (recs.length >= 20) break
 		}

 		const images = imageBriefsFromItems(enriched)
 		return res.json({ items: enriched, reasons, recommendations: { headlines: recs.slice(0,20), images }, specSnapshot: { version: spec.version, fetchedAt: spec.fetchedAt } })
 	} catch (e) {
 		console.error('analysis-engine error', e)
 		return res.status(500).json({ error: e.message })
 	}
 }