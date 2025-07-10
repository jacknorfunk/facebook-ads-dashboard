<!-- Add this to your dashboard after the Creative Analysis tab content -->

<!-- Video Hook Analysis Tab Content -->
<div id="videoAnalysisContent" class="tab-content hidden">
    <!-- Video Performance Summary -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm font-medium text-gray-600">Hook Rate</p>
                    <p class="text-2xl font-bold text-gray-900" id="videoHookRate">0.0%</p>
                    <p class="text-sm text-gray-500" id="videoHookGrade">Grade: -</p>
                </div>
                <div class="text-red-500 text-3xl">🎣</div>
            </div>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm font-medium text-gray-600">25% Retention</p>
                    <p class="text-2xl font-bold text-gray-900" id="videoRetention25">0.0%</p>
                    <p class="text-sm text-gray-500" id="videoRetentionGrade">Grade: -</p>
                </div>
                <div class="text-orange-500 text-3xl">📊</div>
            </div>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm font-medium text-gray-600">Completion Rate</p>
                    <p class="text-2xl font-bold text-gray-900" id="videoCompletion">0.0%</p>
                    <p class="text-sm text-gray-500" id="videoCompletionGrade">Grade: -</p>
                </div>
                <div class="text-green-500 text-3xl">✅</div>
            </div>
        </div>
        
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-sm font-medium text-gray-600">Overall Score</p>
                    <p class="text-2xl font-bold text-gray-900" id="videoOverallScore">0</p>
                    <p class="text-sm text-gray-500">out of 100</p>
                </div>
                <div class="text-purple-500 text-3xl">🏆</div>
            </div>
        </div>
    </div>

    <!-- Video Selection -->
    <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Select Video for Analysis</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="videoSelector">
            <!-- Video selection cards will be inserted here -->
        </div>
    </div>

    <!-- Hook Timeline Analysis -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Retention Curve -->
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Retention Timeline</h3>
            <div class="relative h-64" id="retentionChart">
                <!-- Retention chart will be drawn here -->
                <canvas id="retentionCanvas" width="400" height="200" class="w-full h-full"></canvas>
            </div>
        </div>

        <!-- Performance Breakdown -->
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Hook Performance Breakdown</h3>
            <div class="space-y-4" id="hookBreakdown">
                <!-- Hook breakdown items will be inserted here -->
            </div>
        </div>
    </div>

    <!-- Video Element Analysis -->
    <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Video Element Performance</h3>
        <div class="overflow-x-auto">
            <table class="w-full">
                <thead>
                    <tr class="border-b border-gray-200">
                        <th class="text-left py-3 px-4 font-medium text-gray-700">Element</th>
                        <th class="text-left py-3 px-4 font-medium text-gray-700">Timestamp</th>
                        <th class="text-left py-3 px-4 font-medium text-gray-700">Impact</th>
                        <th class="text-left py-3 px-4 font-medium text-gray-700">Insight</th>
                    </tr>
                </thead>
                <tbody id="elementAnalysisTable">
                    <!-- Element analysis rows will be inserted here -->
                </tbody>
            </table>
        </div>
    </div>

    <!-- Optimization Recommendations -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- What's Working in This Video -->
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div class="flex items-center gap-2 mb-4">
                <span class="text-green-500 text-xl">🎯</span>
                <h3 class="text-lg font-semibold text-gray-900">What's Working</h3>
            </div>
            <div id="videoWhatsWorking" class="space-y-3">
                <p class="text-gray-500">Select a video to see analysis...</p>
            </div>
        </div>

        <!-- Optimization Opportunities -->
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div class="flex items-center gap-2 mb-4">
                <span class="text-blue-500 text-xl">💡</span>
                <h3 class="text-lg font-semibold text-gray-900">Optimization Tips</h3>
            </div>
            <div id="videoOptimizationTips" class="space-y-3">
                <p class="text-gray-500">Select a video to see recommendations...</p>
            </div>
        </div>
    </div>
</div>

<script>
// Add this JavaScript to your existing dashboard script

let videoAnalysisData = null;

// Add video analysis tab to existing tab functionality
function addVideoAnalysisTab() {
    // Add tab button after creative analysis tab
    const creativesTab = document.getElementById('creativesTab');
    const videoTab = document.createElement('button');
    videoTab.id = 'videoAnalysisTab';
    videoTab.className = 'tab-button text-gray-500 hover:text-gray-700 px-4 py-2 rounded-md text-sm font-medium';
    videoTab.textContent = 'Video Hook Analysis';
    creativesTab.parentNode.insertBefore(videoTab, creativesTab.nextSibling);
    
    // Add event listener
    videoTab.addEventListener('click', () => switchTab('videoAnalysis'));
}

// Update switchTab function to include video analysis
const originalSwitchTab = switchTab;
function switchTab(tabName) {
    // Call original function
    originalSwitchTab(tabName);
    
    // Handle video analysis tab
    if (tabName === 'videoAnalysis') {
        document.getElementById('videoAnalysisContent').classList.remove('hidden');
        document.getElementById('videoAnalysisTab').classList.add('bg-white', 'text-blue-600');
        document.getElementById('videoAnalysisTab').classList.remove('text-gray-500', 'hover:text-gray-700');
        
        // Load video analysis if not already loaded
        if (!videoAnalysisData) {
            loadVideoAnalysis();
        }
    }
}

async function fetchVideoAnalysis(adId) {
    const response = await fetch(`${API_BASE}/api/video-analysis?ad_id=${adId}`);
    if (!response.ok) throw new Error('Failed to fetch video analysis');
    return response.json();
}

function loadVideoAnalysis() {
    // Create video selector from existing creatives
    const videoSelector = document.getElementById('videoSelector');
    videoSelector.innerHTML = '';
    
    const videoCreatives = creatives.filter(c => c.creative_type === 'video');
    
    if (videoCreatives.length === 0) {
        videoSelector.innerHTML = '<p class="text-gray-500 col-span-3">No video creatives found. Make sure you have video ads in your selected date range.</p>';
        return;
    }
    
    videoCreatives.forEach(creative => {
        const card = document.createElement('div');
        card.className = 'border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors';
        card.onclick = () => analyzeSpecificVideo(creative.id);
        
        card.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <h4 class="font-medium text-sm text-gray-900 truncate">${creative.name}</h4>
                <span class="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">Video</span>
            </div>
            <div class="text-xs text-gray-600 space-y-1">
                <div>CTR: ${creative.ctr.toFixed(2)}%</div>
                <div>Hook Rate: ${creative.hook_rate.toFixed(1)}%</div>
                <div>Performance: ${creative.performance_score.toFixed(0)}/100</div>
            </div>
        `;
        
        videoSelector.appendChild(card);
    });
}

async function analyzeSpecificVideo(adId) {
    try {
        // Show loading state
        document.getElementById('videoHookRate').textContent = 'Loading...';
        document.getElementById('videoRetention25').textContent = 'Loading...';
        document.getElementById('videoCompletion').textContent = 'Loading...';
        document.getElementById('videoOverallScore').textContent = 'Loading...';
        
        // Fetch video analysis
        videoAnalysisData = await fetchVideoAnalysis(adId);
        
        // Update summary cards
        document.getElementById('videoHookRate').textContent = `${videoAnalysisData.hook_analysis.initial_hook.toFixed(1)}%`;
        document.getElementById('videoHookGrade').textContent = `Grade: ${videoAnalysisData.performance_grades.hook}`;
        document.getElementById('videoRetention25').textContent = `${videoAnalysisData.hook_analysis.retention_25pct.toFixed(1)}%`;
        document.getElementById('videoRetentionGrade').textContent = `Grade: ${videoAnalysisData.performance_grades.retention}`;
        document.getElementById('videoCompletion').textContent = `${videoAnalysisData.hook_analysis.completion_rate.toFixed(1)}%`;
        document.getElementById('videoCompletionGrade').textContent = `Grade: ${videoAnalysisData.performance_grades.completion}`;
        document.getElementById('videoOverallScore').textContent = videoAnalysisData.overall_score;
        
        // Draw retention chart
        drawRetentionChart(videoAnalysisData.hook_analysis);
        
        // Update hook breakdown
        updateHookBreakdown(videoAnalysisData.hook_analysis);
        
        // Update element analysis table
        updateElementAnalysisTable(videoAnalysisData.element_performance);
        
        // Update insights and tips
        updateVideoInsights(videoAnalysisData.insights, videoAnalysisData.optimization_tips);
        
    } catch (error) {
        console.error('Error analyzing video:', error);
        document.getElementById('videoHookRate').textContent = 'Error';
        document.getElementById('videoRetention25').textContent = 'Error';
        document.getElementById('videoCompletion').textContent = 'Error';
        document.getElementById('videoOverallScore').textContent = 'Error';
    }
}

function drawRetentionChart(hookAnalysis) {
    const canvas = document.getElementById('retentionCanvas');
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set up chart dimensions
    const padding = 40;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    
    // Data points for retention curve
    const dataPoints = [
        { x: 0, y: 100, label: 'Start' },
        { x: 0.03, y: hookAnalysis.initial_hook, label: '3sec Hook' },
        { x: 0.25, y: hookAnalysis.retention_25pct, label: '25%' },
        { x: 0.5, y: hookAnalysis.retention_50pct, label: '50%' },
        { x: 0.75, y: hookAnalysis.retention_75pct, label: '75%' },
        { x: 1.0, y: hookAnalysis.completion_rate, label: 'End' }
    ];
    
    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + chartHeight);
    ctx.stroke();
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding, padding + chartHeight);
    ctx.lineTo(padding + chartWidth, padding + chartHeight);
    ctx.stroke();
    
    // Draw retention curve
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    dataPoints.forEach((point, index) => {
        const x = padding + (point.x * chartWidth);
        const y = padding + ((100 - point.y) / 100 * chartHeight);
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();
    
    // Draw data points
    ctx.fillStyle = '#3b82f6';
    dataPoints.forEach(point => {
        const x = padding + (point.x * chartWidth);
        const y = padding + ((100 - point.y) / 100 * chartHeight);
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    // Add labels
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    dataPoints.forEach(point => {
        const x = padding + (point.x * chartWidth);
        const y = padding + ((100 - point.y) / 100 * chartHeight);
        
        ctx.fillText(`${point.y.toFixed(0)}%`, x, y - 10);
        ctx.fillText(point.label, x, padding + chartHeight + 20);
    });
}

function updateHookBreakdown(hookAnalysis) {
    const breakdown = document.getElementById('hookBreakdown');
    breakdown.innerHTML = '';
    
    const metrics = [
        { label: 'Initial Hook (0-3s)', value: hookAnalysis.initial_hook, benchmark: 'Above 10% is good' },
        { label: 'Early Retention (25%)', value: hookAnalysis.retention_25pct, benchmark: 'Above 60% is good' },
        { label: 'Mid Retention (50%)', value: hookAnalysis.retention_50pct, benchmark: 'Above 40% is good' },
        { label: 'Completion Rate', value: hookAnalysis.completion_rate, benchmark: 'Above 25% is good' }
    ];
    
    metrics.forEach(metric => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
        
        const isGood = metric.value >= parseFloat(metric.benchmark.match(/\d+/)[0]);
        const color = isGood ? 'text-green-600' : 'text-orange-600';
        
        item.innerHTML = `
            <div>
                <div class="font-medium text-gray-900">${metric.label}</div>
                <div class="text-sm text-gray-600">${metric.benchmark}</div>
            </div>
            <div class="text-xl font-bold ${color}">${metric.value.toFixed(1)}%</div>
        `;
        
        breakdown.appendChild(item);
    });
}

function updateElementAnalysisTable(elementPerformance) {
    const table = document.getElementById('elementAnalysisTable');
    table.innerHTML = '';
    
    elementPerformance.forEach(element => {
        const row = document.createElement('tr');
        row.className = 'border-b border-gray-100';
        
        const impactColor = element.performance_impact === 'positive' ? 'text-green-600 bg-green-50' :
                           element.performance_impact === 'negative' ? 'text-red-600 bg-red-50' :
                           'text-yellow-600 bg-yellow-50';
        
        row.innerHTML = `
            <td class="py-3 px-4 font-medium text-gray-900">${element.element}</td>
            <td class="py-3 px-4 text-gray-600">${element.timestamp}s</td>
            <td class="py-3 px-4">
                <span class="px-2 py-1 rounded-full text-xs font-medium ${impactColor}">
                    ${element.performance_impact}
                </span>
            </td>
            <td class="py-3 px-4 text-sm text-gray-600">${element.insight}</td>
        `;
        
        table.appendChild(row);
    });
}

function updateVideoInsights(insights, optimizationTips) {
    // Update what's working
    const whatsWorking = document.getElementById('videoWhatsWorking');
    const successInsights = insights.filter(insight => insight.type === 'success');
    
    if (successInsights.length === 0) {
        whatsWorking.innerHTML = '<p class="text-gray-500">No standout elements identified in this video.</p>';
    } else {
        whatsWorking.innerHTML = successInsights.map(insight => `
            <div class="p-3 bg-green-50 rounded-lg">
                <p class="text-sm font-medium text-green-800">${insight.category.charAt(0).toUpperCase() + insight.category.slice(1)}</p>
                <p class="text-xs text-green-600">${insight.message}</p>
                ${insight.recommendation ? `<p class="text-xs text-green-700 mt-1"><strong>Action:</strong> ${insight.recommendation}</p>` : ''}
            </div>
        `).join('');
    }
    
    // Update optimization tips
    const optimizationDiv = document.getElementById('videoOptimizationTips');
    
    if (optimizationTips.length === 0) {
        optimizationDiv.innerHTML = '<p class="text-gray-500">This video is performing well across all metrics!</p>';
    } else {
        optimizationDiv.innerHTML = optimizationTips.map(tip => `
            <div class="p-3 bg-blue-50 rounded-lg">
                <div class="flex items-center gap-2 mb-1">
                    <span class="px-2 py-1 text-xs font-medium ${tip.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'} rounded">
                        ${tip.priority} priority
                    </span>
                    <p class="text-sm font-medium text-blue-800">${tip.tip}</p>
                </div>
                <p class="text-xs text-blue-600">Examples: ${tip.examples.join(', ')}</p>
            </div>
        `).join('');
    }
}

// Initialize video analysis tab when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Add a delay to ensure other elements are loaded first
    setTimeout(addVideoAnalysisTab, 1000);
});
</script>
