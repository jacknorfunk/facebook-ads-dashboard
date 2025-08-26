// api/auth-login.js - POST to authenticate and set session cookie
import crypto from 'crypto'
import { serialize } from 'cookie'
import bcrypt from 'bcryptjs'

const COOKIE_NAME = 'dashboard_session'
const COOKIE_MAX_AGE = 60 * 60 * 8 // 8 hours

function sign(payload, secret) {
	const h = crypto.createHmac('sha256', secret)
	h.update(payload)
	return h.digest('hex')
}

export default async function handler(req, res) {
	res.setHeader('Access-Control-Allow-Origin', '*')
	res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
	if (req.method === 'OPTIONS') return res.status(200).end()
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

	const { password } = req.body || {}
	const plain = process.env.DASHBOARD_PASSWORD || ''
	const hash = process.env.DASHBOARD_PASSWORD_BCRYPT || ''
	const secret = process.env.SESSION_SECRET || 'change-me'

	if (!password) return res.status(400).json({ error: 'Password required' })

	let ok = false
	if (hash) {
		ok = await bcrypt.compare(password, hash)
	} else if (plain) {
		ok = password === plain
	}

	if (!ok) return res.status(401).json({ error: 'Invalid credentials' })

	const session = {
		iss: 'dashboard',
		role: 'user',
		iat: Date.now(),
		exp: Date.now() + COOKIE_MAX_AGE * 1000
	}
	const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
	const signature = sign(payload, secret)
	const value = `${payload}.${signature}`

	res.setHeader('Set-Cookie', serialize(COOKIE_NAME, value, {
		httpOnly: true,
		secure: true,
		path: '/',
		maxAge: COOKIE_MAX_AGE,
		sameSite: 'lax'
	}))
	res.json({ success: true, exp: session.exp })
}