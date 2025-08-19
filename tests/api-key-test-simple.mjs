#!/usr/bin/env node

/**
 * Simple API Key Test - Tests what scopes the provided API key actually has
 */

// Mock fetch for Node.js if not available
if (!global.fetch) {
  try {
    const { default: fetch } = await import('node-fetch');
    global.fetch = fetch;
  } catch (error) {
    console.error('❌ node-fetch not found. Please install it: npm install node-fetch');
    process.exit(1);
  }
}

const apiKey = process.argv[2];
if (!apiKey) {
  console.log('Usage: node api-key-test-simple.mjs <api-key>');
  process.exit(1);
}

const baseUrl = 'http://localhost:5173/api/v1';

async function testEndpoint(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, options);
    const result = await response.text();
    
    let jsonResult;
    try {
      jsonResult = JSON.parse(result);
    } catch (e) {
      jsonResult = { error: 'Non-JSON response', content: result.substring(0, 100) + '...' };
    }

    return {
      status: response.status,
      success: response.ok,
      data: jsonResult
    };
  } catch (error) {
    return {
      status: 0,
      success: false,
      data: { error: error.message }
    };
  }
}

console.log('🔑 Testing API Key capabilities...');
console.log(`📍 API Key: ${apiKey.substring(0, 20)}...`);
console.log('='.repeat(60));

// Test different endpoints to see what works
const tests = [
  { name: 'API Keys List', endpoint: '/api-keys', requiredScope: 'api-keys:read' },
  { name: 'System Prompts List', endpoint: '/system-prompts', requiredScope: 'system-prompts:read' },
  { name: 'Structured Outputs List', endpoint: '/structured-outputs', requiredScope: 'structured-outputs:read' },
  { 
    name: 'Create Structured Output', 
    endpoint: '/structured-outputs', 
    method: 'POST',
    data: {
      name: 'Test Schema',
      description: 'Simple test',
      json_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      }
    },
    requiredScope: 'structured-outputs:write'
  }
];

const results = {};

for (const test of tests) {
  console.log(`\n🧪 Testing: ${test.name}`);
  console.log(`📋 Required scope: ${test.requiredScope}`);
  
  const result = await testEndpoint(
    test.endpoint, 
    test.method || 'GET', 
    test.data || null
  );
  
  results[test.name] = result;
  
  if (result.success) {
    console.log(`✅ SUCCESS: ${result.status}`);
    if (test.method === 'GET' && result.data.length !== undefined) {
      console.log(`📊 Returned ${result.data.length} items`);
    }
  } else {
    console.log(`❌ FAILED: ${result.status}`);
    if (result.data.message) {
      console.log(`💬 Error: ${result.data.message}`);
    } else if (result.data.error) {
      console.log(`💬 Error: ${result.data.error}`);
    }
    
    // Show scope information if available
    if (result.data.code === 'INSUFFICIENT_SCOPE') {
      console.log(`🔒 This API key lacks the required scope: ${test.requiredScope}`);
    }
  }
}

console.log('\n' + '='.repeat(60));
console.log('📊 SUMMARY');
console.log('='.repeat(60));

let workingEndpoints = 0;
let totalEndpoints = tests.length;

for (const [testName, result] of Object.entries(results)) {
  const status = result.success ? '✅ WORKS' : '❌ BLOCKED';
  console.log(`${status} ${testName}`);
  if (result.success) workingEndpoints++;
}

console.log(`\n📈 Working: ${workingEndpoints}/${totalEndpoints} endpoints`);

if (workingEndpoints === 0) {
  console.log(`\n💡 RECOMMENDATION:`);
  console.log(`Your API key appears to lack the required scopes for testing.`);
  console.log(`To create a new API key with proper scopes:`);
  console.log(`1. Login to the developer console at /developer`);
  console.log(`2. Go to API Keys section`);
  console.log(`3. Create a new key with these scopes:`);
  console.log(`   - system-prompts:read`);
  console.log(`   - system-prompts:write`);
  console.log(`   - structured-outputs:read`);
  console.log(`   - structured-outputs:write`);
} else if (workingEndpoints < totalEndpoints) {
  console.log(`\n💡 PARTIAL ACCESS:`);
  console.log(`Your API key has access to some endpoints but not others.`);
  console.log(`Consider creating a new key with broader scopes for full testing.`);
} else {
  console.log(`\n🎉 EXCELLENT!`);
  console.log(`Your API key has access to all tested endpoints!`);
}