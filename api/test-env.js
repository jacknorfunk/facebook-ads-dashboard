// api/test-env.js - Test Environment Variables
export default async function handler(req, res) {
    try {
        const VOLUME_KEY_ID = process.env.VOLUME_KEY_ID;
        const VOLUME_KEY = process.env.VOLUME_KEY;
        
        // Get all environment variables that contain "VOLUME"
        const volumeEnvVars = {};
        Object.keys(process.env).forEach(key => {
            if (key.includes('VOLUME')) {
                volumeEnvVars[key] = process.env[key] ? 
                    `${process.env[key].substring(0, 8)}... (length: ${process.env[key].length})` : 
                    'null/undefined';
            }
        });
        
        return res.status(200).json({
            environment: process.env.NODE_ENV,
            vercel_env: process.env.VERCEL_ENV,
            volume_key_id_exists: !!VOLUME_KEY_ID,
            volume_key_exists: !!VOLUME_KEY,
            volume_key_id_preview: VOLUME_KEY_ID ? `${VOLUME_KEY_ID.substring(0, 8)}... (length: ${VOLUME_KEY_ID.length})` : 'null/undefined',
            volume_key_preview: VOLUME_KEY ? `${VOLUME_KEY.substring(0, 8)}... (length: ${VOLUME_KEY.length})` : 'null/undefined',
            all_volume_vars: volumeEnvVars,
            total_env_vars: Object.keys(process.env).length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        return res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
}
