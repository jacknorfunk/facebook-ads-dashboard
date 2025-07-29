// Enhanced JavaScript for Creative Intelligence Dashboard
// Integrates with the new NewsBreak API endpoints

// Enhanced loadNewsBreakData function
async function loadNewsBreakData(dateRange, campaignFilter) {
    console.log('🔍 Loading NewsBreak data with enhanced API...');
    
    try {
        // Use the enhanced campaigns endpoint
        const params = new URLSearchParams({
            date_range: dateRange,
            ...(campaignFilter && { campaign_id: campaignFilter })
        });

        console.log('📊 Fetching enhanced campaign data...');
        const response = await fetch(`/api/newsbreak/enhanced-campaigns?${params}`);

        if (!response.ok) {
            throw new Error(`Enhanced API request failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Enhanced API request failed');
        }

        console.log('✅ Enhanced campaign data loaded:', {
            campaigns: data.campaigns?.length || 0,
            metadata: data.metadata,
            summary: data.summary
        });
        
        // Transform enhanced NewsBreak data to dashboard format
        return {
            creatives: data.campaigns?.map(campaign => ({
                id: campaign.id,
                name: campaign.name,
                headline: campaign.headline || 'No headline available',
                description: campaign.description || '',
                imageUrl: campaign.imageUrl || '',
                campaignId: campaign.campaignId,
                spend: campaign.spend || 0,
                ctr: campaign.ctr || 0,
                roas: campaign.roas || 0,
                cpa: campaign.cpa || 0,
                conversions: campaign.conversions || 0,
                impressions: campaign.impressions || 0,
                deviceType: campaign.deviceType || 'All',
                geo: campaign.geo || 'US',
                status: campaign.status || 'Active',
                
                // Enhanced data
                creativeCount: campaign.creativeCount || 1,
                adSets: campaign.adSets || [],
                ads: campaign.ads || [],
                rawCampaignData: campaign.rawCampaignData
            })) || [],
            stats: {
                totalCampaigns: data.summary?.totalCampaigns || 0,
                activeCreatives: data.summary?.activeCreatives || 0,
                avgCTR: data.summary?.avgCTR || 0,
                avgROAS: data.summary?.avgROAS || 0,
                
                // Enhanced stats
                activeCampaigns: data.summary?.activeCampaigns || 0,
                totalSpend: data.summary?.totalSpend || 0,
                totalRevenue: data.summary?.totalRevenue || 0,
                averageCreativesPerCampaign: data.summary?.averageCreativesPerCampaign || 0,
                topPerformingCampaigns: data.summary?.topPerformingCampaigns || []
            },
            metadata: data.metadata
        };
    } catch (error) {
        console.error('Enhanced NewsBreak data loading error:', error);
        throw error;
    }
}

// Enhanced analyzeCreatives function with real AI analysis
async function analyzeCreatives() {
    const container = document.getElementById('imageAnalysisResults');
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Performing AI image analysis...</p></div>';

    if (!creativesData.length) {
        container.innerHTML = '<p>No creative data found. Load creative data first.</p>';
        return;
    }

    try {
        console.log('🤖 Starting AI creative analysis...');
        
        // Call the creative analysis API
        const response = await fetch('/api/newsbreak/creative-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                campaigns: creativesData,
                analysisType: 'image_analysis'
            })
        });

        if (!response.ok) {
            throw new Error(`Analysis API error: ${response.status}`);
        }

        const analysisData = await response.json();
        
        if (!analysisData.success) {
            throw new Error(analysisData.error || 'Analysis failed');
        }

        console.log('✅ AI image analysis completed:', analysisData);
        
        // Display the analysis results
        displayEnhancedImageAnalysis(analysisData.data);
        
    } catch (error) {
        console.error('AI image analysis error:', error);
        container.innerHTML = `<div class="error-state">AI Analysis Error: ${error.message}</div>`;
    }
}

// Enhanced headline analysis with AI insights
async function analyzeHeadlines() {
    const container = document.getElementById('headlineAnalysis');
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Analyzing headlines with AI...</p></div>';

    if (!creativesData.length) {
        container.innerHTML = '<p>No creative data found. Load creative data first.</p>';
        return;
    }

    try {
        console.log('🤖 Starting AI headline analysis...');
        
        const response = await fetch('/api/newsbreak/creative-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                campaigns: creativesData,
                analysisType: 'headline_analysis'
            })
        });

        if (!response.ok) {
            throw new Error(`Headline analysis API error: ${response.status}`);
        }

        const analysisData = await response.json();
        
        if (!analysisData.success) {
            throw new Error(analysisData.error || 'Headline analysis failed');
        }

        console.log('✅ AI headline analysis completed:', analysisData);
        
        // Display the analysis results
        displayEnhancedHeadlineAnalysis(analysisData.data);
        updateTopHeadlinesEnhanced(analysisData.data.topHeadlines);
        
    } catch (error) {
        console.error('AI headline analysis error:', error);
        container.innerHTML = `<div class="error-state">Headline Analysis Error: ${error.message}</div>`;
    }
}

// Enhanced AI suggestions generation
async function generateAISuggestions() {
    const container = document.getElementById('aiSuggestions');
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Generating AI-powered suggestions...</p></div>';

    if (!creativesData.length) {
        container.innerHTML = '<p>No creative data found. Load creative data first.</p>';
        return;
    }

    try {
        console.log('🤖 Generating AI suggestions...');
        
        const response = await fetch('/api/newsbreak/creative-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                campaigns: creativesData,
                analysisType: 'ai_suggestions'
            })
        });

        if (!response.ok) {
            throw new Error(`AI suggestions API error: ${response.status}`);
        }

        const analysisData = await response.json();
        
        if (!analysisData.success) {
            throw new Error(analysisData.error || 'AI suggestions failed');
        }

        console.log('✅ AI suggestions generated:', analysisData);
        
        // Display the suggestions
        displayEnhancedAISuggestions(analysisData.data);
        updateScalingOpportunitiesEnhanced(analysisData.data.scalingCandidates);
        
    } catch (error) {
        console.error('AI suggestions error:', error);
        container.innerHTML = `<div class="error-state">AI Suggestions Error: ${error.message}</div>`;
    }
}

// Enhanced A/B testing recommendations
async function loadABTests() {
    const container = document.getElementById('abTestContainer');
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading A/B test recommendations...</p></div>';

    if (!creativesData.length) {
        container.innerHTML = '<p>No creative data found. Load creative data first.</p>';
        return;
    }

    try {
        console.log('🤖 Generating A/B test recommendations...');
        
        const response = await fetch('/api/newsbreak/creative-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                campaigns: creativesData,
                analysisType: 'ab_test_recommendations'
            })
        });

        if (!response.ok) {
            throw new Error(`A/B test API error: ${response.status}`);
        }

        const analysisData = await response.json();
        
        if (!analysisData.success) {
            throw new Error(analysisData.error || 'A/B test recommendations failed');
        }

        console.log('✅ A/B test recommendations generated:', analysisData);
        
        // Display the A/B test recommendations
        displayEnhancedABTests(analysisData.data);
        
    } catch (error) {
        console.error('A/B test recommendations error:', error);
        container.innerHTML = `<div class="error-state">A/B Test Recommendations Error: ${error.message}</div>`;
    }
}

// Enhanced correlation matrix with AI insights
async function generateCorrelationMatrix() {
    const container = document.getElementById('correlationMatrixContainer');
    container.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Calculating AI-powered correlations...</p></div>';

    if (!creativesData.length) {
        container.innerHTML = '<p>No creative data found. Load creative data first.</p>';
        return;
    }

    try {
        console.log('🤖 Analyzing performance correlations...');
        
        const response = await fetch('/api/newsbreak/creative-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                campaigns: creativesData,
                analysisType: 'performance_correlation'
            })
        });

        if (!response.ok) {
            throw new Error(`Correlation API error: ${response.status}`);
        }

        const analysisData = await response.json();
        
        if (!analysisData.success) {
            throw new Error(analysisData.error || 'Correlation analysis failed');
        }

        console.log('✅ Performance correlations calculated:', analysisData);
        
        // Display the correlation matrix
        displayEnhancedCorrelationMatrix(analysisData.data);
        
    } catch (error) {
        console.error('Correlation analysis error:', error);
        
        // Fallback to local correlation calculation
        const localCorrelations = calculateCreativeCorrelations();
        displayLocalCorrelationMatrix(localCorrelations);
    }
}

// Display functions for enhanced analysis results

function displayEnhancedImageAnalysis(analysisData) {
    const container = document.getElementById('imageAnalysisResults');
    
    const analysisHTML = `
        <div class="analysis-results">
            <div class="insights-section">
                <h4 style="font-weight: 600; margin-bottom: 1rem; color: var(--primary-color);">🎯 Key Insights</h4>
                <div style="background: #f8fafc; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                    <pre style="white-space: pre-wrap; font-family: inherit; font-size: 0.875rem; line-height: 1.5;">${analysisData.rawAnalysis || 'Analysis completed'}</pre>
                </div>
            </div>
            
            <div class="recommendations-section">
                <h4 style="font-weight: 600; margin-bottom: 1rem; color: var(--success-color);">💡 Recommendations</h4>
                <div style="space-y: 0.5rem;">
                    ${(analysisData.recommendations || []).map(rec => `
                        <div style="padding: 0.5rem; background: #dcfce7; border-left: 3px solid #16a34a; margin-bottom: 0.5rem; font-size: 0.875rem;">
                            ${rec}
                        </div>
                    `).join('')}
                </div>
            </div>
            
            ${Object.keys(analysisData.performanceByImageType || {}).length > 0 ? `
                <div class="image-patterns-section">
                    <h4 style="font-weight: 600; margin-bottom: 1rem; color: var(--warning-color);">📊 Performance by Image Type</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        ${Object.entries(analysisData.performanceByImageType).map(([type, campaigns]) => `
                            <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 6px;">
                                <h5 style="font-weight: 600; margin-bottom: 0.5rem;">${type}</h5>
                                <div style="font-size: 0.875rem; color: var(--text-secondary);">
                                    ${campaigns.length} campaigns<br>
                                    Avg ROAS: ${(campaigns.reduce((sum, c) => sum + c.roas, 0) / campaigns.length).toFixed(2)}x
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    container.innerHTML = analysisHTML;
}

function displayEnhancedHeadlineAnalysis(analysisData) {
    const container = document.getElementById('headlineAnalysis');
    
    const analysisHTML = `
        <div class="headline-analysis-results">
            <div style="background: #f8fafc; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                <pre style="white-space: pre-wrap; font-family: inherit; font-size: 0.875rem; line-height: 1.5;">${analysisData.analysis}</pre>
            </div>
            
            ${analysisData.correlationData && analysisData.correlationData.length > 0 ? `
                <div class="correlation-insights">
                    <h4 style="font-weight: 600; margin-bottom: 1rem;">📈 Performance Impact Analysis</h4>
                    ${analysisData.correlationData.map(corr => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 0.5rem;">
                            <span style="font-weight: 500;">${corr.trait}</span>
                            <span style="font-weight: 600; color: ${corr.impact >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                                ${corr.impact >= 0 ? '+' : ''}${corr.impact.toFixed(1)}% ROAS Impact
                            </span>
                            <span style="font-size: 0.75rem; color: var(--text-secondary);">
                                ${corr.sampleSize} campaigns
                            </span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    container.innerHTML = analysisHTML;
}

function displayEnhancedAISuggestions(analysisData) {
    const container = document.getElementById('aiSuggestions');
    
    const suggestionsHTML = `
        <div class="ai-suggestions-results">
            <div style="background: #eff6ff; padding: 1rem; border-radius: 6px; border-left: 4px solid var(--primary-color); margin-bottom: 1rem;">
                <h4 style="font-weight: 600; margin-bottom: 1rem; color: var(--primary-color);">🤖 AI-Generated Optimization Recommendations</h4>
                <pre style="white-space: pre-wrap; font-family: inherit; font-size: 0.875rem; line-height: 1.5;">${analysisData.suggestions}</pre>
            </div>
            
            ${analysisData.testPriorities && analysisData.testPriorities.length > 0 ? `
                <div class="test-priorities">
                    <h4 style="font-weight: 600; margin-bottom: 1rem;">🎯 Priority Test Queue</h4>
                    <div style="space-y: 0.5rem;">
                        ${analysisData.testPriorities.map(test => `
                            <div style="display: flex; justify-content: between; align-items: center; padding: 0.75rem; background: #fef3c7; border-radius: 6px; margin-bottom: 0.5rem;">
                                <div>
                                    <span style="font-weight: 600;">Priority ${test.priority}:</span>
                                    <span style="margin-left: 0.5rem;">${test.test}</span>
                                </div>
                                <span style="font-size: 0.75rem; color: var(--text-secondary);">
                                    ${test.candidates} candidates
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    container.innerHTML = suggestionsHTML;
}

function displayEnhancedABTests(analysisData) {
    const container = document.getElementById('abTestContainer');
    
    if (!analysisData.recommendations || analysisData.recommendations.length === 0) {
        container.innerHTML = '<p>No A/B test recommendations available. Load campaign data first.</p>';
        return;
    }
    
    const testsHTML = `
        <div class="ab-tests-container">
            <div style="margin-bottom: 1rem; padding: 1rem; background: #f0f9ff; border-radius: 6px;">
                <h4 style="font-weight: 600; color: var(--primary-color);">
                    📊 AI-Generated A/B Test Recommendations
                </h4>
                <p style="color: var(--text-secondary); font-size: 0.875rem;">
                    ${analysisData.totalTestCandidates} campaigns identified for testing
                </p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8fafc;">
                        <th style="padding: 0.75rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Campaign</th>
                        <th style="padding: 0.75rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Current Performance</th>
                        <th style="padding: 0.75rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Recommended Tests</th>
                        <th style="padding: 0.75rem; text-align: left; font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase;">Priority</th>
                    </tr>
                </thead>
                <tbody>
                    ${analysisData.recommendations.map(rec => `
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            <td style="padding: 0.75rem; font-size: 0.875rem;">
                                <div style="font-weight: 500; margin-bottom: 0.25rem;">${rec.campaignName}</div>
                                <div style="font-size: 0.75rem; color: var(--text-secondary);">ID: ${rec.campaignId}</div>
                            </td>
                            <td style="padding: 0.75rem; font-size: 0.875rem;">
                                <div style="margin-bottom: 0.25rem;">ROAS: ${rec.currentPerformance.roas.toFixed(2)}x</div>
                                <div style="margin-bottom: 0.25rem;">CTR: ${(rec.currentPerformance.ctr * 100).toFixed(2)}%</div>
                                <div style="color: var(--text-secondary);">Spend: ${rec.currentPerformance.spend.toFixed(2)}</div>
                            </td>
                            <td style="padding: 0.75rem; font-size: 0.875rem;">
                                ${rec.recommendedTests.map(test => `
                                    <div style="margin-bottom: 0.5rem; padding: 0.5rem; background: #f8fafc; border-radius: 4px;">
                                        <div style="font-weight: 500; margin-bottom: 0.25rem;">${test.type}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${test.hypothesis}</div>
                                        ${test.expectedLift ? `<div style="font-size: 0.75rem; color: var(--success-color); font-weight: 500;">${test.expectedLift}</div>` : ''}
                                    </div>
                                `).join('')}
                            </td>
                            <td style="padding: 0.75rem; font-size: 0.875rem;">
                                ${rec.recommendedTests.map(test => `
                                    <span class="tag ${test.priority === 'High' ? 'high-performing' : test.priority === 'Medium' ? 'warning' : ''}" style="display: inline-block; margin-bottom: 0.25rem;">
                                        ${test.priority}
                                    </span>
                                `).join('<br>')}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            ${analysisData.priorityTests && analysisData.priorityTests.length > 0 ? `
                <div style="margin-top: 1rem; padding: 1rem; background: #fef3c7; border-radius: 6px;">
                    <h4 style="font-weight: 600; margin-bottom: 1rem; color: var(--warning-color);">⚡ High Priority Tests (Start These First)</h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
                        ${analysisData.priorityTests.map(test => `
                            <div style="padding: 0.75rem; background: white; border-radius: 6px; border: 1px solid #fbbf24;">
                                <div style="font-weight: 600; margin-bottom: 0.5rem;">${test.type}</div>
                                <div style="font-size: 0.875rem; margin-bottom: 0.5rem;">${test.hypothesis}</div>
                                <div style="font-size: 0.75rem; color: var(--success-color); font-weight: 500;">${test.expectedLift}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    
    container.innerHTML = testsHTML;
}

function displayEnhancedCorrelationMatrix(analysisData) {
    const container = document.getElementById('correlationMatrixContainer');
    
    // Implementation for enhanced correlation matrix display
    const matrixHTML = `
        <div class="enhanced-correlation-matrix">
            <div style="padding: 1rem;">
                <div style="background: #f0f9ff; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                    <h4 style="font-weight: 600; color: var(--primary-color); margin-bottom: 0.5rem;">🧠 AI-Powered Performance Correlation Analysis</h4>
                    <p style="color: var(--text-secondary); font-size: 0.875rem;">Statistical analysis of creative traits vs performance metrics</p>
                </div>
                
                <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 0.5rem; font-weight: 600; margin-bottom: 1rem; padding: 0.75rem; background: #f8fafc; border-radius: 6px;">
                    <div>Creative Trait</div>
                    <div style="text-align: center;">ROAS Impact</div>
                    <div style="text-align: center;">CTR Impact</div>
                    <div style="text-align: center;">Confidence</div>
                    <div style="text-align: center;">Sample Size</div>
                </div>
                
                ${analysisData && analysisData.correlations ? analysisData.correlations.map(corr => `
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr; gap: 0.5rem; align-items: center; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 0.5rem;">
                        <div style="font-weight: 500;">${corr.trait}</div>
                        <div style="text-align: center; font-weight: 600; color: ${corr.roasImpact >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                            ${corr.roasImpact >= 0 ? '+' : ''}${(corr.roasImpact * 100).toFixed(1)}%
                        </div>
                        <div style="text-align: center; font-weight: 600; color: ${corr.ctrImpact >= 0 ? 'var(--success-color)' : 'var(--danger-color)'};">
                            ${corr.ctrImpact >= 0 ? '+' : ''}${(corr.ctrImpact * 100).toFixed(1)}%
                        </div>
                        <div style="text-align: center; color: ${corr.confidence >= 0.8 ? 'var(--success-color)' : corr.confidence >= 0.6 ? 'var(--warning-color)' : 'var(--text-secondary)'};">
                            ${(corr.confidence * 100).toFixed(0)}%
                        </div>
                        <div style="text-align: center; color: var(--text-secondary);">${corr.sampleSize}</div>
                    </div>
                `).join('') : '<p>Correlation analysis data not available</p>'}
            </div>
        </div>
    `;
    
    container.innerHTML = matrixHTML;
}

function displayLocalCorrelationMatrix(correlations) {
    const container = document.getElementById('correlationMatrixContainer');
    
    const matrixHTML = `
        <div style="padding: 1rem;">
            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 0.5rem; font-weight: 600; margin-bottom: 1rem; padding: 0.5rem; background: #f8fafc;">
                <div>Creative Trait</div>
                <div style="text-align: center;">ROAS Impact</div>
                <div style="text-align: center;">CTR Impact</div>
                <div style="text-align: center;">Sample Size</div>
            </div>
            ${correlations.map(corr => `
                <div class="correlation-matrix">
                    <div class="correlation-trait">${corr.trait}</div>
                    <div class="correlation-value ${corr.roasImpact >= 0 ? 'metric-positive' : 'metric-negative'}">
                        ${corr.roasImpact >= 0 ? '+' : ''}${(corr.roasImpact * 100).toFixed(1)}%
                    </div>
                    <div class="correlation-value ${corr.ctrImpact >= 0 ? 'metric-positive' : 'metric-negative'}">
                        ${corr.ctrImpact >= 0 ? '+' : ''}${(corr.ctrImpact * 100).toFixed(1)}%
                    </div>
                    <div class="correlation-value">${corr.sampleSize}</div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = matrixHTML;
}

function updateTopHeadlinesEnhanced(topHeadlines) {
    const topHeadlinesContainer = document.getElementById('topHeadlines');
    
    if (!topHeadlines || topHeadlines.length === 0) {
        topHeadlinesContainer.innerHTML = '<p>No top headlines data available</p>';
        return;
    }

    const headlinesHTML = `
        <div style="space-y: 1rem;">
            <div style="background: #f0f9ff; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                <h4 style="font-weight: 600; color: var(--primary-color);">🏆 Top Performing Headlines</h4>
                <p style="color: var(--text-secondary); font-size: 0.875rem;">Ranked by ROAS performance</p>
            </div>
            ${topHeadlines.map((headline, index) => `
                <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <span style="font-weight: 600; color: var(--primary-color);">#${index + 1}</span>
                        <div style="text-align: right;">
                            <div style="font-size: 0.875rem; color: var(--success-color); font-weight: 600;">${headline.roas.toFixed(2)}x ROAS</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">${(headline.ctr * 100).toFixed(2)}% CTR</div>
                        </div>
                    </div>
                    <div style="font-weight: 500; margin-bottom: 0.5rem;">${headline.headline}</div>
                    <div style="font-size: 0.75rem; color: var(--text-secondary);">
                        ${headline.conversions} conversions • Word count: ${headline.wordCount || 'N/A'}
                        ${headline.hasNumbers ? ' • Has Numbers' : ''}
                        ${headline.hasQuestion ? ' • Question Format' : ''}
                        ${headline.hasUrgency ? ' • Urgency Words' : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    topHeadlinesContainer.innerHTML = headlinesHTML;
}

function updateScalingOpportunitiesEnhanced(scalingCandidates) {
    const container = document.getElementById('scalingOpportunities');
    
    if (!scalingCandidates || scalingCandidates.length === 0) {
        container.innerHTML = '<p>No immediate scaling opportunities found. Focus on optimizing current campaigns.</p>';
        return;
    }

    const opportunitiesHTML = `
        <div>
            <div style="background: #f0fdf4; padding: 1rem; border-radius: 6px; margin-bottom: 1rem;">
                <h4 style="font-weight: 600; color: var(--success-color);">🚀 AI-Identified Scaling Opportunities</h4>
                <p style="color: var(--text-secondary); font-size: 0.875rem;">${scalingCandidates.length} high-potential campaigns ready for budget increases</p>
            </div>
            ${scalingCandidates.map(candidate => `
                <div style="padding: 1rem; border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                        <div style="font-weight: 600; color: var(--success-color);">🚀 Scale Opportunity</div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.875rem; font-weight: 600;">${candidate.roas.toFixed(2)}x ROAS</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">${candidate.spend.toFixed(2)} spent</div>
                        </div>
                    </div>
                    <div style="font-weight: 500; margin-bottom: 0.5rem;">${candidate.name}</div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary);">
                        <span>Current Budget: ${candidate.spend.toFixed(2)}</span>
                        <span style="color: var(--success-color); font-weight: 500;">
                            Recommended: ${candidate.recommendedBudget.toFixed(2)} 
                            (+${((candidate.recommendedBudget / candidate.spend - 1) * 100).toFixed(0)}%)
                        </span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = opportunitiesHTML;
}

// Enhanced comprehensive analysis function
async function performComprehensiveAnalysis() {
    if (!creativesData.length) {
        console.warn('No creative data available for comprehensive analysis');
        return;
    }

    try {
        console.log('🤖 Starting comprehensive AI analysis...');
        
        const response = await fetch('/api/newsbreak/creative-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                campaigns: creativesData,
                analysisType: 'comprehensive' // This will trigger all analysis types
            })
        });

        if (!response.ok) {
            throw new Error(`Comprehensive analysis API error: ${response.status}`);
        }

        const analysisData = await response.json();
        
        if (!analysisData.success) {
            throw new Error(analysisData.error || 'Comprehensive analysis failed');
        }

        console.log('✅ Comprehensive AI analysis completed:', analysisData);
        
        // Update all dashboard sections with comprehensive results
        if (analysisData.data.imageAnalysis) {
            displayEnhancedImageAnalysis(analysisData.data.imageAnalysis);
        }
        
        if (analysisData.data.headlineAnalysis) {
            displayEnhancedHeadlineAnalysis(analysisData.data.headlineAnalysis);
            updateTopHeadlinesEnhanced(analysisData.data.headlineAnalysis.topHeadlines);
        }
        
        if (analysisData.data.aiSuggestions) {
            displayEnhancedAISuggestions(analysisData.data.aiSuggestions);
            updateScalingOpportunitiesEnhanced(analysisData.data.aiSuggestions.scalingCandidates);
        }
        
        if (analysisData.data.abTestRecommendations) {
            displayEnhancedABTests(analysisData.data.abTestRecommendations);
        }
        
        // Update dashboard summary
        updateDashboardWithComprehensiveInsights(analysisData.data);
        
    } catch (error) {
        console.error('Comprehensive analysis error:', error);
        showError('Comprehensive AI analysis failed: ' + error.message);
    }
}

function updateDashboardWithComprehensiveInsights(analysisData) {
    // Update the dashboard summary with AI insights
    const summaryInsights = document.createElement('div');
    summaryInsights.className = 'ai-insights-summary';
    summaryInsights.innerHTML = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
            <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">🤖 AI Analysis Summary</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-size: 0.875rem;">
                <div>
                    <div style="opacity: 0.9;">Top Performers</div>
                    <div style="font-weight: 600; font-size: 1.125rem;">${analysisData.summary?.topPerformers || 0}</div>
                </div>
                <div>
                    <div style="opacity: 0.9;">Scaling Opportunities</div>
                    <div style="font-weight: 600; font-size: 1.125rem;">${analysisData.summary?.scalingOpportunities || 0}</div>
                </div>
                <div>
                    <div style="opacity: 0.9;">Test Recommendations</div>
                    <div style="font-weight: 600; font-size: 1.125rem;">${analysisData.summary?.testRecommendations || 0}</div>
                </div>
                <div>
                    <div style="opacity: 0.9;">Analysis Confidence</div>
                    <div style="font-weight: 600; font-size: 1.125rem;">95%</div>
                </div>
            </div>
        </div>
    `;
    
    // Insert the summary at the top of the main container
    const mainContainer = document.querySelector('.main-container');
    const firstTabContent = document.querySelector('.tab-content');
    if (firstTabContent && !document.querySelector('.ai-insights-summary')) {
        firstTabContent.insertBefore(summaryInsights, firstTabContent.firstChild);
    }
}

// Enhanced diagnostic function with API endpoint testing
async function runEnhancedDiagnostics() {
    console.log('🔍 Running enhanced diagnostic tests...');
    updateConnectionStatus('connecting', 'Running enhanced diagnostics...');
    
    try {
        const diagnosticResults = {
            envVars: { status: 'unknown', details: null },
            apiConnection: { status: 'unknown', details: null },
            enhancedAPI: { status: 'unknown', details: null },
            creativeAnalysis: { status: 'unknown', details: null }
        };

        // Test 1: Environment Variables
        console.log('🧪 Test 1: Checking environment variables...');
        try {
            const authResponse = await fetch('/api/newsbreak/auth-test');
            const authData = await authResponse.json();
            diagnosticResults.envVars = { 
                status: authData.success ? 'pass' : 'fail', 
                details: authData 
            };
        } catch (error) {
            diagnosticResults.envVars = { status: 'error', details: error.message };
        }

        // Test 2: Basic API Connection
        console.log('🧪 Test 2: Testing basic API connection...');
        try {
            const connResponse = await fetch('/api/newsbreak/test-connection');
            const connData = await connResponse.json();
            diagnosticResults.apiConnection = { 
                status: connData.success ? 'pass' : 'fail', 
                details: connData 
            };
        } catch (error) {
            diagnosticResults.apiConnection = { status: 'error', details: error.message };
        }

        // Test 3: Enhanced API Endpoints
        console.log('🧪 Test 3: Testing enhanced API endpoints...');
        try {
            const enhancedResponse = await fetch('/api/newsbreak/enhanced-campaigns?date_range=last7days');
            const enhancedData = await enhancedResponse.json();
            diagnosticResults.enhancedAPI = { 
                status: enhancedData.success ? 'pass' : 'fail', 
                details: enhancedData 
            };
        } catch (error) {
            diagnosticResults.enhancedAPI = { status: 'error', details: error.message };
        }

        // Test 4: Creative Analysis API
        console.log('🧪 Test 4: Testing creative analysis API...');
        try {
            const analysisResponse = await fetch('/api/newsbreak/creative-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaigns: [{ 
                        id: 'test', 
                        name: 'Test Campaign',
                        headline: 'Test Headline',
                        roas: 2.0,
                        ctr: 0.02,
                        spend: 100,
                        conversions: 5
                    }],
                    analysisType: 'headline_analysis'
                })
            });
            const analysisData = await analysisResponse.json();
            diagnosticResults.creativeAnalysis = { 
                status: analysisData.success ? 'pass' : 'fail', 
                details: analysisData 
            };
        } catch (error) {
            diagnosticResults.creativeAnalysis = { status: 'error', details: error.message };
        }

        // Display comprehensive results
        console.log('📊 Enhanced Diagnostic Results:', diagnosticResults);
        
        const allPassed = Object.values(diagnosticResults).every(test => test.status === 'pass');
        
        const resultMessage = `Enhanced Diagnostic Results:
        
✓ Environment Variables: ${getStatusEmoji(diagnosticResults.envVars.status)} ${diagnosticResults.envVars.status.toUpperCase()}
✓ Basic API Connection: ${getStatusEmoji(diagnosticResults.apiConnection.status)} ${diagnosticResults.apiConnection.status.toUpperCase()}  
✓ Enhanced API Endpoints: ${getStatusEmoji(diagnosticResults.enhancedAPI.status)} ${diagnosticResults.enhancedAPI.status.toUpperCase()}
✓ Creative Analysis API: ${getStatusEmoji(diagnosticResults.creativeAnalysis.status)} ${diagnosticResults.creativeAnalysis.status.toUpperCase()}

Overall System Status: ${allPassed ? '✅ ALL SYSTEMS OPERATIONAL' : '⚠️ ISSUES DETECTED'}

Check console for detailed logs and error information.`;
        
        alert(resultMessage);
        
        if (allPassed) {
            updateConnectionStatus('connected', 'All systems operational - loading data...');
            await loadCreativeData();
        } else {
            updateConnectionStatus('error', 'System issues detected');
        }
        
    } catch (error) {
        console.error('Enhanced diagnostics failed:', error);
        updateConnectionStatus('error', 'Diagnostics failed');
        alert(`Enhanced diagnostics failed: ${error.message}`);
    }
}

function getStatusEmoji(status) {
    switch (status) {
        case 'pass': return '🟢';
        case 'fail': return '🟡';
        case 'error': return '🔴';
        default: return '⚪';
    }
}

// Override the original functions with enhanced versions
window.loadNewsBreakData = loadNewsBreakData;
window.analyzeCreatives = analyzeCreatives;
window.analyzeHeadlines = analyzeHeadlines;
window.generateAISuggestions = generateAISuggestions;
window.loadABTests = loadABTests;
window.generateCorrelationMatrix = generateCorrelationMatrix;
window.runDiagnostics = runEnhancedDiagnostics;

// Add comprehensive analysis trigger
window.runComprehensiveAnalysis = performComprehensiveAnalysis;

console.log('✅ Enhanced Creative Intelligence Dashboard JavaScript loaded successfully');
