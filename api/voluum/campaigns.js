// /api/voluum/campaigns.js - FIXED Enhanced Voluum Campaigns API

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        // Support both preset ranges and custom date ranges
        const { range = 'last_7_days', from, to, os } = req.query;
        
        let startDate, endDate;
        if (from && to) {
            // Custom date range
            startDate = from;
            endDate = to;
            console.log(`📅 Using custom date range: ${startDate} to ${endDate}`);
        } else {
            // Preset range with FIXED date calculation
            const dateRange = calculateDateRange(range);
            startDate = dateRange.startDate;
            endDate = dateRange.endDate;
            console.log(`📅 Using preset range (${range}): ${startDate} to ${endDate}`);
        }

        // Get Voluum API credentials from environment variables
        const VOLUME_KEY = process.env.VOLUME_KEY;        // Secret Access Key
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;  // Access Key ID
        
        if (!VOLUME_KEY || !VOLUME_KEY_ID) {
            throw new Error('Voluum API credentials not configured. Missing VOLUME_KEY or VOLUME_KEY_ID environment variables');
        }
        
        console.log('🔑 Using Voluum API credentials:', {
            hasVolumeKey: !!VOLUME_KEY,
            hasVolumeKeyId: !!VOLUME_KEY_ID,
            volumeKeyLength: VOLUME_KEY?.length,
            volumeKeyIdLength: VOLUME_KEY_ID?.length
        });

        // Step 1: Create a session using the access key
        console.log('🔐 Creating Voluum API session...');
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
            console.log('❌ Session creation failed:', sessionError);
            throw new Error(`Session creation failed: ${sessionResponse.status} - ${sessionError}`);
        }

        const sessionData = await sessionResponse.json();
        const authToken = sessionData.token;
        
        if (!authToken) {
            throw new Error('No auth token received from Voluum session API');
        }

        console.log('✅ Session created successfully, token received:', authToken.substring(0, 8) + '...');

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
            'cpm',
            'cpc',
            'rpm',
            'rpc',
            'epc',
            'campaignStatus'
        ].join(',');

        // Build base URL with optional OS filter
        let baseUrl = `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=campaign&columns=${campaignColumns}&tz=America/New_York`;
        
        // Add OS filter if specified
        if (os && os !== 'all') {
            const osMap = {
                'android': 'Android',
                'ios': 'iOS',
                'windows': 'Windows',
                'macos': 'macOS',
                'unknown': 'Unknown'
            };
            const osValue = osMap[os.toLowerCase()] || os;
            baseUrl += `&os=${encodeURIComponent(osValue)}`;
            console.log(`🖥️ Adding OS filter: ${osValue}`);
        }
        
        console.log('🎯 Requesting ALL CAMPAIGN data with pagination and filters');
        console.log('📊 Base URL:', baseUrl);
        console.log('📅 Date range:', `${startDate} to ${endDate}`);
        console.log('🕐 Using Eastern Time timezone to match Voluum account');

        // Get all campaigns with pagination and filtering
        const reportData = await getAllCampaigns(authToken, baseUrl);
        console.log('📊 Raw report data structure:', {
            hasRows: !!reportData.rows,
            rowCount: reportData.rows?.length || 0,
            hasColumns: !!reportData.columns,
            columnCount: reportData.columns?.length || 0,
            dataKeys: Object.keys(reportData),
            sampleRow: reportData.rows?.[0]
        });

        // Handle different response structures from Voluum API
        let campaigns = [];
        
        if (reportData.rows && Array.isArray(reportData.rows)) {
            // Structure 1: Standard report with rows/columns
            const { rows = [], columns = [] } = reportData;
            
            if (columns && columns.length > 0) {
                // Standard structure with separate columns array
                campaigns = rows.map((row, index) => {
                    try {
                        const campaignData = {};
                        columns.forEach((column, colIndex) => {
                            campaignData[column] = row[colIndex];
                        });
                        return processCampaignFromReport(campaignData);
                    } catch (error) {
                        console.log(`❌ Error processing row ${index}:`, error);
                        return null;
                    }
                }).filter(Boolean);
            } else {
                // Structure 2: Rows contain objects directly (no separate columns)
                campaigns = rows.map((rowData, index) => {
                    try {
                        if (typeof rowData === 'object' && rowData !== null) {
                            return processCampaignFromReport(rowData);
                        }
                        console.log(`⚠️ Unexpected row format at index ${index}:`, rowData);
                        return null;
                    } catch (error) {
                        console.log(`❌ Error processing row ${index}:`, error);
                        return null;
                    }
                }).filter(Boolean);
            }
        } else if (reportData.campaigns && Array.isArray(reportData.campaigns)) {
            // Structure 3: Direct campaigns array
            campaigns = reportData.campaigns.map(campaign => processCampaignFromReport(campaign)).filter(Boolean);
        } else {
            console.log('⚠️ Unexpected report data structure:', Object.keys(reportData));
        }

        if (campaigns.length === 0) {
            console.log('⚠️ No campaigns could be processed from the API response');
            return res.json({
                success: true,
                campaigns: [],
                debug_info: {
                    data_source: 'voluum_report_api',
                    message: 'No campaigns could be processed from the API response',
                    date_range: `${startDate} to ${endDate}`,
                    selected_range: range,
                    custom_dates: !!from && !!to,
                    os_filter: os || 'none',
                    raw_response_structure: {
                        hasRows: !!reportData.rows,
                        rowCount: reportData.rows?.length || 0,
                        hasColumns: !!reportData.columns,
                        columnCount: reportData.columns?.length || 0,
                        hasCampaigns: !!reportData.campaigns,
                        dataKeys: Object.keys(reportData)
                    },
                    sample_data: reportData.rows?.[0] || reportData.campaigns?.[0] || 'No sample data',
                    base_url: baseUrl
                }
            });
        }

        // STRICT FILTERING: Only active campaigns with visits > 0
        const activeCampaigns = campaigns.filter(campaign => {
            const isNotDeleted = !campaign.deleted && 
                               campaign.status !== 'deleted' && 
                               campaign.status !== 'archived' &&
                               campaign.status !== 'paused';
            const hasVisits = campaign.visits > 0; // STRICT: Must have visits
            
            if (!isNotDeleted) {
                console.log(`🗑️ Filtering out deleted campaign: ${campaign.name} (status: ${campaign.status}, deleted: ${campaign.deleted})`);
            }
            if (!hasVisits && isNotDeleted) {
                console.log(`👻 Filtering out active campaign with no visits: ${campaign.name} (${campaign.visits} visits)`);
            }
            
            return isNotDeleted && hasVisits;
        });

        console.log(`✅ Successfully processed ${campaigns.length} total campaigns`);
        console.log(`✅ Found ${campaigns.filter(c => !c.deleted).length} active campaigns`);
        console.log(`✅ Found ${campaigns.filter(c => c.visits > 0).length} campaigns with visits`);
        console.log(`✅ Returning ${activeCampaigns.length} active campaigns WITH visits`);
        
        if (activeCampaigns.length > 0) {
            console.log('📋 Sample campaigns with visits:');
            activeCampaigns.slice(0, 5).forEach(campaign => {
                console.log(`   ${campaign.name}: ${campaign.visits} visits, $${campaign.revenue} revenue, status: ${campaign.status}`);
            });
        } else {
            console.log('⚠️ No campaigns found with visits. Sample of all campaigns:');
            campaigns.slice(0, 5).forEach(campaign => {
                console.log(`   ${campaign.name}: ${campaign.visits} visits, status: ${campaign.status}, deleted: ${campaign.deleted}`);
            });
        }

        return res.json({
            success: true,
            campaigns: activeCampaigns,
            debug_info: {
                data_source: 'voluum_report_api_fixed',
                total_found: campaigns.length,
                active_campaigns: activeCampaigns.length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                custom_dates: !!from && !!to,
                os_filter: os || 'none',
                api_endpoint: 'report with groupBy=campaign',
                columns_requested: campaignColumns.split(',').length,
                processing_method: reportData.columns ? 'rows_with_columns' : 'direct_objects',
                verification: {
                    data_type: 'campaigns',
                    grouped_by: 'campaign',
                    date_filter_applied: true,
                    timezone_used: 'America/New_York (Eastern Time)',
                    only_active_with_visits: true,
                    yesterday_fix_applied: true
                },
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Voluum API error:', error);
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

// Function to get all campaigns with pagination
async function getAllCampaigns(authToken, baseUrl) {
    let allCampaigns = [];
    let offset = 0;
    const limit = 500; // Increase limit to get more campaigns per request
    let hasMore = true;
    
    while (hasMore) {
        const paginatedUrl = `${baseUrl}&limit=${limit}&offset=${offset}`;
        console.log(`📄 Fetching page with offset ${offset}:`, paginatedUrl);
        
        const response = await fetch(paginatedUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.log(`❌ Pagination request failed at offset ${offset}:`, errorText);
            
            // If it's the first page and fails, throw error
            if (offset === 0) {
                throw new Error(`Campaign API request failed: ${response.status} - ${errorText}`);
            }
            // Otherwise, break the loop (partial data is better than none)
            break;
        }

        const data = await response.json();
        console.log(`📊 Page ${Math.floor(offset/limit) + 1} data:`, {
            hasRows: !!data.rows,
            rowCount: data.rows?.length || 0,
            totalSoFar: allCampaigns.length
        });

        if (!data.rows || data.rows.length === 0) {
            hasMore = false;
            break;
        }

        // Add this page's campaigns to our collection
        allCampaigns = allCampaigns.concat(data.rows);
        
        // Check if we got fewer results than the limit (last page)
        if (data.rows.length < limit) {
            hasMore = false;
        } else {
            offset += limit;
        }

        // Store columns from first response
        if (offset === 0 && data.columns) {
            allCampaigns.columns = data.columns;
        }
    }

    return {
        rows: allCampaigns,
        columns: allCampaigns.columns || []
    };
}

// Helper function to process campaign data from different response formats
function processCampaignFromReport(campaignData) {
    // Map various possible field names from Voluum API
    const visits = parseInt(campaignData.visits || campaignData.uniqueClicks || campaignData.clicks || 0);
    const conversions = parseInt(campaignData.conversions || campaignData.cv || 0);
    const revenue = parseFloat(campaignData.revenue || campaignData.payout || 0);
    const cost = parseFloat(campaignData.cost || campaignData.spend || 0);
    
    // FIXED: Improved campaign status detection
    const campaignStatus = campaignData.campaignStatus || campaignData.status || 'active';
    const isDeleted = campaignStatus === 'archived' || 
                     campaignStatus === 'deleted' || 
                     campaignStatus === 'paused' ||
                     campaignData.deleted === true;
    
    console.log(`📊 Processing campaign: ${campaignData.campaignName || campaignData.name} - Status: ${campaignStatus}, Deleted: ${isDeleted}, Visits: ${visits}`);
    
    return {
        id: campaignData.campaignId || campaignData.id || Math.random().toString(36).substr(2, 9),
        name: campaignData.campaignName || campaignData.name || 'Unnamed Campaign',
        visits: visits,
        conversions: conversions,
        revenue: revenue,
        cost: cost,
        spend: cost, // Alias
        cpa: conversions > 0 ? cost / conversions : 0,
        cv: parseFloat(campaignData.cv || (visits > 0 ? (conversions / visits) * 100 : 0)),
        epc: visits > 0 ? revenue / visits : 0,
        deleted: isDeleted,
        status: campaignStatus,
        // Add raw data for debugging
        rawStatus: campaignData.campaignStatus,
        rawDeleted: campaignData.deleted
    };
}

// FIXED: Date calculation function with proper "Yesterday" handling
function calculateDateRange(range) {
    const now = new Date();
    const timezone = 'America/New_York'; // Eastern Time to match Voluum account
    
    console.log('🕐 Current actual date:', now.toISOString());
    
    // Helper to get date in Eastern Time
    const getEasternDate = (date) => {
        return new Date(date.toLocaleString("en-US", { timeZone: timezone }));
    };
    
    // Current date in Eastern Time
    const easternNow = getEasternDate(now);
    console.log('🕐 Eastern time now:', easternNow.toISOString());
    let startDate, endDate;

    switch (range) {
        case 'today':
            startDate = new Date(easternNow);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            break;
            
        case 'yesterday':
            // FIXED: Proper yesterday calculation
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setHours(23, 59, 59, 999);
            
            console.log('📅 Yesterday calculation:', {
                easternNow: easternNow.toISOString(),
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });
            break;
            
        case 'last_7_days':
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 6); // 7 days including today
            startDate.setHours(0, 0, 0, 0);
            console.log('📅 Last 7 days calculation:', {
                easternNow: easternNow.toISOString(),
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });
            break;
            
        case 'last_30_days':
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 29); // 30 days including today
            startDate.setHours(0, 0, 0, 0);
            break;
            
        case 'this_week':
            // Monday to Sunday
            startDate = new Date(easternNow);
            const dayOfWeek = startDate.getDay();
            const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, Monday = 1
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
            // Default to last 7 days
            endDate = new Date(easternNow);
            endDate.setHours(23, 59, 59, 999);
            startDate = new Date(easternNow);
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
            break;
    }

    // Convert to ISO strings for Voluum API (YYYY-MM-DD format)
    const formatDate = (date) => {
        return date.toISOString().split('T')[0];
    };

    const result = {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
    
    console.log(`📅 Date range calculation for "${range}":`, result);
    
    return result;
}
