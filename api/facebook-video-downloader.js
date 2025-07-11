<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Facebook Video Downloader & Analyzer</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .method-card { transition: all 0.3s ease; }
        .method-card:hover { transform: translateY(-2px); }
        .success { background-color: #10b981; }
        .warning { background-color: #f59e0b; }
        .error { background-color: #ef4444; }
        .loading { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    </style>
</head>
<body class="bg-gray-50">
    <div class="container mx-auto px-4 py-8">
        <!-- Header -->
        <div class="mb-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">🎬 Facebook Video Downloader & Analyzer</h1>
            <p class="text-gray-600">Extract and analyze your Facebook ad videos using various methods</p>
        </div>

        <!-- Creative Selection -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">Step 1: Select Video Creative</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Choose Creative</label>
                    <select id="creativeSelect" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                        <option value="">Select a video creative...</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Download Method</label>
                    <select id="methodSelect" class="w-full px-4 py-2 border border-gray-300 rounded-lg">
                        <option value="api_fallback">API + Fallback Methods</option>
                        <option value="devtools">Browser DevTools</option>
                        <option value="automation">Browser Automation</option>
                        <option value="manual">Manual Extraction</option>
                    </select>
                </div>
            </div>

            <button id="extractBtn" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300" disabled>
                🔍 Extract Video URLs
            </button>
        </div>

        <!-- Results Section -->
        <div id="resultsSection" class="hidden space-y-6">
            <!-- Success Results -->
            <div id="successResults" class="hidden bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 class="text-lg font-semibold text-green-600 mb-4">✅ Video URLs Found!</h3>
                <div id="videoUrls" class="space-y-4">
                    <!-- Video URLs will be inserted here -->
                </div>
                <div class="mt-6 flex gap-4">
                    <button id="downloadAllBtn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                        📥 Download All Videos
                    </button>
                    <button id="analyzeAllBtn" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                        🤖 Analyze All Videos
                    </button>
                </div>
            </div>

            <!-- Manual Instructions -->
            <div id="manualInstructions" class="hidden bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 class="text-lg font-semibold text-orange-600 mb-4">🛠️ Manual Extraction Required</h3>
                <div id="methodCards" class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <!-- Method cards will be inserted here -->
                </div>
            </div>
        </div>

        <!-- Browser DevTools Guide -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">🔧 Quick DevTools Method</h2>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 class="font-semibold text-blue-900 mb-2">Step-by-Step Instructions:</h3>
                <ol class="list-decimal list-inside space-y-2 text-blue-800">
                    <li>Open Facebook Ads Manager and find your video creative</li>
                    <li>Click "Preview" on the creative</li>
                    <li>Press F12 to open Developer Tools</li>
                    <li>Go to the "Network" tab</li>
                    <li>Filter by "Media" or type "mp4" in the filter</li>
                    <li>Play the video in the preview</li>
                    <li>Look for .mp4 URLs in the network requests</li>
                    <li>Right-click the video URL and copy link</li>
                    <li>Paste the URL below for analysis</li>
                </ol>
            </div>
            
            <div class="flex gap-4">
                <input 
                    type="url" 
                    id="manualVideoUrl" 
                    placeholder="Paste video URL here..."
                    class="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                >
                <button id="analyzeManualBtn" class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                    🤖 Analyze This Video
                </button>
            </div>
        </div>

        <!-- Automation Script Generator -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">🤖 Browser Automation Script</h2>
            <p class="text-gray-600 mb-4">Generate a Puppeteer script to automatically download your Facebook videos</p>
            
            <div class="bg-gray-800 text-green-400 p-4 rounded-lg text-sm font-mono overflow-x-auto mb-4">
                <pre id="automationScript">
// npm install puppeteer
const puppeteer = require('puppeteer');

async function downloadFacebookVideos() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    
    // Login to Facebook (you'll need to handle this)
    await page.goto('https://business.facebook.com/adsmanager');
    
    // Wait for manual login
    console.log('Please login manually, then press Enter...');
    await new Promise(resolve => process.stdin.once('data', resolve));
    
    // Navigate to your creative
    const creativeId = 'YOUR_CREATIVE_ID_HERE';
    await page.goto(`https://business.facebook.com/adsmanager/manage/ads/creative/${creativeId}`);
    
    // Intercept video requests
    const videoUrls = [];
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('.mp4') || url.includes('video')) {
            console.log('Found video URL:', url);
            videoUrls.push(url);
        }
    });
    
    // Click preview and wait for video to load
    await page.click('[data-testid="preview-button"]');
    await page.waitForTimeout(5000);
    
    console.log('Found videos:', videoUrls);
    await browser.close();
}

downloadFacebookVideos();
                </pre>
            </div>
            
            <button id="copyScriptBtn" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                📋 Copy Script
            </button>
        </div>

        <!-- Analysis Results -->
        <div id="analysisResults" class="hidden bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-4">📊 Video Analysis Results</h2>
            <div id="analysisContent">
                <!-- Analysis results will be inserted here -->
            </div>
        </div>
    </div>

    <script>
        let creatives = [];
        let currentVideoUrls = [];

        // Load creatives on page load
        window.addEventListener('load', async function() {
            await loadCreatives();
        });

        async function loadCreatives() {
            try {
                const response = await fetch('/api/creatives');
                creatives = await response.json();
                
                const select = document.getElementById('creativeSelect');
                select.innerHTML = '<option value="">Select a video creative...</option>';
                
                const videoCreatives = creatives.filter(c => {
                    const type = c.type || 'unknown';
                    return type === 'video' || c.video_id || c.video_url;
                });
                
                videoCreatives.forEach(creative => {
                    const option = document.createElement('option');
                    option.value = creative.id;
                    option.textContent = creative.name || `Creative ${creative.id}`;
                    select.appendChild(option);
                });
                
                // Enable extract button when creative is selected
                select.addEventListener('change', function() {
                    document.getElementById('extractBtn').disabled = !this.value;
                });
                
            } catch (error) {
                console.error('Failed to load creatives:', error);
            }
        }

        // Extract video URLs
        document.getElementById('extractBtn').addEventListener('click', async function() {
            const creativeId = document.getElementById('creativeSelect').value;
            const method = document.getElementById('methodSelect').value;
            
            if (!creativeId) return;
            
            this.disabled = true;
            this.innerHTML = '<div class="loading inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>Extracting...';
            
            try {
                const response = await fetch('/api/facebook-video-downloader', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ creative_id: creativeId, method })
                });
                
                const result = await response.json();
                displayResults(result);
                
            } catch (error) {
                console.error('Extraction failed:', error);
                alert('Video extraction failed. Try the manual method.');
            } finally {
                this.disabled = false;
                this.innerHTML = '🔍 Extract Video URLs';
            }
        });

        function displayResults(result) {
            const resultsSection = document.getElementById('resultsSection');
            const successResults = document.getElementById('successResults');
            const manualInstructions = document.getElementById('manualInstructions');
            
            resultsSection.classList.remove('hidden');
            
            if (result.success && result.video_urls) {
                // Show successful results
                successResults.classList.remove('hidden');
                manualInstructions.classList.add('hidden');
                
                displayVideoUrls(result.video_urls);
                currentVideoUrls = result.video_urls;
                
            } else {
                // Show manual instructions
                successResults.classList.add('hidden');
                manualInstructions.classList.remove('hidden');
                
                displayWorkarounds(result.workarounds || []);
            }
        }

        function displayVideoUrls(videoUrls) {
            const container = document.getElementById('videoUrls');
            container.innerHTML = '';
            
            videoUrls.forEach((video, index) => {
                const videoDiv = document.createElement('div');
                videoDiv.className = 'border border-gray-200 rounded-lg p-4';
                videoDiv.innerHTML = `
                    <div class="flex justify-between items-center mb-2">
                        <h4 class="font-semibold">Video ${index + 1}</h4>
                        <span class="text-sm text-gray-500">${video.quality || 'Unknown quality'}</span>
                    </div>
                    <div class="text-sm text-gray-600 mb-2">
                        <strong>URL:</strong> <code class="bg-gray-100 px-2 py-1 rounded">${video.url}</code>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="downloadVideo('${video.url}', ${index})" 
                                class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                            📥 Download
                        </button>
                        <button onclick="analyzeVideo('${video.url}', ${index})" 
                                class="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700">
                            🤖 Analyze
                        </button>
                        <button onclick="copyUrl('${video.url}')" 
                                class="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700">
                            📋 Copy URL
                        </button>
                    </div>
                `;
                container.appendChild(videoDiv);
            });
        }

        function displayWorkarounds(workarounds) {
            const container = document.getElementById('methodCards');
            container.innerHTML = '';
            
            workarounds.forEach(workaround => {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'method-card border border-gray-200 rounded-lg p-4';
                
                const difficultyColor = workaround.difficulty === 'Easy' ? 'text-green-600' : 
                                       workaround.difficulty === 'Medium' ? 'text-orange-600' : 'text-red-600';
                
                cardDiv.innerHTML = `
                    <h4 class="font-semibold text-gray-900 mb-2">${workaround.method}</h4>
                    <div class="text-sm text-gray-600 mb-2">
                        <span class="${difficultyColor}">Difficulty: ${workaround.difficulty}</span> | 
                        <span>Success Rate: ${workaround.success_rate}</span>
                    </div>
                    <ol class="list-decimal list-inside text-sm text-gray-700 space-y-1">
                        ${workaround.steps.map(step => `<li>${step}</li>`).join('')}
                    </ol>
                `;
                container.appendChild(cardDiv);
            });
        }

        // Helper functions
        function downloadVideo(url, index) {
            const a = document.createElement('a');
            a.href = url;
            a.download = `facebook_video_${index + 1}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }

        function analyzeVideo(url, index) {
            // Implement video analysis
            console.log('Analyzing video:', url);
            alert(`Video analysis feature coming soon! URL: ${url}`);
        }

        function copyUrl(url) {
            navigator.clipboard.writeText(url).then(() => {
                alert('URL copied to clipboard!');
            });
        }

        // Manual video analysis
        document.getElementById('analyzeManualBtn').addEventListener('click', function() {
            const videoUrl = document.getElementById('manualVideoUrl').value;
            if (videoUrl) {
                analyzeVideo(videoUrl, 'manual');
            } else {
                alert('Please enter a video URL first');
            }
        });

        // Copy automation script
        document.getElementById('copyScriptBtn').addEventListener('click', function() {
            const script = document.getElementById('automationScript').textContent;
            navigator.clipboard.writeText(script).then(() => {
                alert('Script copied to clipboard!');
            });
        });
    </script>
</body>
</html>
