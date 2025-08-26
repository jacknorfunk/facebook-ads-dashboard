// api/lifecycle-actions.js - GET recent actions
 import prisma from './lib/prisma'
 import { requireAuth } from './_auth-guard'

 export default async function handler(req, res) {
 	res.setHeader('Access-Control-Allow-Origin', '*')
 	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
 	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
 	if (req.method === 'OPTIONS') return res.status(200).end()
 	if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
 	if (!requireAuth(req, res)) return

 	try {
 		const { type, limit = 50 } = req.query
 		const where = type ? { type: String(type) } : {}
 		const actions = await prisma.action.findMany({
 			where,
 			orderBy: { decidedAt: 'desc' },
 			take: Number(limit)
 		})
 		return res.json(actions)
 	} catch (e) {
 		console.error('lifecycle-actions error', e)
 		return res.status(500).json({ error: e.message })
 	}
 }