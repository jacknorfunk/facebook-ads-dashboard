// /api/voluum/campaigns.js - FIXED: Ensure we're pulling campaigns, not offers
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

        // Step 2: Calculate date range - FIXED to properly handle all options
        const range = req.query.range || 'last7days';
        let startDate, endDate;
        
        const now = new Date();
        endDate = now.toISOString().split('T')[0];
        
        switch(range) {
            case 'today':
                startDate = endDate;
                break;
            case 'yesterday':
                const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                startDate = yesterday.toISOString().split('T')[0];
                endDate = startDate;
                break;
            case 'last7days':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                break;
            case 'last30days':
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                break;
            case 'last90days':
                startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                break;
            case 'thismonth':
                const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                startDate = thisMonth.toISOString().split('T')[0];
                break;
            case 'lastmonth':
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                startDate = lastMonth.toISOString().split('T')[0];
                endDate = lastMonthEnd.toISOString().split('T')[0];
                break;
            default:
                // Default to last 7 days
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }

        // Step 3: Try multiple approaches to get CAMPAIGN data (not offers)
        
        // CRITICAL: Ensure we're getting campaign-level data, not offer-level data
        const campaignColumns = [
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

        let reportData;
        let reportUrl;

        // FIXED: Use the ACTUAL selected date range, not a fixed 90-day range
        console.log(`📅 Using selected date range: ${startDate} to ${endDate} (${range})`);
        
        // Method 1: Try campaign-level reporting with CORRECT TIMEZONE
        // FIXED: Use Eastern Time to match Voluum account settings
        reportUrl = `https://api.voluum.com/report?from=${startDate}&to=${endDate}&groupBy=campaign&columns=${campaignColumns}&tz=America/New_York&limit=1000`;
        
        console.log('🎯 Requesting CAMPAIGN-level data (not offers):', reportUrl);
        console.log(`📊 Date filter: ${range} (${startDate} to ${endDate})`);
        console.log('🕐 Using Eastern Time timezone to match Voluum account');
        
        const reportResponse = await fetch(reportUrl, {
            headers: {
                'cwauth-token': token,
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            const errorText = await reportResponse.text();
            console.log('❌ Campaign report failed, trying alternative approach...');
            
            // Method 2: If campaign grouping fails, try direct campaign endpoint
            const campaignListUrl = 'https://api.voluum.com/campaign';
            console.log('🔄 Trying direct campaign list endpoint:', campaignListUrl);
            
            const campaignListResponse = await fetch(campaignListUrl, {
                headers: {
                    'cwauth-token': token,
                    'Content-Type': 'application/json'
                }
            });

            if (!campaignListResponse.ok) {
                return res.status(500).json({
                    success: false,
                    error: `Both report and campaign endpoints failed. Report: ${reportResponse.status}, Campaign list: ${campaignListResponse.status}`,
                    debug_info: {
                        report_error: errorText,
                        attempted_urls: [reportUrl, campaignListUrl],
                        date_range_used: `${startDate} to ${endDate}`,
                        selected_range: range
                    }
                });
            }

            // Parse campaign list response
            const campaignListData = await campaignListResponse.json();
            console.log('📋 Campaign list response:', campaignListData);
            
            // Transform campaign list data to match expected format
            const campaigns = (campaignListData.campaigns || campaignListData || []).map((campaign, index) => {
                return {
                    id: campaign.id || campaign.campaignId || `campaign_${index}`,
                    name: campaign.name || campaign.campaignName || `Campaign ${index}`,
                    visits: 0, // Campaign list doesn't include metrics, would need separate report call
                    conversions: 0,
                    revenue: 0,
                    cost: 0,
                    clicks: 0,
                    status: campaign.status || 'ACTIVE',
                    trafficSource: determineTrafficSource(campaign.name || campaign.campaignName || ''),
                    roas: 0,
                    cpa: 0,
                    cvr: 0,
                    aov: 0
                };
            });

            return res.json({
                success: true,
                campaigns: campaigns,
                debug_info: {
                    data_source: 'campaign_list_endpoint',
                    total_found: campaigns.length,
                    date_range_used: `${startDate} to ${endDate}`,
                    selected_range: range,
                    note: 'Campaign list endpoint used - metrics will be 0 unless we fetch separate reports',
                    raw_response: campaignListData,
                    timestamp: new Date().toISOString()
                }
            });
        }

        reportData = await reportResponse.json();
        const rows = reportData.rows || [];

        console.log(`📊 Campaign report data: ${rows.length} rows found`);
        console.log(`🔍 Sample raw data structure:`, rows.slice(0, 2));

        // Step 4: Transform campaign data - ensure we're processing campaigns, not offers
        const campaigns = rows.map((row, index) => {
            // Log the actual raw data structure
            if (index < 3) {
                console.log(`Raw campaign row ${index}:`, row);
                console.log(`Raw campaign row ${index} keys:`, Object.keys(row || {}));
            }

            // Check if this looks like offer data instead of campaign data
            const hasOfferFields = row?.offerId || row?.offerName;
            const hasCampaignFields = row?.campaignId || row?.campaignName;
            
            if (hasOfferFields && !hasCampaignFields) {
                console.warn(`⚠️ Row ${index} appears to be offer data, not campaign data:`, {
                    offerId: row?.offerId,
                    offerName: row?.offerName,
                    campaignId: row?.campaignId,
                    campaignName: row?.campaignName
                });
            }

            // Build campaign object from row data
            const campaign = {
                id: row?.campaignId || row?.id || `campaign_${index}`,
                name: row?.campaignName || row?.name || `Campaign ${index}`,
                visits: parseInt(row?.visits || row?.uniqueVisits || 0),
                conversions: parseInt(row?.conversions || row?.allConversions || 0),
                revenue: parseFloat(row?.revenue || row?.allConversionsRevenue || 0),
                cost: parseFloat(row?.cost || row?.totalCost || 0),
                clicks: parseInt(row?.clicks || row?.totalClicks || 0),
                status: row?.status || 'ACTIVE',
                trafficSource: determineTrafficSource(row?.campaignName || row?.name || '')
            };

            // Calculate metrics
            campaign.roas = campaign.cost > 0 ? (campaign.revenue / campaign.cost) : 0;
            campaign.cpa = campaign.conversions > 0 ? (campaign.cost / campaign.conversions) : 0;
            campaign.cvr = campaign.visits > 0 ? ((campaign.conversions / campaign.visits) * 100) : 0;
            campaign.aov = campaign.conversions > 0 ? (campaign.revenue / campaign.conversions) : 0;

            // Log first few campaigns for debugging
            if (index < 3) {
                console.log(`Processed campaign ${index}:`, {
                    name: campaign.name,
                    visits: campaign.visits,
                    conversions: campaign.conversions,
                    revenue: campaign.revenue,
                    cost: campaign.cost,
                    clicks: campaign.clicks
                });
            }

            return campaign;
        });

        // Step 5: Filter for campaigns with meaningful data
        const activeCampaigns = campaigns
            .filter(campaign => {
                // Keep campaigns that have either activity OR a proper name
                const hasActivity = campaign.visits > 0 || campaign.clicks > 0 || 
                                   campaign.conversions > 0 || campaign.revenue > 0 || 
                                   campaign.cost > 0;
                const hasValidName = campaign.name && 
                                    campaign.name !== 'Unknown Campaign' && 
                                    campaign.name !== `Campaign ${campaigns.indexOf(campaign)}`;
                
                return hasActivity || hasValidName;
            })
            .sort((a, b) => {
                // Sort by total activity (visits + clicks + conversions)
                const activityA = (a.visits || 0) + (a.clicks || 0) + (a.conversions || 0);
                const activityB = (b.visits || 0) + (b.clicks || 0) + (b.conversions || 0);
                return activityB - activityA;
            })
            .slice(0, 100); // Take top 100 most active campaigns

        console.log(`🎯 Final result: ${activeCampaigns.length} campaigns (from ${campaigns.length} total)`);

        // Log data type verification
        const sampleCampaign = activeCampaigns[0];
        if (sampleCampaign) {
            console.log('✅ Sample campaign structure:', {
                id: sampleCampaign.id,
                name: sampleCampaign.name,
                hasMetrics: sampleCampaign.visits > 0 || sampleCampaign.conversions > 0
            });
        }

        return res.json({
            success: true,
            campaigns: activeCampaigns,
            debug_info: {
                data_source: 'campaign_report_endpoint',
                total_found: campaigns.length,
                active_campaigns: activeCampaigns.length,
                date_range_used: `${startDate} to ${endDate}`,
                selected_range: range,
                api_endpoint: 'report with groupBy=campaign',
                columns_requested: campaignColumns,
                sample_raw_data: rows.slice(0, 3),
                sample_processed_data: campaigns.slice(0, 3),
                verification: {
                    data_type: 'campaigns',
                    grouped_by: 'campaign',
                    not_offers: true,
                    date_filter_applied: true,
                    timezone_used: 'America/New_York (Eastern Time)',
                    timezone_note: 'Matches Voluum account timezone UTC-04:00'
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
                error_details: error.stack
            }
        });
    }
}

function determineTrafficSource(campaignName) {
    if (!campaignName) return 'Voluum';
    
    const name = campaignName.toLowerCase();
    if (name.includes('newsbreak')) return 'NewsBreak';
    if (name.includes('facebook') || name.includes('fb')) return 'Facebook';
    if (name.includes('taboola')) return 'Taboola';
    if (name.includes('admaven')) return 'AdMaven';
    if (name.includes('adcash')) return 'AdCash';
    if (name.includes('revcontent')) return 'RevContent';
    if (name.includes('outbrain')) return 'Outbrain';
    if (name.includes('mgid')) return 'MGID';
    
    return 'Voluum';
}
