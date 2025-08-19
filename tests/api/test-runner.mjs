#!/usr/bin/env node

/**
 * Node.js Test Runner for API Test Suites
 * Usage: node test-runner.mjs [--api-key=your-key] [--base-url=http://localhost:5173]
 */

import fs from 'fs';
import path from 'path';

// Default configuration
const config = {
  baseUrl: 'http://localhost:5173/api/v1',
  apiKey: null,
  sessionCookie: null
};

// Parse command line arguments
process.argv.forEach(arg => {
  if (arg.startsWith('--api-key=')) {
    config.apiKey = arg.split('=')[1];
  }
  if (arg.startsWith('--base-url=')) {
    config.baseUrl = arg.split('=')[1];
  }
});

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

// Inline API classes (since we can't easily import the .js files)
class SystemPromptsAPI {
  constructor(config) {
    this.config = config;
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.config.useApiKey && this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(data.error || data)}`);
    }

    return data;
  }

  async listPrompts(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.category) params.set('category', filters.category);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/system-prompts${query}`);
  }

  async createPrompt(data) {
    return this.request('/system-prompts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getPrompt(id) {
    return this.request(`/system-prompts/${id}`);
  }

  async updatePrompt(id, data) {
    return this.request(`/system-prompts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deletePrompt(id) {
    return this.request(`/system-prompts/${id}`, {
      method: 'DELETE'
    });
  }

  async getPromptVersions(id) {
    return this.request(`/system-prompts/${id}/versions`);
  }

  async restorePromptVersion(id, version, changeSummary) {
    return this.request(`/system-prompts/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({ version, changeSummary })
    });
  }
}

class StructuredOutputsAPI {
  constructor(config) {
    this.config = config;
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.config.useApiKey && this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(data.error || data)}`);
    }

    return data;
  }

  async listOutputs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/structured-outputs${query}`);
  }

  async createOutput(data) {
    return this.request('/structured-outputs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getOutput(id) {
    return this.request(`/structured-outputs/${id}`);
  }

  async updateOutput(id, data) {
    return this.request(`/structured-outputs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteOutput(id) {
    return this.request(`/structured-outputs/${id}`, {
      method: 'DELETE'
    });
  }

  async getOutputVersions(id) {
    return this.request(`/structured-outputs/${id}/versions`);
  }

  async restoreOutputVersion(id, version, changeSummary) {
    return this.request(`/structured-outputs/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({ version, changeSummary })
    });
  }
}

class TestSuite {
  constructor(name, api) {
    this.name = name;
    this.api = api;
    this.results = [];
  }

  log(message, status = 'info') {
    const timestamp = new Date().toISOString();
    const statusIcon = {
      info: '📝',
      pass: '✅',
      fail: '❌',
      warn: '⚠️'
    }[status] || '📝';
    
    const logMessage = `[${timestamp.slice(11, 19)}] ${statusIcon} ${message}`;
    console.log(logMessage);
    this.results.push({ timestamp, status, message });
  }

  async runTest(testName, testFn) {
    try {
      this.log(`Running: ${testName}`);
      await testFn();
      this.log(`PASSED: ${testName}`, 'pass');
      return true;
    } catch (error) {
      this.log(`FAILED: ${testName} - ${error.message}`, 'fail');
      return false;
    }
  }
}

class SystemPromptsTestSuite extends TestSuite {
  constructor(api) {
    super('System Prompts', api);
    this.testPromptId = null;
  }

  async runAllTests() {
    this.log(`Starting ${this.name} API Test Suite`);
    let passed = 0;
    let failed = 0;

    // Test 1: Create system prompt
    const success1 = await this.runTest('Create system prompt', async () => {
      const promptData = {
        name: 'Node Test Prompt',
        description: 'A test system prompt from Node.js',
        content: 'You are a helpful assistant. Always be polite and informative.',
        variables: { tone: 'professional', language: 'en' },
        category: 'assistant',
        is_public: false
      };

      const result = await this.api.createPrompt(promptData);
      
      if (!result.id) throw new Error('No ID returned');
      if (result.name !== promptData.name) throw new Error('Name mismatch');
      
      this.testPromptId = result.id;
      this.log(`Created prompt with ID: ${this.testPromptId}`);
    });
    success1 ? passed++ : failed++;

    // Test 2: Get system prompt
    const success2 = await this.runTest('Get system prompt', async () => {
      if (!this.testPromptId) throw new Error('No test prompt ID available');
      
      const result = await this.api.getPrompt(this.testPromptId);
      
      if (result.id !== this.testPromptId) throw new Error('ID mismatch');
      if (result.name !== 'Node Test Prompt') throw new Error('Name mismatch');
    });
    success2 ? passed++ : failed++;

    // Test 3: Update system prompt (versioning test)
    const success3 = await this.runTest('Update system prompt', async () => {
      if (!this.testPromptId) throw new Error('No test prompt ID available');
      
      const updateData = {
        name: 'Node Test Prompt Updated',
        description: 'Updated test system prompt',
        content: 'You are a helpful assistant. Always be polite, informative, and concise.',
        variables: { tone: 'friendly', language: 'en' },
        category: 'assistant',
        is_public: false
      };

      const result = await this.api.updatePrompt(this.testPromptId, updateData);
      
      if (result.name !== updateData.name) throw new Error('Name not updated');
      if (result.version !== 2) throw new Error('Version should be 2 after update');
    });
    success3 ? passed++ : failed++;

    // Test 4: Get version history
    const success4 = await this.runTest('Get version history', async () => {
      if (!this.testPromptId) throw new Error('No test prompt ID available');
      
      const versions = await this.api.getPromptVersions(this.testPromptId);
      
      if (!Array.isArray(versions)) throw new Error('Versions should be an array');
      if (versions.length !== 1) throw new Error('Should have 1 version in history (v1)');
    });
    success4 ? passed++ : failed++;

    // Test 5: Clean up - Delete system prompt
    const success5 = await this.runTest('Delete system prompt', async () => {
      if (!this.testPromptId) throw new Error('No test prompt ID available');
      
      const result = await this.api.deletePrompt(this.testPromptId);
      
      if (!result.success) throw new Error('Delete should return success');
    });
    success5 ? passed++ : failed++;

    this.log(`\n=== ${this.name} Test Results ===`);
    this.log(`Total: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
    this.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    return { passed, failed, results: this.results };
  }
}

class StructuredOutputsTestSuite extends TestSuite {
  constructor(api) {
    super('Structured Outputs', api);
    this.testOutputId = null;
  }

  async runAllTests() {
    this.log(`Starting ${this.name} API Test Suite`);
    let passed = 0;
    let failed = 0;

    // Test 1: Create structured output
    const success1 = await this.runTest('Create structured output', async () => {
      const outputData = {
        name: 'Node Test Schema',
        description: 'Test schema from Node.js',
        json_schema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: "User's full name"
            },
            email: {
              type: 'string',
              format: 'email',
              description: "User's email address"
            },
            age: {
              type: 'integer',
              minimum: 0,
              description: "User's age in years"
            }
          },
          required: ['name', 'email'],
          additionalProperties: false
        },
        is_public: false
      };

      const result = await this.api.createOutput(outputData);
      
      if (!result.id) throw new Error('No ID returned');
      if (result.name !== outputData.name) throw new Error('Name mismatch');
      
      this.testOutputId = result.id;
      this.log(`Created output with ID: ${this.testOutputId}`);
    });
    success1 ? passed++ : failed++;

    // Test 2: Get structured output
    const success2 = await this.runTest('Get structured output', async () => {
      if (!this.testOutputId) throw new Error('No test output ID available');
      
      const result = await this.api.getOutput(this.testOutputId);
      
      if (result.id !== this.testOutputId) throw new Error('ID mismatch');
      if (result.name !== 'Node Test Schema') throw new Error('Name mismatch');
    });
    success2 ? passed++ : failed++;

    // Test 3: Update structured output (versioning test)
    const success3 = await this.runTest('Update structured output', async () => {
      if (!this.testOutputId) throw new Error('No test output ID available');
      
      const updateData = {
        name: 'Node Test Schema Updated',
        description: 'Updated test schema',
        json_schema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: "User's full name"
            },
            email: {
              type: 'string',
              format: 'email',
              description: "User's email address"
            },
            age: {
              type: 'integer',
              minimum: 0,
              maximum: 150,
              description: "User's age in years"
            },
            location: {
              type: 'string',
              description: "User's location"
            }
          },
          required: ['name', 'email'],
          additionalProperties: false
        },
        is_public: false
      };

      const result = await this.api.updateOutput(this.testOutputId, updateData);
      
      if (result.name !== updateData.name) throw new Error('Name not updated');
      if (result.version !== 2) throw new Error('Version should be 2 after update');
    });
    success3 ? passed++ : failed++;

    // Test 4: Get version history
    const success4 = await this.runTest('Get version history', async () => {
      if (!this.testOutputId) throw new Error('No test output ID available');
      
      const versions = await this.api.getOutputVersions(this.testOutputId);
      
      if (!Array.isArray(versions)) throw new Error('Versions should be an array');
      if (versions.length !== 1) throw new Error('Should have 1 version in history (v1)');
    });
    success4 ? passed++ : failed++;

    // Test 5: Clean up - Delete structured output
    const success5 = await this.runTest('Delete structured output', async () => {
      if (!this.testOutputId) throw new Error('No test output ID available');
      
      const result = await this.api.deleteOutput(this.testOutputId);
      
      if (!result.success) throw new Error('Delete should return success');
    });
    success5 ? passed++ : failed++;

    this.log(`\n=== ${this.name} Test Results ===`);
    this.log(`Total: ${passed + failed}, Passed: ${passed}, Failed: ${failed}`);
    this.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    return { passed, failed, results: this.results };
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting API Test Suite (Node.js)');
  console.log('='.repeat(60));
  console.log(`📍 Base URL: ${config.baseUrl}`);
  console.log(`🔑 API Key: ${config.apiKey ? 'Provided' : 'None (session auth only)'}`);
  console.log('='.repeat(60));

  const results = {
    systemPrompts: null,
    structuredOutputs: null
  };

  try {
    // Test with API key if provided
    const authConfig = {
      useApiKey: !!config.apiKey,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl
    };

    // Run System Prompts Tests
    console.log('\n📝 Testing System Prompts API');
    console.log('-'.repeat(40));
    const systemPromptsAPI = new SystemPromptsAPI(authConfig);
    const systemPromptsTestSuite = new SystemPromptsTestSuite(systemPromptsAPI);
    results.systemPrompts = await systemPromptsTestSuite.runAllTests();

    // Run Structured Outputs Tests
    console.log('\n🏗️  Testing Structured Outputs API');
    console.log('-'.repeat(40));
    const structuredOutputsAPI = new StructuredOutputsAPI(authConfig);
    const structuredOutputsTestSuite = new StructuredOutputsTestSuite(structuredOutputsAPI);
    results.structuredOutputs = await structuredOutputsTestSuite.runAllTests();

  } catch (error) {
    console.error(`❌ Test execution failed: ${error.message}`);
    return false;
  }

  // Print final summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL TEST RESULTS SUMMARY');
  console.log('='.repeat(80));

  let totalPassed = 0;
  let totalFailed = 0;

  if (results.systemPrompts) {
    const sp = results.systemPrompts;
    console.log(`📝 System Prompts: ${sp.passed} passed, ${sp.failed} failed`);
    totalPassed += sp.passed;
    totalFailed += sp.failed;
  }

  if (results.structuredOutputs) {
    const so = results.structuredOutputs;
    console.log(`🏗️  Structured Outputs: ${so.passed} passed, ${so.failed} failed`);
    totalPassed += so.passed;
    totalFailed += so.failed;
  }

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

  return totalFailed === 0;
}

// Run the tests
runTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });