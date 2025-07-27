// /api/voluum/test-raw-data-structure.js - See exactly what Voluum API returns
export default async function handler(req, res) {
    try {
        const volumeKeyId = process.env.VOLUME_KEY_ID;
        const volumeKey = process.env.VOLUME_KEY;

        if (!volumeKeyId || !volumeKey) {
            return res.status(500).json({
                success: false,
                error: 'Missing Voluum API credentials'
            });
        }

        // Step 1: Get authentication token
        const authResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessId: volumeKeyId,
                accessKey: volumeKey
            })
        });

        if (!authResponse.ok) {
            return res.status(500).json({
                success: false,
                error: `Authentication failed: ${authResponse.status}`
            });
        }

        const authData = await authResponse.json();
        const token = authData.token;

        // Step 2: Test with last 7 days (same as your dashboard)
        const now = new Date();
        const endDate = now.toISOString().split('T')[0];
        const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Use exact same columns as your dashboard
        const columns = [
            'campaignId',
            'campaignName',
            'visits',
            'uniqueVisits', 
            'conversions',
            'allConversions',
            'revenue',
            'allConversionsRevenue',
            'cost',
            'totalCost',
            'clicks',
            'totalClicks'
        ].join(',');

        // Make the exact same call your dashboard makes
        const reportUrl = `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=campaign&columns=${columns}&tz=America/New_York&limit=10`;
        
        console.log('🔍 Making exact dashboard API call:', reportUrl);
        
        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': token,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            return res.status(500).json({
                success: false,
                error: `Report API failed: ${reportResponse.status} - ${errorText}`,
                url: reportUrl
            });
        }

        const reportData = await reportResponse.json();
        const rows = reportData.rows || [];

        console.log(`📊 Raw API response:`, reportData);
        console.log(`📊 Rows found: ${rows.length}`);

        // Analyze the first few rows in detail
        const detailedAnalysis = rows.slice(0, 5).map((row, index) => {
            console.log(`\n🔬 Analyzing row ${index}:`);
            console.log(`Raw row:`, row);
            
            // Check all possible revenue fields
            const revenueFields = {
                revenue: row.revenue,
                allConversionsRevenue: row.allConversionsRevenue,
                // Check for other possible field names
                totalRevenue: row.totalRevenue,
                campaignRevenue: row.campaignRevenue
            };

            // Check all possible visit fields  
            const visitFields = {
                visits: row.visits,
                uniqueVisits: row.uniqueVisits,
                totalVisits: row.totalVisits
            };

            // Check conversion fields
            const conversionFields = {
                conversions: row.conversions,
                allConversions: row.allConversions,
                totalConversions: row.totalConversions
            };

            // Test different parsing approaches
            const parsingTests = {
                revenue_parseFloat: parseFloat(row.revenue || 0),
                revenue_direct: row.revenue,
                revenue_allConversions: parseFloat(row.allConversionsRevenue || 0),
                visits_parseInt: parseInt(row.visits || 0),
                visits_direct: row.visits,
                conversions_parseInt: parseInt(row.conversions || 0),
                conversions_direct: row.conversions
            };

            return {
                campaign_name: row.campaignName,
                campaign_id: row.campaignId,
                all_fields: Object.keys(row),
                revenue_fields: revenueFields,
                visit_fields: visitFields,
                conversion_fields: conversionFields,
                parsing_tests: parsingTests,
                raw_row: row
            };
        });

        // Calculate totals using different methods
        const totalsAnalysis = {
            method1_revenue: rows.reduce((sum, row) => sum + parseFloat(row.revenue || 0), 0),
            method2_allConversionsRevenue: rows.reduce((sum, row) => sum + parseFloat(row.allConversionsRevenue || 0), 0),
            method1_visits: rows.reduce((sum, row) => sum + parseInt(row.visits || 0), 0),
            method2_uniqueVisits: rows.reduce((sum, row) => sum + parseInt(row.uniqueVisits || 0), 0),
            method1_conversions: rows.reduce((sum, row) => sum + parseInt(row.conversions || 0), 0),
            method2_allConversions: rows.reduce((sum, row) => sum + parseInt(row.allConversions || 0), 0)
        };

        // Check if any values are non-zero
        const hasNonZeroRevenue = rows.some(row => 
            parseFloat(row.revenue || 0) > 0 || 
            parseFloat(row.allConversionsRevenue || 0) > 0
        );

        const hasNonZeroVisits = rows.some(row => 
            parseInt(row.visits || 0) > 0 || 
            parseInt(row.uniqueVisits || 0) > 0
        );

        return res.json({
            success: true,
            api_call: {
                url: reportUrl,
                date_range: `${startDate} to ${endDate}`,
                timezone: 'America/New_York',
                columns_requested: columns
            },
            raw_response: {
                total_rows: rows.length,
                has_data: rows.length > 0,
                sample_rows: rows.slice(0, 3), // First 3 raw rows
                all_field_names: rows.length > 0 ? Object.keys(rows[0]) : []
            },
            detailed_analysis: detailedAnalysis,
            totals_analysis: totalsAnalysis,
            data_quality_check: {
                has_non_zero_revenue: hasNonZeroRevenue,
                has_non_zero_visits: hasNonZeroVisits,
                all_zeros: !hasNonZeroRevenue && !hasNonZeroVisits
            },
            debugging_notes: {
                dashboard_showing_inflated_numbers: "Your dashboard shows $24M revenue but API returns zeros",
                possible_causes: [
                    "Dashboard might be using cached/old data",
                    "Dashboard might be parsing data incorrectly", 
                    "Dashboard might be using different API endpoint",
                    "API might need different parameters to return non-zero data"
                ]
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Raw data test error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
