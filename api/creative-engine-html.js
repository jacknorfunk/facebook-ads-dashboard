// api/creative-engine-html.js - Serves link hub for Creative Analysis Engine
 export default async function handler(req, res) {
 	res.setHeader('Access-Control-Allow-Origin', '*')
 	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
 	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
 	if (req.method === 'OPTIONS') return res.status(200).end()
 	if (req.method !== 'GET') return res.status(405).send('Method not allowed')

 	const base = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`
 	const accountId = '1789535'
 	const html = `<!DOCTYPE html>
 	<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
 	<title>Creative Engine Links</title>
 	<style>body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#0b0f15;color:#e6edf3;padding:24px}a{color:#93c5fd} .card{background:#111827;border:1px solid #1f2937;border-radius:12px;padding:20px;max-width:820px}</style>
 	</head><body>
 	<div class="card">
 		<h1>Creative Analysis Engine Links</h1>
 		<p>Use these links to navigate:</p>
 		<ul>
 			<li><a href="${base}/login.html">Login</a></li>
 			<li><a href="${base}/voluum-dashboard-enhanced.html">Main Dashboard</a></li>
 			<li><a href="${base}/creative-engine.html">Creative Analysis Engine</a></li>
 			<li><a href="${base}/api/taboola-debug">Taboola Debug</a></li>
 		</ul>
 		<h2>Data Endpoints (accountId=${accountId})</h2>
 		<ul>
 			<li><a href="${base}/api/taboola/items?date=last_30d&accountId=${accountId}">/api/taboola/items?date=last_30d&accountId=${accountId}</a></li>
 			<li><a href="${base}/api/taboola/summary?date=last_30d&accountId=${accountId}">/api/taboola/summary?date=last_30d&accountId=${accountId}</a></li>
 			<li><a href="${base}/api/taboola/top-content?rank=roas&accountId=${accountId}">/api/taboola/top-content?rank=roas&accountId=${accountId}</a></li>
 			<li><a href="${base}/api/taboola-campaigns?date_range=last_30d&accountId=${accountId}">/api/taboola-campaigns?date_range=last_30d&accountId=${accountId}</a></li>
 			<li><a href="${base}/api/taboola-creatives?date_preset=last_30d&accountId=${accountId}">/api/taboola-creatives?date_preset=last_30d&accountId=${accountId}</a></li>
 		</ul>
 	</div>
 	</body></html>`
 	res.setHeader('Content-Type', 'text/html; charset=utf-8')
 	return res.status(200).send(html)
 }