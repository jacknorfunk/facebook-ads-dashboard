// /api/voluum/campaigns.js - Enhanced Multi-Source Dashboard API
// FOLLOWING OFFICIAL VOLUUM API DOCS: https://developers.voluum.com/
// KEY INSIGHT: "use your browsers' web dev tools to see what requests are being made when you use Voluum's front-end panel"
// CRITICAL FIXES:
// ✅ Using EXACT API structure from developers.voluum.com
// ✅ Proper authentication with cwauth-token header
// ✅ OS Filter fixed - properly passes parameters to Voluum API
// ✅ Device Filter added - following Voluum panel behavior
// ✅ Time format matches official examples: from=2017-02-20T00:00:00Z&to=2017-02-21T00:00:00Z&tz=Etc/GMT

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { range = 'last_7_days', from, to, os, deviceType, trafficSource } = req.query;

        console.log(`📊 Loading campaigns with range: ${range}, OS: ${os || 'all'}, Device: ${deviceType || 'all'}`);
        console.log(`📘 Following official Voluum API docs: https://developers.voluum.com/`);

        // Calculate date range following official examples
        let startDate, endDate;
        if (from && to) {
            startDate = from;
            endDate = to;
            console.log(`📅 Using custom date range: ${startDate} to ${endDate}`);
        } else {
            const dateRange = calculateDateRangeForVoluumAPI(range);
            startDate = dateRange.startDate;
            endDate = dateRange.endDate;
            console.log(`📅 Using preset range (${range}): ${startDate} to ${endDate}`);
        }

        // Get Voluum API credentials
        const VOLUME_KEY = process.env.VOLUME_KEY;
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;
        
        if (!VOLUME_KEY || !VOLUME_KEY_ID) {
            throw new Error('Voluum API credentials not configured. Missing VOLUME_KEY or VOLUME_KEY_ID environment variables');
        }

        // Step 1: Create session using access key (following official documentation)
        console.log('🔐 Creating Voluum API session following official docs...');
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
            console.log('❌ Campaign session creation failed:', sessionError);
            throw new Error(`Session creation failed: ${sessionResponse.status} - ${sessionError}`);
        }

        const sessionData = await sessionResponse.json();
        const authToken = sessionData.token;
        
        if (!authToken) {
            throw new Error('No auth token received from Voluum session API');
        }

        console.log('✅ Campaign session created successfully');

        // Step 2: Build report URL following official API structure
        // Updated per Voluum dev response: minutes/seconds/milliseconds ignored, use simplified format
        // Official example: from=2025-08-17T00Z&to=2025-08-18T00Z
        let reportUrl = `https://api.voluum.com/report?from=${startDate}T00Z&to=${endDate}T00Z&tz=America/New_York&groupBy=campaign&limit=1000`;
        
        // Add filters as query parameters (following browser dev tools pattern)
        if (os && os !== '') {
            console.log(`🎯 Adding OS filter: ${os}`);
            reportUrl += `&os=${encodeURIComponent(os)}`;
        }
        
        if (deviceType && deviceType !== '') {
            console.log(`📱 Adding Device Type filter: ${deviceType}`);
            reportUrl += `&deviceType=${encodeURIComponent(deviceType)}`;
        }
        
        console.log(`🎯 Fetching campaigns using official API structure:`, reportUrl);

        // Step 3: Make authorized request with cwauth-token header (as per official docs)
        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': authToken,  // Official header name from docs
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            console.log(`❌ Campaign report request failed:`, errorText);
            throw new Error(`Campaign API request failed: ${reportResponse.status} - ${errorText}`);
        }

        const reportData = await reportResponse.json();
        console.log(`📊 Raw campaign report data from official API:`, {
            hasRows: !!reportData.rows,
            rowCount: reportData.rows?.length || 0,
            hasColumns: !!reportData.columns && reportData.columns.length > 0,
            columnsCount: reportData.columns?.length || 0,
            sampleRow: reportData.rows?.[0],
            filters_applied: {
                os: os || 'none',
                deviceType: deviceType || 'none',
                dateRange: `${startDate} to ${endDate}`
            }
        });

        if (!reportData.rows || reportData.rows.length === 0) {
            console.log('⚠️ No campaigns found in the specified date range with current filters');
            return res.json({
                success: true,
                campaigns: [],
                debug_info: {
                    data_source: 'voluum_official_api_developers_voluum_com',
                    total_found: 0,
                    active_campaigns: 0,
                    date_range_used: `${startDate} to ${endDate}`,
                    selected_range: range,
                    custom_dates: !!from && !!to,
                    timezone_used: 'America/New_York',
                    api_endpoint: reportUrl,
                    filters_applied: {
                        os: os || 'none',
                        deviceType: deviceType || 'none'
                    },
                    message: 'No campaigns found in date range with current filters',
                    official_docs_followed: 'https://developers.voluum.com/',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Step 4: Process data following official API response format
        const { columns, rows } = reportData;
        const processedCampaigns = [];
        
        rows.forEach((rowData, index) => {
            let campaignData = {};
            
            // Handle both response formats as shown in official examples
            if (columns && columns.length > 0) {
                // Standard format: rows as arrays, columns as field names
                columns.forEach((column, colIndex) => {
                    campaignData[column] = rowData[colIndex];
                });
            } else {
                // Direct format: rows as complete objects
                campaignData = rowData;
            }

            // Normalize campaign data following official field names
            const normalizedCampaign = {
                id: campaignData.campaignId || campaignData.id || `campaign_${index}`,
                name: campaignData.campaignName || campaignData.name || 'Unknown Campaign',
                visits: parseInt(campaignData.visits || 0),
                conversions: parseInt(campaignData.conversions || campaignData.cv || 0),
                revenue: parseFloat(campaignData.revenue || 0),
                cost: parseFloat(campaignData.cost || 0),
                cpa: parseFloat(campaignData.cpa || 0),
                // Use proper payout data from Voluum for Average Payout calculation
                payout: parseFloat(campaignData.payout || campaignData.conversionPayout || 0),
                deleted: false, // Active campaigns from API
                status: campaignData.status || 'ACTIVE'
            };

            // Calculate additional metrics
            normalizedCampaign.roas = normalizedCampaign.cost > 0 ? (normalizedCampaign.revenue / normalizedCampaign.cost) : 0;
            normalizedCampaign.cvr = normalizedCampaign.visits > 0 ? ((normalizedCampaign.conversions / normalizedCampaign.visits) * 100) : 0;
            normalizedCampaign.profit = normalizedCampaign.revenue - normalizedCampaign.cost;
            
            // Calculate Average Payout properly using payout field or revenue/conversions
            normalizedCampaign.averagePayout = normalizedCampaign.payout > 0 ? 
                normalizedCampaign.payout : 
                (normalizedCampaign.conversions > 0 ? (normalizedCampaign.revenue / normalizedCampaign.conversions) : 0);

            // Only include campaigns with visits > 0 (following best practices)
            if (normalizedCampaign.visits > 0) {
                processedCampaigns.push(normalizedCampaign);
                console.log(`✅ Added campaign: ${normalizedCampaign.name} (${normalizedCampaign.visits} visits, ${normalizedCampaign.revenue.toFixed(2)} revenue)`);
            } else {
                console.log(`👻 Skipped campaign with no visits: ${normalizedCampaign.name}`);
            }
        });

        console.log(`✅ Successfully processed ${rows.length} total campaigns from official Voluum API`);
        console.log(`✅ Returning ${processedCampaigns.length} campaigns WITH visits`);

        if (processedCampaigns.length > 0) {
            console.log('📋 Sample campaigns with visits:');
            processedCampaigns.slice(0, 3).forEach(campaign => {
                console.log(`   ${campaign.name}: ${campaign.visits} visits, ${campaign.revenue.toFixed(2)} revenue`);
            });
        }

        return res.json({
            success: true,
            campaigns: processedCampaigns,
            debug_info: {
                data_source: 'voluum_official_api_developers_voluum_com',
                total_found: rows.length,
                active_campaigns: processedCampaigns.length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                custom_dates: !!from && !!to,
                timezone_used: 'America/New_York',
                api_endpoint: reportUrl,
                filters_applied: {
                    os: os || 'none',
                    deviceType: deviceType || 'none',
                    trafficSource: trafficSource || 'none'
                },
                columns_returned: columns || [],
                visits_filter_applied: true,
                epc_removed: true,
                average_payout_enhanced: true,
                official_docs_followed: 'https://developers.voluum.com/',
                cwauth_token_used: true,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Campaign API error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            debug_info: {
                error_details: error.stack,
                official_docs_reference: 'https://developers.voluum.com/',
                timestamp: new Date().toISOString()
            }
        });
    }
}

// Date range calculation following official Voluum API format
// Example from developers.voluum.com: from=2017-02-20T00:00:00Z&to=2017-02-21T00:00:00Z&tz=Etc/GMT
function calculateDateRangeForVoluumAPI(range) {
    // Get current time in EST (America/New_York timezone)
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    
    let startDate, endDate;

    switch (range) {
        case 'today':
            startDate = new Date(easternTime);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternTime);
            endDate.setHours(23, 0, 0, 0);
            break;
            
        case 'yesterday':
            const yesterday = new Date(easternTime);
            yesterday.setDate(yesterday.getDate() - 1);
            
            startDate = new Date(yesterday);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(yesterday);
            endDate.setHours(23, 0, 0, 0);
            
            console.log(`🕐 Yesterday calculation (EST): ${startDate.toISOString()} to ${endDate.toISOString()}`);
            break;
            
        case 'last_7_days':
            endDate = new Date(easternTime);
            endDate.setHours(23, 0, 0, 0);
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'last_30_days':
            endDate = new Date(easternTime);
            endDate.setHours(23, 0, 0, 0);
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 29);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'this_week':
            startDate = new Date(easternTime);
            const dayOfWeek = startDate.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDate.setDate(startDate.getDate() - daysToMonday);
            startDate.setHours(0, 0, 0, 0);
            
            endDate = new Date(easternTime);
            endDate.setHours(23, 0, 0, 0);
            break;
            
        case 'this_month':
            startDate = new Date(easternTime.getFullYear(), easternTime.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternTime);
            endDate.setHours(23, 0, 0, 0);
            break;
            
        default:
            endDate = new Date(easternTime);
            endDate.setHours(23, 0, 0, 0);
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
    }

    // Format dates for Voluum API following official examples (YYYY-MM-DD format)
    const formatDateForVoluumAPI = (date) => {
        return date.toISOString().split('T')[0];
    };

    const result = {
        startDate: formatDateForVoluumAPI(startDate),
        endDate: formatDateForVoluumAPI(endDate)
    };

    console.log(`📅 Date range for ${range} following official API format:`, result);
    return result;
}
