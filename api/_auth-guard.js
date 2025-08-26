// api/_auth-guard.js
 import crypto from 'crypto'
 import { parse } from 'cookie'

 const COOKIE_NAME = 'dashboard_session'

 export function requireAuth(req, res) {
 	const secret = process.env.SESSION_SECRET || 'change-me'
 	const cookies = parse(req.headers.cookie || '')
 	const value = cookies[COOKIE_NAME]
 	if (!value) {
 		res.status(401).json({ error: 'Unauthorized' })
 		return false
 	}
 	const [payload, sig] = value.split('.')
 	if (!payload || !sig) {
 		res.status(401).json({ error: 'Unauthorized' })
 		return false
 	}
 	const h = crypto.createHmac('sha256', secret)
 	h.update(payload)
 	if (h.digest('hex') !== sig) {
 		res.status(401).json({ error: 'Unauthorized' })
 		return false
 	}
 	try {
 		const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
 		if (!session.exp || Date.now() > session.exp) {
 			res.status(401).json({ error: 'Session expired' })
 			return false
 		}
 		return true
 	} catch {
 		res.status(401).json({ error: 'Unauthorized' })
 		return false
 	}
 }