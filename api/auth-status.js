// api/auth-status.js - GET to verify session cookie
 import crypto from 'crypto'
 import { parse } from 'cookie'

 const COOKIE_NAME = 'dashboard_session'

 function verify(value, secret) {
 	if (!value) return false
 	const [payload, sig] = value.split('.')
 	if (!payload || !sig) return false
 	const h = crypto.createHmac('sha256', secret)
 	h.update(payload)
 	const expected = h.digest('hex')
 	if (expected !== sig) return false
 	try {
 		const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
 		return session && session.exp && Date.now() < session.exp
 	} catch {
 		return false
 	}
 }

 export default async function handler(req, res) {
 	const secret = process.env.SESSION_SECRET || 'change-me'
 	const cookies = parse(req.headers.cookie || '')
 	const ok = verify(cookies[COOKIE_NAME], secret)
 	if (!ok) return res.status(401).json({ authenticated: false })
 	return res.json({ authenticated: true })
 }