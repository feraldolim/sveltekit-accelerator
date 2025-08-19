/**
 * Master Test Runner for API Test Suites
 * Runs all API tests with both session and API key authentication
 */

// Import test suites (adjust paths if running from different directory)
// For Node.js environment, uncomment these:
// const { SystemPromptsAPI, SystemPromptsTestSuite } = require('./system-prompts.test.js');
// const { StructuredOutputsAPI, StructuredOutputsTestSuite } = require('./structured-outputs.test.js');

const API_BASE = 'http://localhost:5173/api/v1';

class MasterTestRunner {
  constructor() {
    this.results = {
      sessionAuth: { systemPrompts: null, structuredOutputs: null },
      apiKeyAuth: { systemPrompts: null, structuredOutputs: null }
    };
  }

  async runWithAuth(authType, apiKey = null) {
    console.log(`\n🔧 Running tests with ${authType} authentication`);
    console.log('=' * 60);

    const config = {
      useApiKey: authType === 'API_KEY',
      apiKey: apiKey,
      baseUrl: API_BASE
    };

    const results = {};

    // Run System Prompts Tests
    try {
      console.log(`\n📝 Testing System Prompts API (${authType})`);
      const systemPromptsAPI = new SystemPromptsAPI(config);
      const systemPromptsTestSuite = new SystemPromptsTestSuite(systemPromptsAPI);
      results.systemPrompts = await systemPromptsTestSuite.runAllTests();
    } catch (error) {
      console.error(`System Prompts tests failed: ${error.message}`);
      results.systemPrompts = { passed: 0, failed: 1, error: error.message };
    }

    // Run Structured Outputs Tests
    try {
      console.log(`\n🏗️  Testing Structured Outputs API (${authType})`);
      const structuredOutputsAPI = new StructuredOutputsAPI(config);
      const structuredOutputsTestSuite = new StructuredOutputsTestSuite(structuredOutputsAPI);
      results.structuredOutputs = await structuredOutputsTestSuite.runAllTests();
    } catch (error) {
      console.error(`Structured Outputs tests failed: ${error.message}`);
      results.structuredOutputs = { passed: 0, failed: 1, error: error.message };
    }

    return results;
  }

  async runAllTests(apiKey = null) {
    console.log('🚀 Starting Complete API Test Suite');
    console.log('Testing both System Prompts and Structured Outputs APIs');
    console.log('Testing both Session and API Key authentication methods');
    
    // Test with Session Authentication
    this.results.sessionAuth = await this.runWithAuth('SESSION');

    // Test with API Key Authentication (if API key is provided)
    if (apiKey) {
      this.results.apiKeyAuth = await this.runWithAuth('API_KEY', apiKey);
    } else {
      console.log('\n⚠️  Skipping API Key tests (no API key provided)');
      console.log('To test API key authentication, provide an API key as parameter');
    }

    // Print final summary
    this.printFinalSummary();
    
    return this.results;
  }

  printFinalSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL TEST RESULTS SUMMARY');
    console.log('='.repeat(80));

    let totalPassed = 0;
    let totalFailed = 0;

    // Session Auth Results
    console.log('\n🔐 SESSION AUTHENTICATION:');
    if (this.results.sessionAuth.systemPrompts) {
      const sp = this.results.sessionAuth.systemPrompts;
      console.log(`  📝 System Prompts: ${sp.passed} passed, ${sp.failed} failed`);
      totalPassed += sp.passed;
      totalFailed += sp.failed;
    }
    if (this.results.sessionAuth.structuredOutputs) {
      const so = this.results.sessionAuth.structuredOutputs;
      console.log(`  🏗️  Structured Outputs: ${so.passed} passed, ${so.failed} failed`);
      totalPassed += so.passed;
      totalFailed += so.failed;
    }

    // API Key Auth Results
    if (this.results.apiKeyAuth.systemPrompts || this.results.apiKeyAuth.structuredOutputs) {
      console.log('\n🔑 API KEY AUTHENTICATION:');
      if (this.results.apiKeyAuth.systemPrompts) {
        const sp = this.results.apiKeyAuth.systemPrompts;
        console.log(`  📝 System Prompts: ${sp.passed} passed, ${sp.failed} failed`);
        totalPassed += sp.passed;
        totalFailed += sp.failed;
      }
      if (this.results.apiKeyAuth.structuredOutputs) {
        const so = this.results.apiKeyAuth.structuredOutputs;
        console.log(`  🏗️  Structured Outputs: ${so.passed} passed, ${so.failed} failed`);
        totalPassed += so.passed;
        totalFailed += so.failed;
      }
    }

    // Overall Summary
    console.log('\n' + '-'.repeat(40));
    console.log(`📈 OVERALL RESULTS:`);
    console.log(`   Total Tests: ${totalPassed + totalFailed}`);
    console.log(`   ✅ Passed: ${totalPassed}`);
    console.log(`   ❌ Failed: ${totalFailed}`);
    console.log(`   📊 Success Rate: ${totalPassed + totalFailed > 0 ? ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1) : 0}%`);

    if (totalFailed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! 🎉');
    } else {
      console.log(`\n⚠️  ${totalFailed} test(s) failed. Check logs above for details.`);
    }

    console.log('='.repeat(80));
  }

  // Helper method to create an API key for testing
  async createTestApiKey() {
    console.log('🔑 Creating test API key...');
    
    try {
      const response = await fetch(`${API_BASE}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          name: 'Test API Key',
          scopes: ['system-prompts:read', 'system-prompts:write', 'structured-outputs:read', 'structured-outputs:write'],
          rate_limit: 1000,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Expires in 24 hours
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create API key: ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ Created test API key: ${result.key_prefix}...`);
      return result.api_key; // Full API key
    } catch (error) {
      console.error(`❌ Failed to create test API key: ${error.message}`);
      return null;
    }
  }
}

// Browser-compatible test runner
class BrowserTestRunner extends MasterTestRunner {
  async runInBrowser() {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      throw new Error('BrowserTestRunner can only be used in browser environment');
    }

    console.log('🌐 Running tests in browser environment');
    
    // Try to create a test API key first
    const apiKey = await this.createTestApiKey();
    
    // Run all tests
    return await this.runAllTests(apiKey);
  }
}

// Node.js test runner
class NodeTestRunner extends MasterTestRunner {
  async runInNode(apiKey = null) {
    console.log('📦 Running tests in Node.js environment');
    
    // If no API key provided, try to get from environment
    if (!apiKey && process.env.TEST_API_KEY) {
      apiKey = process.env.TEST_API_KEY;
      console.log('📝 Using API key from TEST_API_KEY environment variable');
    }
    
    return await this.runAllTests(apiKey);
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = { MasterTestRunner, NodeTestRunner, BrowserTestRunner };
  
  // Auto-run if this file is executed directly
  if (require.main === module) {
    const runner = new NodeTestRunner();
    runner.runInNode().catch(console.error);
  }
} else {
  // Browser environment
  window.MasterTestRunner = MasterTestRunner;
  window.BrowserTestRunner = BrowserTestRunner;
  
  // Create a global function to run all tests
  window.runAllAPITests = async function(apiKey = null) {
    const runner = new BrowserTestRunner();
    try {
      return await runner.runAllTests(apiKey);
    } catch (error) {
      console.error('Test execution failed:', error);
      return null;
    }
  };

  window.runBrowserTests = async function() {
    const runner = new BrowserTestRunner();
    try {
      return await runner.runInBrowser();
    } catch (error) {
      console.error('Browser test execution failed:', error);
      return null;
    }
  };
  
  console.log('🌐 API Test Suite loaded in browser');
  console.log('📝 Available functions:');
  console.log('  - window.runAllAPITests(apiKey) - Run all tests with optional API key');
  console.log('  - window.runBrowserTests() - Run all tests and auto-create API key');
}