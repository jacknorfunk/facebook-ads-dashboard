// api/facebook-diagnostic.js - Facebook API Connection Diagnostic Tool
export default async function handler(req, res) {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    const adAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID;

    console.log('=== FACEBOOK API DIAGNOSTIC ===');
    console.log('Access Token exists:', !!accessToken);
    console.log('Access Token length:', accessToken ? accessToken.length : 0);
    console.log('Ad Account ID:', adAccountId);

    if (!accessToken) {
      return res.status(400).json({
        error: 'No Facebook access token found',
        solution: 'Set FACEBOOK_ACCESS_TOKEN in your environment variables',
        status: 'MISSING_TOKEN'
      });
    }

    if (!adAccountId) {
      return res.status(400).json({
        error: 'No Facebook ad account ID found', 
        solution: 'Set FACEBOOK_AD_ACCOUNT_ID in your environment variables',
        status: 'MISSING_ACCOUNT_ID'
      });
    }

    const diagnosticResults = {
      timestamp: new Date().toISOString(),
      environment: {
        accessToken: accessToken ? `${accessToken.substring(0, 10)}...` : 'MISSING',
        adAccountId: adAccountId || 'MISSING'
      },
      tests: []
    };

    // Test 1: Token validation
    console.log('Testing access token validation...');
    try {
      const tokenResponse = await fetch(
        `https://graph.facebook.com/me?access_token=${accessToken}`
      );
      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        diagnosticResults.tests.push({
          test: 'Access Token Validation',
          status: 'FAILED',
          error: tokenData.error.message,
          code: tokenData.error.code,
          solution: getTokenErrorSolution(tokenData.error.code)
        });
      } else {
        diagnosticResults.tests.push({
          test: 'Access Token Validation',
          status: 'PASSED',
          user: tokenData.name,
          id: tokenData.id
        });
      }
    } catch (error) {
      diagnosticResults.tests.push({
        test: 'Access Token Validation', 
        status: 'ERROR',
        error: error.message
      });
    }

    // Test 2: Ad Account access
    console.log('Testing ad account access...');
    try {
      const accountResponse = await fetch(
        `https://graph.facebook.com/v19.0/act_${adAccountId}?access_token=${accessToken}`
      );
      const accountData = await accountResponse.json();
      
      if (accountData.error) {
        diagnosticResults.tests.push({
          test: 'Ad Account Access',
          status: 'FAILED',
          error: accountData.error.message,
          code: accountData.error.code,
          solution: getAccountErrorSolution(accountData.error.code)
        });
      } else {
        diagnosticResults.tests.push({
          test: 'Ad Account Access',
          status: 'PASSED',
          account_name: accountData.name,
          account_id: accountData.account_id,
          currency: accountData.currency
        });
      }
    } catch (error) {
      diagnosticResults.tests.push({
        test: 'Ad Account Access',
        status: 'ERROR', 
        error: error.message
      });
    }

    // Test 3: Campaigns endpoint
    console.log('Testing campaigns endpoint...');
    try {
      const campaignsResponse = await fetch(
        `https://graph.facebook.com/v19.0/act_${adAccountId}/campaigns?fields=id,name,status,objective&access_token=${accessToken}`
      );
      const campaignsData = await campaignsResponse.json();
      
      if (campaignsData.error) {
        diagnosticResults.tests.push({
          test: 'Campaigns Endpoint',
          status: 'FAILED',
          error: campaignsData.error.message,
          code: campaignsData.error.code
        });
      } else {
        diagnosticResults.tests.push({
          test: 'Campaigns Endpoint',
          status: 'PASSED',
          campaigns_found: campaignsData.data ? campaignsData.data.length : 0,
          sample_campaign: campaignsData.data && campaignsData.data.length > 0 ? 
            campaignsData.data[0].name : 'No campaigns found'
        });
      }
    } catch (error) {
      diagnosticResults.tests.push({
        test: 'Campaigns Endpoint',
        status: 'ERROR',
        error: error.message
      });
    }

    // Test 4: Insights endpoint (this is often where the issue is)
    console.log('Testing insights endpoint...');
    try {
      const insightsResponse = await fetch(
        `https://graph.facebook.com/v19.0/act_${adAccountId}/insights?fields=spend,impressions,clicks&date_preset=last_30d&access_token=${accessToken}`
      );
      const insightsData = await insightsResponse.json();
      
      if (insightsData.error) {
        diagnosticResults.tests.push({
          test: 'Insights Endpoint',
          status: 'FAILED',
          error: insightsData.error.message,
          code: insightsData.error.code,
          solution: getInsightsErrorSolution(insightsData.error.code)
        });
      } else {
        diagnosticResults.tests.push({
          test: 'Insights Endpoint',
          status: 'PASSED',
          insights_found: insightsData.data ? insightsData.data.length : 0,
          sample_data: insightsData.data && insightsData.data.length > 0 ? 
            insightsData.data[0] : 'No insights data found'
        });
      }
    } catch (error) {
      diagnosticResults.tests.push({
        test: 'Insights Endpoint',
        status: 'ERROR',
        error: error.message
      });
    }

    // Test 5: Permissions check
    console.log('Testing permissions...');
    try {
      const permissionsResponse = await fetch(
        `https://graph.facebook.com/me/permissions?access_token=${accessToken}`
      );
      const permissionsData = await permissionsResponse.json();
      
      if (permissionsData.error) {
        diagnosticResults.tests.push({
          test: 'Permissions Check',
          status: 'FAILED',
          error: permissionsData.error.message
        });
      } else {
        const grantedPermissions = permissionsData.data ? 
          permissionsData.data.filter(p => p.status === 'granted').map(p => p.permission) : [];
        
        const requiredPermissions = ['ads_read', 'read_insights', 'ads_management'];
        const missingPermissions = requiredPermissions.filter(p => !grantedPermissions.includes(p));
        
        diagnosticResults.tests.push({
          test: 'Permissions Check',
          status: missingPermissions.length === 0 ? 'PASSED' : 'FAILED',
          granted_permissions: grantedPermissions,
          missing_permissions: missingPermissions,
          solution: missingPermissions.length > 0 ? 
            `Request these permissions: ${missingPermissions.join(', ')}` : null
        });
      }
    } catch (error) {
      diagnosticResults.tests.push({
        test: 'Permissions Check',
        status: 'ERROR',
        error: error.message
      });
    }

    // Generate overall diagnosis
    const failedTests = diagnosticResults.tests.filter(t => t.status === 'FAILED' || t.status === 'ERROR');
    diagnosticResults.overall_status = failedTests.length === 0 ? 'HEALTHY' : 'ISSUES_FOUND';
    diagnosticResults.summary = generateSummary(diagnosticResults.tests);

    console.log('=== DIAGNOSTIC COMPLETE ===');
    console.log('Overall Status:', diagnosticResults.overall_status);
    console.log('Failed Tests:', failedTests.length);

    res.status(200).json(diagnosticResults);

  } catch (error) {
    console.error('Diagnostic Error:', error);
    res.status(500).json({
      error: 'Diagnostic failed',
      details: error.message
    });
  }
}

function getTokenErrorSolution(errorCode) {
  switch (errorCode) {
    case 190:
      return 'Access token expired or invalid. Generate a new long-lived token.';
    case 102:
      return 'Invalid API key. Check your app configuration.';
    case 10:
      return 'Permission denied. Ensure you have proper app permissions.';
    default:
      return 'Check your access token and app configuration.';
  }
}

function getAccountErrorSolution(errorCode) {
  switch (errorCode) {
    case 17:
      return 'User request limit reached. Wait before making more requests.';
    case 613:
      return 'Account access denied. Ensure you have admin access to this ad account.';
    case 100:
      return 'Invalid account ID. Verify the ad account ID is correct.';
    default:
      return 'Check ad account permissions and ID.';
  }
}

function getInsightsErrorSolution(errorCode) {
  switch (errorCode) {
    case 100:
      return 'Invalid insights request. Check date range and fields.';
    case 17:
      return 'Rate limited. Reduce request frequency.';
    case 190:
      return 'Token issue affecting insights access.';
    default:
      return 'Review insights API parameters and permissions.';
  }
}

function generateSummary(tests) {
  const passed = tests.filter(t => t.status === 'PASSED').length;
  const failed = tests.filter(t => t.status === 'FAILED').length;
  const errors = tests.filter(t => t.status === 'ERROR').length;
  
  if (failed === 0 && errors === 0) {
    return 'All tests passed! Your Facebook API connection is working correctly.';
  }
  
  if (failed > 0) {
    return `${failed} test(s) failed. Check the failed tests for specific solutions.`;
  }
  
  return `${errors} test(s) had errors. This usually indicates network or configuration issues.`;
}
