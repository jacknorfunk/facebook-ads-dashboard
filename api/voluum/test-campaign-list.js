// /api/voluum/test-campaign-list.js
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Get auth token
        const accessId = process.env.VOLUME_KEY_ID;
        const accessKey = process.env.VOLUME_KEY;

        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessId, accessKey })
        });

        const authData = await authResponse.json();
        const token = authData.token;

        // Test direct campaign list endpoint (not report)
        const campaignResponse = await fetch('https://api.voluum.com/campaign', {
            headers: {
                'cwauth-token': token,
                'Content-Type': 'application/json'
            }
        });

        if (campaignResponse.ok) {
            const campaigns = await campaignResponse.json();
            
            return res.status(200).json({
                success: true,
                campaigns: campaigns.map(c => ({
                    id: c.id,
                    name: c.name,
                    status: c.status
                })),
                total: campaigns.length,
                endpoint: '/campaign',
                note: 'Direct campaign list (no reporting data)'
            });
        } else {
            const errorText = await campaignResponse.text();
            return res.status(200).json({
                success: false,
                error: `Campaign list failed: ${campaignResponse.status}`,
                response: errorText.substring(0, 200)
            });
        }
    } catch (error) {
        return res.status(200).json({
            success: false,
            error: error.message
        });
    }
}
