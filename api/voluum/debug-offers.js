// /api/voluum/debug-offers.js - Debug specific campaign offers

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        // Test with the specific campaign that's failing
        const campaignId = req.query.campaignId || 'test-campaign-id';
        const range = req.query.range || 'last_7_days';
        
        console.log(`🔍 DEBUGGING OFFERS for campaign: ${campaignId}`);

        // Calculate date range
        const { startDate, endDate } = calculateDateRange(range);
        console.log(`📅 Date range: ${startDate} to ${endDate}`);

        // Get Voluum API credentials
        const VOLUME_KEY = process.env.VOLUME_KEY;
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;
        
        if (!VOLUME_KEY || !VOLUME_KEY_ID) {
            return res.json({
                success: false,
                error: 'Missing API credentials',
                debug: {
                    hasVolumeKey: !!VOLUME_KEY,
                    hasVolumeKeyId: !!VOLUME_KEY_ID
                }
            });
        }

        // Create session
        console.log('🔐 Creating debug session...');
        const sessionResponse = await fetch('https://api.voluum.com/auth/access/session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                accessId: VOLUME_KEY_ID,
                accessKey: VOLUME_KEY
            })
        });

        if (!sessionResponse.ok) {
            const sessionError = await sessionResponse.text();
            return res.json({
                success: false,
                error: 'Session creation failed',
                debug: {
                    status: sessionResponse.status,
                    error: sessionError
                }
            });
        }

        const sessionData = await sessionResponse.json();
        const authToken = sessionData.token;
        console.log('✅ Session created');

        // Test multiple API calls to understand the issue

        // 1. Test direct offer query
        const offerColumns = [
            'offerId',
            'offerName',
            'visits',
            'conversions',
            'revenue',
            'cost'
        ].join(',');

        const testUrls = [
            // Test 1: Current implementation (limit 100)
            `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=offer&columns=${offerColumns}&tz=America/New_York&campaignId=${campaignId}&limit=100`,
            
            // Test 2: No campaign filter (get all offers)
            `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=offer&columns=${offerColumns}&tz=America/New_York&limit=100`,
            
            // Test 3: Larger limit
            `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=offer&columns=${offerColumns}&tz=America/New_York&campaignId=${campaignId}&limit=500`,
        ];

        const results = [];

        for (let i = 0; i < testUrls.length; i++) {
            const testUrl = testUrls[i];
            console.log(`🧪 Test ${i + 1}: ${testUrl}`);

            try {
                const response = await fetch(testUrl, {
                    headers: {
                        'cwauth-token': authToken,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    const rowCount = data.rows ? data.rows.length : 0;
                    const hasVisits = data.rows ? data.rows.filter(row => {
                        const visits = parseInt(row[2] || 0); // visits is usually 3rd column
                        return visits > 0;
                    }).length : 0;

                    results.push({
                        test: i + 1,
                        url: testUrl,
                        status: response.status,
                        success: true,
                        rowCount: rowCount,
                        offersWithVisits: hasVisits,
                        columns: data.columns || [],
                        sampleRow: data.rows ? data.rows[0] : null
                    });

                    console.log(`✅ Test ${i + 1}: ${rowCount} offers, ${hasVisits} with visits`);
                } else {
                    const errorText = await response.text();
                    results.push({
                        test: i + 1,
                        url: testUrl,
                        status: response.status,
                        success: false,
                        error: errorText
                    });
                    console.log(`❌ Test ${i + 1} failed: ${response.status}`);
                }
            } catch (error) {
                results.push({
                    test: i + 1,
                    url: testUrl,
                    success: false,
                    error: error.message
                });
                console.log(`❌ Test ${i + 1} error:`, error.message);
            }
        }

        // 4. Test campaign existence
        console.log('🔍 Testing if campaign exists...');
        const campaignTestUrl = `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=campaign&columns=campaignId,campaignName,visits&tz=America/New_York&limit=1000`;
        
        let campaignExists = false;
        let allCampaigns = [];
        
        try {
            const campaignResponse = await fetch(campaignTestUrl, {
                headers: {
                    'cwauth-token': authToken,
                    'Content-Type': 'application/json'
                }
            });

            if (campaignResponse.ok) {
                const campaignData = await campaignResponse.json();
                allCampaigns = campaignData.rows || [];
                campaignExists = allCampaigns.some(row => row[0] === campaignId); // campaignId is first column
                console.log(`📋 Found ${allCampaigns.length} campaigns, target exists: ${campaignExists}`);
            }
        } catch (error) {
            console.log('❌ Campaign test failed:', error.message);
        }

        return res.json({
            success: true,
            debug_info: {
                campaignId: campaignId,
                dateRange: `${startDate} to ${endDate}`,
                campaignExists: campaignExists,
                totalCampaigns: allCampaigns.length,
                apiTests: results,
                recommendations: generateRecommendations(results, campaignExists),
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Debug error:', error);
        return res.json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
}

function generateRecommendations(results, campaignExists) {
    const recommendations = [];
    
    if (!campaignExists) {
        recommendations.push('🚨 CAMPAIGN NOT FOUND: The campaignId does not exist in Voluum or has no data in the selected date range');
        recommendations.push('✅ SOLUTION: Check the campaign ID or try a different date range');
    }
    
    const successfulTests = results.filter(r => r.success);
    const testsWithData = successfulTests.filter(r => r.rowCount > 0);
    
    if (testsWithData.length === 0) {
        recommendations.push('🚨 NO OFFERS FOUND: No offers returned from any API test');
        recommendations.push('✅ SOLUTION 1: This campaign might use direct linking (no offer tracking)');
        recommendations.push('✅ SOLUTION 2: Try a longer date range (last_30_days)');
        recommendations.push('✅ SOLUTION 3: Check if offers exist but have no visits');
    } else {
        const testWithMostData = testsWithData.reduce((max, current) => 
            current.rowCount > max.rowCount ? current : max
        );
        recommendations.push(`✅ FOUND DATA: Test ${testWithMostData.test} returned ${testWithMostData.rowCount} offers`);
        recommendations.push(`✅ WITH VISITS: ${testWithMostData.offersWithVisits} offers have visits > 0`);
    }
    
    return recommendations;
}

function calculateDateRange(range) {
    const now = new Date();
    const timezone = 'America/New_York';
    
    const getEasternDate = (date) => {
        return new Date(date.toLocaleString("en-US", { timeZone: timezone }));
    };
    
    const easternNow = getEasternDate(now);
    let startDate, endDate;

    switch (range) {
        case 'today':
            startDate = new Date(easternNow);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'yesterday':
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'last_7_days':
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'last_30_days':
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 29);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        default:
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
    }

    const formatDate = (date) => {
        return date.toISOString().split('T')[0];
    };

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
}
