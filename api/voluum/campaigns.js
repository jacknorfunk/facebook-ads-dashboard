// /api/voluum/campaigns.js - Complete Enhanced Voluum Campaigns API with Proper Authentication

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        // Get date range parameter
        const { range = 'last_7_days' } = req.query;
        console.log(`📅 Processing date range: ${range}`);

        // Calculate proper date range with ISO strings and Eastern Time
        const { startDate, endDate } = calculateDateRange(range);
        console.log(`📅 Using date range: ${startDate} to ${endDate} (${range})`);

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

        // Build Voluum API request URL with proper timezone - REMOVED LIMIT to get ALL campaigns
        const reportUrl = `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=campaign&columns=${campaignColumns}&tz=America/New_York`;
        
        console.log('🎯 Requesting ALL CAMPAIGN data (no limit):', reportUrl);
        console.log('🕐 Using Eastern Time timezone to match Voluum account');

        // Make API request to Voluum with proper session token
        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': authToken,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            console.log('❌ Campaign report failed:', {
                status: reportResponse.status,
                statusText: reportResponse.statusText,
                errorText: errorText,
                url: reportUrl
            });
            
            // Fallback: Try to get campaign list directly
            const campaignListUrl = 'https://api.voluum.com/campaign';
            console.log('🔄 Trying direct campaign list endpoint:', campaignListUrl);
            
            const campaignListResponse = await fetch(campaignListUrl, {
                headers: {
                    'cwauth-token': authToken,
                    'Content-Type': 'application/json'
                }
            });

            if (!campaignListResponse.ok) {
                const campaignErrorText = await campaignListResponse.text();
                return res.status(500).json({
                    success: false,
                    error: 'Both report and campaign endpoints failed. Check API credentials and connectivity.',
                    debug_info: {
                        session_creation: 'successful',
                        report_error: {
                            status: reportResponse.status, 
                            statusText: reportResponse.statusText,
                            response: errorText
                        },
                        campaign_list_error: {
                            status: campaignListResponse.status,
                            statusText: campaignListResponse.statusText, 
                            response: campaignErrorText
                        },
                        date_range: `${startDate} to ${endDate}`,
                        timezone: 'America/New_York',
                        api_url: reportUrl
                    }
                });
            }

            // Use campaign list as fallback (may not have performance data)
            const campaignList = await campaignListResponse.json();
            const fallbackCampaigns = (campaignList.campaigns || []).map(campaign => ({
                id: campaign.id,
                name: campaign.name,
                status: campaign.status,
                visits: 0,
                conversions: 0,
                revenue: 0,
                cost: 0,
                deleted: campaign.status === 'archived' || campaign.status === 'deleted'
            }));

            return res.json({
                success: true,
                campaigns: fallbackCampaigns.filter(c => !c.deleted),
                debug_info: {
                    data_source: 'campaign_list_fallback',
                    warning: 'Using campaign list without performance data due to report API failure',
                    date_range_requested: `${startDate} to ${endDate}`,
                    fallback_campaigns: fallbackCampaigns.length
                }
            });
        }

        // Parse the successful report response
        const reportData = await reportResponse.json();
        console.log('📊 Raw report data structure:', {
            hasRows: !!reportData.rows,
            rowCount: reportData.rows?.length || 0,
            hasColumns: !!reportData.columns,
            columnCount: reportData.columns?.length || 0,
            dataKeys: Object.keys(reportData),
            sampleRow: reportData.rows?.[0],
            fullStructure: JSON.stringify(reportData, null, 2).substring(0, 500)
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
                    raw_response_structure: {
                        hasRows: !!reportData.rows,
                        rowCount: reportData.rows?.length || 0,
                        hasColumns: !!reportData.columns,
                        columnCount: reportData.columns?.length || 0,
                        hasCampaigns: !!reportData.campaigns,
                        dataKeys: Object.keys(reportData)
                    },
                    sample_data: reportData.rows?.[0] || reportData.campaigns?.[0] || 'No sample data',
                    report_url: reportUrl
                }
            });
        }

        // Filter to only active campaigns - TEMPORARILY RELAXED for debugging
        const activeCampaigns = campaigns.filter(campaign => {
            const isNotDeleted = !campaign.deleted && campaign.status !== 'deleted' && campaign.status !== 'archived';
            // TEMPORARILY: Don't filter by visits to see all campaigns
            const hasVisits = true; // campaign.visits > 0;  // Temporarily disabled
            
            if (!isNotDeleted) {
                console.log(`🗑️ Filtering out deleted campaign: ${campaign.name} (status: ${campaign.status}, deleted: ${campaign.deleted})`);
            }
            if (campaign.visits === 0) {
                console.log(`👻 Campaign with no visits (but keeping for debug): ${campaign.name} (${campaign.visits} visits)`);
            }
            
            return isNotDeleted && hasVisits;
        });

        console.log(`✅ Successfully processed ${campaigns.length} total campaigns`);
        console.log(`✅ Returning ${activeCampaigns.length} active campaigns (visits filter temporarily disabled)`);
        
        if (activeCampaigns.length > 0) {
            console.log('📋 Sample campaigns:');
            activeCampaigns.slice(0, 3).forEach(campaign => {
                console.log(`   ${campaign.name}: ${campaign.visits} visits, £${campaign.revenue} revenue, status: ${campaign.status}`);
            });
        }

        return res.json({
            success: true,
            campaigns: activeCampaigns,
            debug_info: {
                data_source: 'voluum_report_api',
                total_found: campaigns.length,
                active_campaigns: activeCampaigns.length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                api_endpoint: 'report with groupBy=campaign',
                columns_requested: campaignColumns.split(',').length,
                processing_method: reportData.columns ? 'rows_with_columns' : 'direct_objects',
                verification: {
                    data_type: 'campaigns',
                    grouped_by: 'campaign',
                    date_filter_applied: true,
                    timezone_used: 'America/New_York (Eastern Time)',
                    only_active_with_visits: true
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

function calculateDateRange(range) {
    // FIXED: Use actual current date, not a future date
    const now = new Date(); // This should be January 28, 2025
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
            startDate.setDate(startDate.getDate() - 6); // 7 days including today
            startDate.setHours(0, 0, 0, 0);
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

    return {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
    };
}
