// /api/voluum/test-minimal-report.js  
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

        // Test minimal report - just required params
        const today = new Date().toISOString().split('T')[0];
        const lastMonth = new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
        
        const reportUrl = `https://api.voluum.com/report?from=${lastMonth}&to=${today}`;
        
        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': token,
                'Content-Type': 'application/json'
            }
        });

        if (reportResponse.ok) {
            const reportData = await reportResponse.json();
            
            return res.status(200).json({
                success: true,
                campaigns: [], // Will process if needed
                total: reportData.totalRows || 0,
                rawRows: reportData.rows?.length || 0,
                endpoint: '/report (minimal)',
                note: 'Minimal report with just date range'
            });
        } else {
            const errorText = await reportResponse.text();
            return res.status(200).json({
                success: false,
                error: `Minimal report failed: ${reportResponse.status}`,
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
