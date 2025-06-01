// Test script for your Dern Support backend API

const BASE_URL = process.env.CLIENT_URL || 'http://localhost:3000';

async function testEndpoint(url, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    console.log(`Testing ${method} ${url}...`);
    const response = await fetch(url, options);
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data, null, 2));
    console.log('---');
    
    return { status: response.status, data };
  } catch (error) {
    console.error(`Error testing ${url}:`, error.message);
    console.log('---');
    return { error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Testing Dern Support Backend API');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('=====================================\n');

  // Test basic API info
  await testEndpoint(`${BASE_URL}/api`);

  // Test health checks
  await testEndpoint(`${BASE_URL}/health`);
  await testEndpoint(`${BASE_URL}/health/live`);
  await testEndpoint(`${BASE_URL}/health/ready`);

  // Test 404 handling
  await testEndpoint(`${BASE_URL}/api/v1/nonexistent`);

  // Test CORS preflight (if needed)
  await testEndpoint(`${BASE_URL}/api/v1/auth/login`, 'OPTIONS');

  console.log('✅ Backend API tests completed!');
  console.log('\nIf all health checks return status 200, your backend is working correctly.');
  console.log('If you see connection errors, make sure:');
  console.log('1. Your backend server is running (npm run dev)');
  console.log('2. MongoDB is running and accessible');
  console.log('3. All environment variables are set correctly');
}

runTests();