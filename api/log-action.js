// api/log-action.js - Log creative actions for lifecycle tracking
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

    console.log('=== ACTION LOGGING API CALLED ===');
    console.log('Body:', req.body);

    const { creativeId, actionType, reason, metrics } = req.body;

    if (!creativeId || !actionType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: creativeId and actionType'
      });
    }

    // In a real implementation, you would store this in a database
    // For now, we'll just log it and return success
    const actionLog = {
      id: `action_${Date.now()}`,
      creativeId,
      actionType,
      reason: reason || `${actionType} by user`,
      metrics: metrics || {},
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'] || 'Unknown'
    };

    console.log('Action logged:', actionLog);

    // You could store this in a database here:
    // await database.actions.create(actionLog);

    res.json({
      success: true,
      actionId: actionLog.id,
      message: `Action '${actionType}' logged for creative '${creativeId}'`
    });

  } catch (error) {
    console.error('Action logging error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error occurred',
      timestamp: new Date().toISOString()
    });
  }
}