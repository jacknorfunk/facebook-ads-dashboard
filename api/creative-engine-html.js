import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
	try {
		const filePath = path.join(process.cwd(), 'creative-engine.html');
		let htmlContent = fs.readFileSync(filePath, 'utf8');

		const base = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
		const accountId = '1789535';
		const linkHub = `\n<div style="position:fixed;top:10px;left:10px;z-index:9999;background:#111827;border:1px solid #1f2937;border-radius:10px;padding:10px 12px;color:#e6edf3;font:14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial,sans-serif;">\n  <div style="font-weight:600;margin-bottom:6px;">Creative Engine Links</div>\n  <div style="display:flex;flex-wrap:wrap;gap:8px;">\n    <a href="${base}/login.html" style="color:#93c5fd;">Login</a>\n    <a href="${base}/voluum-dashboard-enhanced.html" style="color:#93c5fd;">Dashboard</a>\n    <a href="${base}/creative-engine.html" style="color:#93c5fd;">Creative Engine</a>\n    <a href="${base}/api/taboola-debug" style="color:#93c5fd;">Taboola Debug</a>\n    <a href="${base}/api/taboola/items?date=last_30d" style="color:#93c5fd;">Items</a>\n    <a href="${base}/api/taboola/summary?date=last_30d" style="color:#93c5fd;">Summary</a>\n    <a href="${base}/api/taboola/top-content?rank=roas" style="color:#93c5fd;">Top Content</a>\n  </div>\n</div>\n`;

		if (htmlContent.includes('<body>')) {
			htmlContent = htmlContent.replace('<body>', `<body>\n${linkHub}`);
		} else {
			htmlContent = `${linkHub}\n${htmlContent}`;
		}
		res.setHeader('Content-Type', 'text/html; charset=utf-8');
		res.status(200).send(htmlContent);
	} catch (error) {
		console.error('Error serving creative-engine.html:', error);
		res.status(500).json({ error: 'Failed to load Creative Analysis Engine' });
	}
}