/**
 * API Test Suite for System Prompts
 * Tests all CRUD operations and versioning functionality
 */

const API_BASE = 'http://localhost:5173/api/v1';

// Test configuration
const testConfig = {
  // Set to true to use API key authentication, false for session auth
  useApiKey: false,
  apiKey: 'sk-test-your-api-key-here', // Replace with actual API key for API key tests
  baseUrl: API_BASE
};

class SystemPromptsAPI {
  constructor(config) {
    this.config = config;
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.config.useApiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: this.config.useApiKey ? 'omit' : 'include'
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${data.error || 'Unknown error'}`);
    }

    return data;
  }

  // GET /api/v1/system-prompts
  async listPrompts(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.category) params.set('category', filters.category);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/system-prompts${query}`);
  }

  // POST /api/v1/system-prompts
  async createPrompt(data) {
    return this.request('/system-prompts', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // GET /api/v1/system-prompts/:id
  async getPrompt(id) {
    return this.request(`/system-prompts/${id}`);
  }

  // PUT /api/v1/system-prompts/:id
  async updatePrompt(id, data) {
    return this.request(`/system-prompts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // DELETE /api/v1/system-prompts/:id
  async deletePrompt(id) {
    return this.request(`/system-prompts/${id}`, {
      method: 'DELETE'
    });
  }

  // GET /api/v1/system-prompts/:id/versions
  async getPromptVersions(id) {
    return this.request(`/system-prompts/${id}/versions`);
  }

  // POST /api/v1/system-prompts/:id/restore
  async restorePromptVersion(id, version, changeSummary) {
    return this.request(`/system-prompts/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({ version, changeSummary })
    });
  }
}

// Test Suite
class SystemPromptsTestSuite {
  constructor(api) {
    this.api = api;
    this.testPromptId = null;
    this.results = [];
  }

  log(message, status = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${status.toUpperCase()}] ${message}`;
    console.log(logMessage);
    this.results.push({ timestamp, status, message });
  }

  async runTest(testName, testFn) {
    try {
      this.log(`Running test: ${testName}`);
      await testFn();
      this.log(`✓ PASSED: ${testName}`, 'pass');
      return true;
    } catch (error) {
      this.log(`✗ FAILED: ${testName} - ${error.message}`, 'fail');
      return false;
    }
  }

  async runAllTests() {
    this.log('Starting System Prompts API Test Suite');
    let passed = 0;
    let failed = 0;

    // Test 1: Create system prompt
    const success1 = await this.runTest('Create system prompt', async () => {
      const promptData = {
        name: 'Test Prompt',
        description: 'A test system prompt',
        content: 'You are a helpful assistant. Always be polite and informative.',
        variables: { tone: 'professional', language: 'en' },
        category: 'assistant',
        is_public: false
      };

      const result = await this.api.createPrompt(promptData);
      
      if (!result.id) throw new Error('No ID returned');
      if (result.name !== promptData.name) throw new Error('Name mismatch');
      if (result.version !== 1) throw new Error('Initial version should be 1');
      
      this.testPromptId = result.id;
      this.log(`Created prompt with ID: ${this.testPromptId}`);
    });
    success1 ? passed++ : failed++;

    // Test 2: Get system prompt
    const success2 = await this.runTest('Get system prompt', async () => {
      if (!this.testPromptId) throw new Error('No test prompt ID available');
      
      const result = await this.api.getPrompt(this.testPromptId);
      
      if (result.id !== this.testPromptId) throw new Error('ID mismatch');
      if (result.name !== 'Test Prompt') throw new Error('Name mismatch');
    });
    success2 ? passed++ : failed++;

    // Test 3: List system prompts
    const success3 = await this.runTest('List system prompts', async () => {
      const result = await this.api.listPrompts();
      
      if (!Array.isArray(result.prompts)) throw new Error('Prompts should be an array');
      if (result.prompts.length === 0) throw new Error('Should have at least one prompt');
      
      const testPrompt = result.prompts.find(p => p.id === this.testPromptId);
      if (!testPrompt) throw new Error('Test prompt not found in list');
    });
    success3 ? passed++ : failed++;

    // Test 4: Update system prompt (creates new version)
    const success4 = await this.runTest('Update system prompt', async () => {
      if (!this.testPromptId) throw new Error('No test prompt ID available');
      
      const updateData = {
        name: 'Test Prompt Updated',
        description: 'Updated test system prompt',
        content: 'You are a helpful assistant. Always be polite, informative, and concise.',
        variables: { tone: 'friendly', language: 'en' },
        category: 'assistant',
        is_public: false
      };

      const result = await this.api.updatePrompt(this.testPromptId, updateData);
      
      if (result.name !== updateData.name) throw new Error('Name not updated');
      if (result.version !== 2) throw new Error('Version should be 2 after update');
      if (!result.is_latest) throw new Error('Updated prompt should be latest');
    });
    success4 ? passed++ : failed++;

    // Test 5: Get version history
    const success5 = await this.runTest('Get version history', async () => {
      if (!this.testPromptId) throw new Error('No test prompt ID available');
      
      const versions = await this.api.getPromptVersions(this.testPromptId);
      
      if (!Array.isArray(versions)) throw new Error('Versions should be an array');
      if (versions.length !== 1) throw new Error('Should have 1 version in history (v1)');
      if (versions[0].version !== 1) throw new Error('First version should be version 1');
      if (versions[0].name !== 'Test Prompt') throw new Error('Version 1 name mismatch');
    });
    success5 ? passed++ : failed++;

    // Test 6: Restore previous version
    const success6 = await this.runTest('Restore previous version', async () => {
      if (!this.testPromptId) throw new Error('No test prompt ID available');
      
      const result = await this.api.restorePromptVersion(this.testPromptId, 1, 'Restored to original version');
      
      if (result.version !== 3) throw new Error('Restored version should be version 3');
      if (result.name !== 'Test Prompt') throw new Error('Restored name should match version 1');
      if (!result.is_latest) throw new Error('Restored prompt should be latest');
    });
    success6 ? passed++ : failed++;

    // Test 7: Search prompts
    const success7 = await this.runTest('Search prompts', async () => {
      const result = await this.api.listPrompts({ search: 'Test' });
      
      if (!Array.isArray(result.prompts)) throw new Error('Search results should be an array');
      const testPrompt = result.prompts.find(p => p.id === this.testPromptId);
      if (!testPrompt) throw new Error('Test prompt should be found in search');
    });
    success7 ? passed++ : failed++;

    // Test 8: Filter by category
    const success8 = await this.runTest('Filter by category', async () => {
      const result = await this.api.listPrompts({ category: 'assistant' });
      
      if (!Array.isArray(result.prompts)) throw new Error('Filter results should be an array');
      const testPrompt = result.prompts.find(p => p.id === this.testPromptId);
      if (!testPrompt) throw new Error('Test prompt should be found in category filter');
    });
    success8 ? passed++ : failed++;

    // Test 9: Delete system prompt
    const success9 = await this.runTest('Delete system prompt', async () => {
      if (!this.testPromptId) throw new Error('No test prompt ID available');
      
      const result = await this.api.deletePrompt(this.testPromptId);
      
      if (!result.success) throw new Error('Delete should return success');
    });
    success9 ? passed++ : failed++;

    // Test 10: Verify deletion
    const success10 = await this.runTest('Verify prompt deletion', async () => {
      if (!this.testPromptId) throw new Error('No test prompt ID available');
      
      try {
        await this.api.getPrompt(this.testPromptId);
        throw new Error('Should not be able to get deleted prompt');
      } catch (error) {
        if (!error.message.includes('404') && !error.message.includes('not found')) {
          throw new Error('Expected 404 error for deleted prompt');
        }
      }
    });
    success10 ? passed++ : failed++;

    // Summary
    this.log(`\n=== Test Suite Summary ===`);
    this.log(`Total tests: ${passed + failed}`);
    this.log(`Passed: ${passed}`, 'pass');
    this.log(`Failed: ${failed}`, failed > 0 ? 'fail' : 'pass');
    this.log(`Success rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    return { passed, failed, results: this.results };
  }
}

// Export for use in other test files or run directly
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SystemPromptsAPI, SystemPromptsTestSuite };
} else {
  // Run tests if this file is executed directly
  async function runTests() {
    const api = new SystemPromptsAPI(testConfig);
    const testSuite = new SystemPromptsTestSuite(api);
    
    try {
      await testSuite.runAllTests();
    } catch (error) {
      console.error('Test suite failed:', error);
    }
  }
  
  // Auto-run tests if in browser environment
  if (typeof window !== 'undefined') {
    window.runSystemPromptsTests = runTests;
    console.log('System Prompts API tests loaded. Run window.runSystemPromptsTests() to execute.');
  }
}