export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    try {
        const token = await getVoluumToken();
        
        // Test workspace endpoints
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
        return res.json({ success: false, error: error.message });
    }
}
