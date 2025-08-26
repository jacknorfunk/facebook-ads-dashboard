// /api/voluum/get-timezone-dictionary.js - Fetch Voluum timezone dictionary
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

        // Step 2: Fetch timezone dictionary
        const timezoneResponse = await fetch('https://api.voluum.com/dictionary/timezone', {
            headers: { 
                'cwauth-token': token, 
                'Content-Type': 'application/json' 
            }
        });

        if (!timezoneResponse.ok) {
            return res.status(500).json({
                success: false,
                error: `Failed to fetch timezone dictionary: ${timezoneResponse.status}`
            });
        }

        const timezoneData = await timezoneResponse.json();

        // Step 3: Also get user profile to see current account timezone
        const profileResponse = await fetch('https://api.voluum.com/user/profile', {
            headers: { 
                'cwauth-token': token, 
                'Content-Type': 'application/json' 
            }
        });

        let profileData = null;
        if (profileResponse.ok) {
            profileData = await profileResponse.json();
        }

        // Step 4: Categorize timezones for easier selection
        const categorizedTimezones = {
            common_us: timezoneData.filter(tz => 
                tz.includes('America/New_York') || 
                tz.includes('America/Chicago') || 
                tz.includes('America/Denver') || 
                tz.includes('America/Los_Angeles') ||
                tz.includes('America/Phoenix')
            ),
            utc_variants: timezoneData.filter(tz => 
                tz.includes('UTC') || tz.includes('GMT') || tz === 'Etc/GMT'
            ),
            all_timezones: timezoneData
        };

        return res.json({
            success: true,
            account_profile: profileData ? {
                email: profileData.email || 'Unknown',
                timezone: profileData.timezone || 'Not specified',
                accountId: profileData.accountId || 'Unknown'
            } : 'Could not fetch profile',
            timezone_options: categorizedTimezones,
            total_timezones: timezoneData.length,
            recommendation: {
                note: 'Check your Voluum account settings to see which timezone your account is configured for',
                common_options: [
                    'America/New_York (Eastern Time)',
                    'America/Chicago (Central Time)', 
                    'America/Denver (Mountain Time)',
                    'America/Los_Angeles (Pacific Time)',
                    'UTC (Coordinated Universal Time)',
                    'Etc/GMT (Greenwich Mean Time)'
                ]
            },
            next_steps: [
                '1. Check your Voluum account timezone in Settings',
                '2. Use that timezone in the test-timezone-fix.js endpoint',
                '3. Compare revenue numbers to find the matching timezone'
            ],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Timezone dictionary fetch error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}