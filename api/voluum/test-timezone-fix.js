// /api/voluum/test-timezone-fix.js - Quick test to compare UTC vs Eastern Time revenue
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

        // Step 2: Test last 7 days with both timezones
        // Using Voluum's recommended simplified time format: T00Z
        const now = new Date();
        const endDate = now.toISOString().split('T')[0];
        const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const columns = ['campaignId', 'campaignName', 'visits', 'conversions', 'revenue', 'cost'].join(',');
        
        const results = {
            date_range: `${startDate} to ${endDate}`,
            timezone_comparison: {}
        };

        // Test 1: UTC (old way)
        console.log('🕐 Testing UTC timezone...');
        try {
            const utcUrl = `https://api.voluum.com/report?from=${startDate}T00Z&to=${endDate}T00Z&groupBy=campaign&columns=${columns}&tz=UTC&limit=50`;
            const utcResponse = await fetch(utcUrl, {
                headers: { 'cwauth-token': token, 'Content-Type': 'application/json' }
            });

            if (utcResponse.ok) {
                const utcData = await utcResponse.json();
                const utcTotalRevenue = utcData.rows?.reduce((sum, row) => sum + parseFloat(row.revenue || 0), 0) || 0;
                const utcTotalVisits = utcData.rows?.reduce((sum, row) => sum + parseInt(row.visits || 0), 0) || 0;
                const utcTotalConversions = utcData.rows?.reduce((sum, row) => sum + parseInt(row.conversions || 0), 0) || 0;
                
                results.timezone_comparison.utc = {
                    timezone: 'UTC',
                    campaign_count: utcData.rows?.length || 0,
                    total_revenue: utcTotalRevenue,
                    total_visits: utcTotalVisits,
                    total_conversions: utcTotalConversions,
                    url: utcUrl
                };
            } else {
                results.timezone_comparison.utc = {
                    timezone: 'UTC',
                    error: `HTTP ${utcResponse.status}`
                };
            }
        } catch (error) {
            results.timezone_comparison.utc = {
                timezone: 'UTC',
                error: error.message
            };
        }

        // Test 2: Eastern Time (new way - should match Voluum)
        console.log('🕐 Testing Eastern Time timezone...');
        try {
            const etUrl = `https://api.voluum.com/report?from=${startDate}T00Z&to=${endDate}T00Z&groupBy=campaign&columns=${columns}&tz=America/New_York&limit=50`;
            const etResponse = await fetch(etUrl, {
                headers: { 'cwauth-token': token, 'Content-Type': 'application/json' }
            });

            if (etResponse.ok) {
                const etData = await etResponse.json();
                const etTotalRevenue = etData.rows?.reduce((sum, row) => sum + parseFloat(row.revenue || 0), 0) || 0;
                const etTotalVisits = etData.rows?.reduce((sum, row) => sum + parseInt(row.visits || 0), 0) || 0;
                const etTotalConversions = etData.rows?.reduce((sum, row) => sum + parseInt(row.conversions || 0), 0) || 0;
                
                results.timezone_comparison.eastern = {
                    timezone: 'America/New_York (Eastern Time)',
                    campaign_count: etData.rows?.length || 0,
                    total_revenue: etTotalRevenue,
                    total_visits: etTotalVisits,
                    total_conversions: etTotalConversions,
                    url: etUrl
                };
            } else {
                results.timezone_comparison.eastern = {
                    timezone: 'America/New_York (Eastern Time)',
                    error: `HTTP ${etResponse.status}`
                };
            }
        } catch (error) {
            results.timezone_comparison.eastern = {
                timezone: 'America/New_York (Eastern Time)',
                error: error.message
            };
        }

        // Analysis
        const analysis = {
            issue_identified: false,
            recommendation: '',
            revenue_difference: 0,
            expected_match: 'Eastern Time should match Voluum interface'
        };

        if (results.timezone_comparison.utc?.total_revenue && results.timezone_comparison.eastern?.total_revenue) {
            const utcRevenue = results.timezone_comparison.utc.total_revenue;
            const etRevenue = results.timezone_comparison.eastern.total_revenue;
            
            analysis.revenue_difference = Math.abs(utcRevenue - etRevenue);
            analysis.revenue_difference_percentage = ((analysis.revenue_difference / Math.max(utcRevenue, etRevenue)) * 100).toFixed(2);
            
            if (analysis.revenue_difference > 100) { // Significant difference
                analysis.issue_identified = true;
                analysis.recommendation = `Timezone mismatch detected! Revenue difference of $${analysis.revenue_difference.toFixed(2)}. Use Eastern Time timezone to match Voluum interface.`;
            } else {
                analysis.recommendation = 'Revenue numbers are similar between timezones. The issue might be elsewhere.';
            }

            // Check which one is closer to expected Voluum interface revenue (~$18,516)
            const expectedRevenue = 18516.91; // From your Voluum screenshot
            const utcDiff = Math.abs(utcRevenue - expectedRevenue);
            const etDiff = Math.abs(etRevenue - expectedRevenue);
            
            analysis.voluum_interface_comparison = {
                expected_revenue: expectedRevenue,
                utc_difference: utcDiff,
                eastern_difference: etDiff,
                closer_match: utcDiff < etDiff ? 'UTC' : 'Eastern Time'
            };
        }

        return res.json({
            success: true,
            test_results: results,
            analysis: analysis,
            summary: {
                purpose: 'Compare revenue totals between UTC and Eastern Time to identify timezone mismatch',
                voluum_account_timezone: 'UTC-04:00 Eastern Time',
                recommendation: analysis.recommendation
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Timezone test error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}
