export default async function handler(req, res) {
    try {
        const volumeKeyId = process.env.VOLUME_KEY_ID;
        const volumeKey = process.env.VOLUME_KEY;

        // Auth
        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessId: volumeKeyId, accessKey: volumeKey })
        });
        const authData = await authResponse.json();
        const token = authData.token;

        // Get workspaces
        const workspaceResponse = await fetch('https://api.voluum.com/multiuser/workspace', {
            headers: { 'cwauth-token': token }
        });
        const workspaceData = await workspaceResponse.json();
        const mgWorkspace = workspaceData.workspaces.find(w => w.name === 'MG+J');

        if (!mgWorkspace) {
            return res.json({ error: 'MG+J workspace not found' });
        }

        const testResults = {};

        // Method 1: Query parameter
        try {
            const response1 = await fetch(`https://api.voluum.com/campaign?workspaceId=${mgWorkspace.id}`, {
                headers: { 'cwauth-token': token }
            });
            const data1 = await response1.json();
            testResults.method1_query_param = {
                status: response1.status,
                count: Array.isArray(data1) ? data1.length : 0,
                data: data1
            };
        } catch (e) {
            testResults.method1_query_param = { error: e.message };
        }

        // Method 2: Header approach  
        try {
            const response2 = await fetch('https://api.voluum.com/campaign', {
                headers: { 
                    'cwauth-token': token,
                    'X-Workspace-Id': mgWorkspace.id
                }
            });
            const data2 = await response2.json();
            testResults.method2_header = {
                status: response2.status,
                count: Array.isArray(data2) ? data2.length : 0,
                data: data2
            };
        } catch (e) {
            testResults.method2_header = { error: e.message };
        }

        // Method 3: Try bulk campaigns endpoint
        try {
            const response3 = await fetch('https://api.voluum.com/bulk/campaign', {
                headers: { 'cwauth-token': token }
            });
            const data3 = await response3.text(); // This returns CSV
            testResults.method3_bulk = {
                status: response3.status,
                data_type: 'CSV',
                has_data: data3.length > 100,
                preview: data3.substring(0, 200)
            };
        } catch (e) {
            testResults.method3_bulk = { error: e.message };
        }

        // Method 4: Try report endpoint without date filters
        try {
            const response4 = await fetch('https://api.voluum.com/report?groupBy=campaign&columns=visits,conversions,revenue,cost', {
                headers: { 'cwauth-token': token }
            });
            const data4 = await response4.json();
            testResults.method4_report_no_date = {
                status: response4.status,
                totalRows: data4.totalRows || 0,
                rows: data4.rows?.length || 0,
                data: data4
            };
        } catch (e) {
            testResults.method4_report_no_date = { error: e.message };
        }

        return res.json({
            success: true,
            workspace_tested: mgWorkspace.name,
            workspace_id: mgWorkspace.id,
            test_results: testResults
        });

    } catch (error) {
        return res.json({ error: error.message });
    }
}
