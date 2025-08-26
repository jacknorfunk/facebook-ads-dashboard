// api/lifecycle-action.js - POST create lifecycle action
 import prisma from './lib/prisma'
 import { requireAuth } from './_auth-guard'

 export default async function handler(req, res) {
 	res.setHeader('Access-Control-Allow-Origin', '*')
 	res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
 	res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
 	if (req.method === 'OPTIONS') return res.status(200).end()
 	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
 	if (!requireAuth(req, res)) return

 	try {
 		const { creativeId, type, reasonShort, reasonDetail, inputsJson } = req.body || {}
 		if (!creativeId || !type) return res.status(400).json({ error: 'creativeId and type required' })

 		const action = await prisma.action.create({
 			data: {
 				creativeId,
 				type,
 				reasonShort: reasonShort || '',
 				reasonDetail: reasonDetail || '',
 				decidedBy: 'human',
 				inputsJson: inputsJson || {}
 			}
 		})
 		return res.json({ success: true, action })
 	} catch (e) {
 		console.error('lifecycle-action error', e)
 		return res.status(500).json({ error: e.message })
 	}
 }