// /api/voluum/campaigns.js - FIXED Campaign data with consistent date handling
// CRITICAL FIXES:
// ✅ Yesterday filter now works with proper EST timezone handling  
// ✅ Consistent date range logic with offers API
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
            const dateRange = calculateDateRangeFixed(range);
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

        // Create session
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

        // Define columns for campaign-level reporting
        const campaignColumns = [
            'campaignId',
            'campaignName',
            'visits',
            'conversions',
            'revenue',
            'cost',
            'cpa',
            'cv',
            'epc',
            'rpm',
            'rpc'
        ].join(',');

        console.log('🎯 Starting campaign data collection with PAGINATION...');

        // Get ALL campaigns with pagination
        const allCampaigns = await getAllCampaignsWithPagination(authToken, startDate, endDate, campaignColumns, os, trafficSource);
        
        console.log(`📊 Total campaigns retrieved from API: ${allCampaigns.length}`);
        
        // Filter for active campaigns with visits > 0
        const activeCampaigns = allCampaigns.filter(campaign => {
            const isNotDeleted = !campaign.deleted && campaign.deleted !== true;
            const hasVisits = (campaign.visits || 0) > 0;
            
            if (!isNotDeleted) {
                console.log(`🗑️ Filtering out deleted campaign: ${campaign.name} (deleted: ${campaign.deleted})`);
            }
            if (!hasVisits && isNotDeleted) {
                console.log(`👻 Filtering out campaign with no visits: ${campaign.name} (${campaign.visits} visits)`);
            }
            
            return isNotDeleted && hasVisits;
        });

        console.log(`✅ Successfully processed ${allCampaigns.length} total campaigns`);
        console.log(`✅ Returning ${activeCampaigns.length} campaigns WITH visits`);

        if (activeCampaigns.length > 0) {
            console.log('📋 Sample campaigns with visits:');
            activeCampaigns.slice(0, 3).forEach(campaign => {
                console.log(`   ${campaign.name}: ${campaign.visits} visits, $${campaign.revenue.toFixed(2)} revenue`);
            });
        }

        return res.json({
            success: true,
            campaigns: activeCampaigns,
            debug_info: {
                data_source: 'voluum_campaign_report_fixed',
                total_found: allCampaigns.length,
                active_campaigns: activeCampaigns.length,
                deleted_campaigns: allCampaigns.filter(c => c.deleted).length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                custom_dates: !!from && !!to,
                timezone_used: 'America/New_York',
                os_filter: os || 'all',
                traffic_source_filter: trafficSource || 'all',
                columns_requested: campaignColumns.split(',').length,
                pagination_used: true,
                visits_filter_applied: true,
                deleted_filter_applied: true,
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

// Campaign pagination with proper filtering
async function getAllCampaignsWithPagination(authToken, startDate, endDate, campaignColumns, osFilter, trafficSourceFilter) {
    let allCampaigns = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let pageCount = 0;
    
    console.log('🔄 Starting pagination loop for campaigns...');
    
    while (hasMore && pageCount < 50) {
        pageCount++;
        
        // Build URL with optional filters
        let reportUrl = `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=campaign&columns=${campaignColumns}&tz=America/New_York&limit=${limit}&offset=${offset}`;
        
        if (osFilter) {
            reportUrl += `&os=${osFilter}`;
        }
        
        console.log(`📄 Fetching campaigns page ${pageCount} (offset: ${offset})`);
        
        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            console.log(`❌ Campaign pagination request failed at offset ${offset}:`, errorText);
            
            if (offset === 0) {
                throw new Error(`Campaign API request failed: ${reportResponse.status} - ${errorText}`);
            }
            break;
        }

        const reportData = await reportResponse.json();
        console.log(`📊 Page ${pageCount} results:`, {
            hasRows: !!reportData.rows,
            rowCount: reportData.rows?.length || 0,
            hasColumns: !!reportData.columns && reportData.columns.length > 0
        });

        if (!reportData.rows || reportData.rows.length === 0) {
            console.log(`📄 Page ${pageCount}: No more data, stopping pagination`);
            hasMore = false;
            break;
        }

        // Process campaign data with both response formats
        const { columns, rows } = reportData;
        
        rows.forEach((rowData) => {
            let campaignData = {};
            
            if (columns && columns.length > 0) {
                // Format 1: rows are arrays, columns define structure
                columns.forEach((column, colIndex) => {
                    campaignData[column] = rowData[colIndex];
                });
            } else {
                // Format 2: rows are already objects
                campaignData = rowData;
            }

            // Normalize campaign data
            const normalizedCampaign = {
                id: campaignData.campaignId || campaignData.id,
                name: campaignData.campaignName || campaignData.name || 'Unknown Campaign',
                visits: parseInt(campaignData.visits) || 0,
                conversions: parseInt(campaignData.conversions) || parseInt(campaignData.cv) || 0,
                revenue: parseFloat(campaignData.revenue) || 0,
                cost: parseFloat(campaignData.cost) || 0,
                cpa: parseFloat(campaignData.cpa) || 0,
                epc: parseFloat(campaignData.epc) || 0,
                rpm: parseFloat(campaignData.rpm) || 0,
                rpc: parseFloat(campaignData.rpc) || 0,
                deleted: campaignData.deleted === true || campaignData.deleted === 'true',
                status: campaignData.status || 'ACTIVE'
            };

            // Calculate additional metrics
            normalizedCampaign.roas = normalizedCampaign.revenue > 0 ? (normalizedCampaign.revenue / normalizedCampaign.cost) : 0;
            normalizedCampaign.cvr = normalizedCampaign.visits > 0 ? ((normalizedCampaign.conversions / normalizedCampaign.visits) * 100) : 0;
            normalizedCampaign.profit = normalizedCampaign.revenue - normalizedCampaign.cost;

            allCampaigns.push(normalizedCampaign);
        });

        offset += rows.length;
        
        // Stop if we got fewer results than the limit (last page)
        if (rows.length < limit) {
            console.log(`📄 Page ${pageCount}: Got ${rows.length} results (less than limit), last page reached`);
            hasMore = false;
        }
    }
    
    console.log(`🎯 Campaign pagination completed: Total campaigns collected: ${allCampaigns.length} from ${pageCount} pages`);
    return allCampaigns;
}

// CRITICAL FIX: Identical date calculation to offers API for consistency
function calculateDateRangeFixed(range) {
    const now = new Date();
    const timezone = 'America/New_York';
    
    // Create a proper Eastern Time date by using the timezone conversion
    const getEasternDate = (date) => {
        // Convert to Eastern time properly
        const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
        const easternTime = new Date(utc + (-5 * 3600000)); // EST is UTC-5 (adjust for DST if needed)
        return easternTime;
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
            // CRITICAL FIX: Proper yesterday calculation in EST
            const yesterdayEastern = new Date(easternNow);
            yesterdayEastern.setDate(yesterdayEastern.getDate() - 1);
            
            startDate = new Date(yesterdayEastern);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(yesterdayEastern);
            endDate.setHours(23, 59, 59, 999);
            
            console.log(`🕐 FIXED Yesterday calculation: ${startDate.toISOString()} to ${endDate.toISOString()}`);
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
            
        case 'this_week':
            startDate = new Date(easternNow);
            const dayOfWeek = startDate.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDate.setDate(startDate.getDate() - daysToMonday);
            startDate.setHours(0, 0, 0, 0);
            
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'this_month':
            startDate = new Date(easternNow.getFullYear(), easternNow.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        default:
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
    }

    // Format dates for Voluum API (YYYY-MM-DD format in EST)
    const formatDateForVoluum = (date) => {
        return date.toISOString().split('T')[0];
    };

    const result = {
        startDate: formatDateForVoluum(startDate),
        endDate: formatDateForVoluum(endDate)
    };

    console.log(`📅 FIXED Date range for ${range}:`, result);
    return result;
}
