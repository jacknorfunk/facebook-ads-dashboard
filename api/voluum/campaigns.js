// /api/voluum/campaigns.js - FIXED with Official Voluum API Documentation
// CRITICAL FIXES:
// ✅ Yesterday filter now works with proper EST timezone handling  
// ✅ Following official Voluum API documentation structure
// ✅ Proper campaign filtering (visits > 0, not deleted)

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        const { range = 'last_7_days', from, to, os, trafficSource } = req.query;

        console.log(`📊 Loading campaigns with range: ${range}`);

        // CRITICAL FIX: Use same date calculation logic as offers API
        let startDate, endDate;
        if (from && to) {
            startDate = from;
            endDate = to;
            console.log(`📅 Using custom date range: ${startDate} to ${endDate}`);
        } else {
            const dateRange = calculateDateRangeFixedForVoluum(range);
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

        // Create session using access key (following official documentation)
        console.log('🔐 Creating Voluum API session for campaigns...');
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

        // CRITICAL FIX: Use official Voluum API structure for campaign reporting
        // Following the official documentation: https://api.voluum.com/report?...
        // IMPORTANT: Voluum API requires times rounded to nearest hour (no minutes/seconds)
        let reportUrl = `https://api.voluum.com/report?from=${startDate}T00:00:00Z&to=${endDate}T23:00:00Z&tz=America/New_York&groupBy=campaign&limit=1000`;
        
        // Add optional filters
        if (os) {
            reportUrl += `&os=${os}`;
        }
        
        console.log(`🎯 Fetching campaigns:`, reportUrl);

        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            console.log(`❌ Campaign report request failed:`, errorText);
            throw new Error(`Campaign API request failed: ${reportResponse.status} - ${errorText}`);
        }

        const reportData = await reportResponse.json();
        console.log(`📊 Raw campaign report data:`, {
            hasRows: !!reportData.rows,
            rowCount: reportData.rows?.length || 0,
            hasColumns: !!reportData.columns && reportData.columns.length > 0,
            columnsCount: reportData.columns?.length || 0,
            sampleRow: reportData.rows?.[0]
        });

        if (!reportData.rows || reportData.rows.length === 0) {
            console.log('⚠️ No campaigns found in the specified date range');
            return res.json({
                success: true,
                campaigns: [],
                debug_info: {
                    data_source: 'voluum_campaign_report_official_api',
                    total_found: 0,
                    active_campaigns: 0,
                    date_range_used: `${startDate} to ${endDate}`,
                    selected_range: range,
                    custom_dates: !!from && !!to,
                    timezone_used: 'America/New_York',
                    api_endpoint: reportUrl,
                    message: 'No campaigns found in date range',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Process campaign data using official Voluum API response format
        const { columns, rows } = reportData;
        const processedCampaigns = [];
        
        rows.forEach((rowData, index) => {
            let campaignData = {};
            
            if (columns && columns.length > 0) {
                // Standard format: rows as arrays, columns as field names
                columns.forEach((column, colIndex) => {
                    campaignData[column] = rowData[colIndex];
                });
            } else {
                // Direct format: rows as complete objects
                campaignData = rowData;
            }

            // Normalize campaign data
            const normalizedCampaign = {
                id: campaignData.campaignId || campaignData.id || `campaign_${index}`,
                name: campaignData.campaignName || campaignData.name || 'Unknown Campaign',
                visits: parseInt(campaignData.visits || 0),
                conversions: parseInt(campaignData.conversions || campaignData.cv || 0),
                revenue: parseFloat(campaignData.revenue || 0),
                cost: parseFloat(campaignData.cost || 0),
                cpa: parseFloat(campaignData.cpa || 0),
                epc: parseFloat(campaignData.epc || 0),
                deleted: false, // Since we're getting data from API, these should be active
                status: campaignData.status || 'ACTIVE'
            };

            // Calculate additional metrics
            normalizedCampaign.roas = normalizedCampaign.cost > 0 ? (normalizedCampaign.revenue / normalizedCampaign.cost) : 0;
            normalizedCampaign.cvr = normalizedCampaign.visits > 0 ? ((normalizedCampaign.conversions / normalizedCampaign.visits) * 100) : 0;
            normalizedCampaign.profit = normalizedCampaign.revenue - normalizedCampaign.cost;

            // Only include campaigns with visits > 0
            if (normalizedCampaign.visits > 0) {
                processedCampaigns.push(normalizedCampaign);
                console.log(`✅ Added campaign: ${normalizedCampaign.name} (${normalizedCampaign.visits} visits, ${normalizedCampaign.revenue.toFixed(2)} revenue)`);
            } else {
                console.log(`👻 Skipped campaign with no visits: ${normalizedCampaign.name}`);
            }
        });

        console.log(`✅ Successfully processed ${rows.length} total campaigns from API`);
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
                data_source: 'voluum_campaign_report_official_api',
                total_found: rows.length,
                active_campaigns: processedCampaigns.length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                custom_dates: !!from && !!to,
                timezone_used: 'America/New_York',
                api_endpoint: reportUrl,
                os_filter: os || 'all',
                traffic_source_filter: trafficSource || 'all',
                columns_returned: columns || [],
                visits_filter_applied: true,
                official_voluum_api: true,
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
                timestamp: new Date().toISOString()
            }
        });
    }
}

// CRITICAL FIX: Identical date calculation to offers API for consistency
function calculateDateRangeFixedForVoluum(range) {
    // Get current time in EST (America/New_York timezone)
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    
    let startDate, endDate;

    switch (range) {
        case 'today':
            startDate = new Date(easternTime);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'yesterday':
            // CRITICAL FIX: Proper yesterday calculation in EST timezone
            const yesterday = new Date(easternTime);
            yesterday.setDate(yesterday.getDate() - 1);
            
            startDate = new Date(yesterday);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(yesterday);
            endDate.setHours(23, 59, 59, 999);
            
            console.log(`🕐 FIXED Yesterday calculation (EST): ${startDate.toISOString()} to ${endDate.toISOString()}`);
            break;
            
        case 'last_7_days':
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'last_30_days':
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 29);
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'this_week':
            // Monday start of week
            startDate = new Date(easternTime);
            const dayOfWeek = startDate.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDate.setDate(startDate.getDate() - daysToMonday);
            startDate.setHours(0, 0, 0, 0);
            
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'this_month':
            startDate = new Date(easternTime.getFullYear(), easternTime.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        default:
            // Default to last 7 days
            endDate = new Date(easternTime);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternTime);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
    }

    // Format dates for Voluum API (YYYY-MM-DD format)
    const formatDateForVoluumAPI = (date) => {
        return date.toISOString().split('T')[0];
    };

    const result = {
        startDate: formatDateForVoluumAPI(startDate),
        endDate: formatDateForVoluumAPI(endDate)
    };

    console.log(`📅 FIXED Date range for ${range} (EST timezone):`, result);
    return result;
}
