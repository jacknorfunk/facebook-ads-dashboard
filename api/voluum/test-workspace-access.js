// /api/voluum/test-workspace-access.js

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const volumeKeyId = process.env.VOLUME_KEY_ID;
        const volumeKey = process.env.VOLUME_KEY;

        // Get auth token
        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessId: volumeKeyId,
                accessKey: volumeKey
            })
        });

        const authData = await authResponse.json();
        const token = authData.token;

        // Test workspaces
        const workspaceResponse = await fetch('https://api.voluum.com/multiuser/workspace', {
            headers: { 'cwauth-token': token }
        });
        
        const workspaceData = await workspaceResponse.json();

        return res.json({
            success: true,
            workspaces: workspaceData,
            workspace_count: Array.isArray(workspaceData) ? workspaceData.length : 0
        });
        
    } catch (error) {
        return res.json({ 
            success: false, 
            error: error.message 
        });
    }
}
