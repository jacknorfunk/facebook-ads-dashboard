// /api/voluum/test-profile.js
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

        // Test profile endpoint
        const profileResponse = await fetch('https://api.voluum.com/profile', {
            headers: {
                'cwauth-token': token,
                'Content-Type': 'application/json'
            }
        });

        if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            
            return res.status(200).json({
                success: true,
                campaigns: [], // Not a campaign endpoint
                total: 0,
                profile: {
                    accountId: profileData.accountId,
                    email: profileData.email,
                    timezone: profileData.timezone
                },
                endpoint: '/profile',
                note: 'Account profile information'
            });
        } else {
            const errorText = await profileResponse.text();
            return res.status(200).json({
                success: false,
                error: `Profile failed: ${profileResponse.status}`,
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
