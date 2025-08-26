// api/lifecycle/creative.js
 import prisma from '../../api/lib/prisma'
 import { requireAuth } from '../../api/_auth-guard'

 export default async function handler(req, res) {
 	res.setHeader('Access-Control-Allow-Origin', '*')
 	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
 	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
 	if (req.method === 'OPTIONS') return res.status(200).end()
 	if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
 	if (!requireAuth(req, res)) return
 	const { id } = req.query
 	if (!id) return res.status(400).json({ error: 'id required' })
 	try {
 		const creative = await prisma.creative.findUnique({ where:{ id:String(id) }, include:{ actions:{ orderBy:{ decidedAt:'desc' } }, metricSnapshots:{ orderBy:{ at:'desc' } } } })
 		if (!creative) return res.status(404).json({ error: 'Not found' })
 		return res.json(creative)
 	} catch (e) {
 		console.error('lifecycle/creative error', e)
 		return res.status(500).json({ error: e.message })
 	}
 }