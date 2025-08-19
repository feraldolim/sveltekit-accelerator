/**
 * API Test Suite for Structured Outputs
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

class StructuredOutputsAPI {
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

  // GET /api/v1/structured-outputs
  async listOutputs(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/structured-outputs${query}`);
  }

  // POST /api/v1/structured-outputs
  async createOutput(data) {
    return this.request('/structured-outputs', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // GET /api/v1/structured-outputs/:id
  async getOutput(id) {
    return this.request(`/structured-outputs/${id}`);
  }

  // PUT /api/v1/structured-outputs/:id
  async updateOutput(id, data) {
    return this.request(`/structured-outputs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  // DELETE /api/v1/structured-outputs/:id
  async deleteOutput(id) {
    return this.request(`/structured-outputs/${id}`, {
      method: 'DELETE'
    });
  }

  // GET /api/v1/structured-outputs/:id/versions
  async getOutputVersions(id) {
    return this.request(`/structured-outputs/${id}/versions`);
  }

  // POST /api/v1/structured-outputs/:id/restore
  async restoreOutputVersion(id, version, changeSummary) {
    return this.request(`/structured-outputs/${id}/restore`, {
      method: 'POST',
      body: JSON.stringify({ version, changeSummary })
    });
  }
}

// Test Suite
class StructuredOutputsTestSuite {
  constructor(api) {
    this.api = api;
    this.testOutputId = null;
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
    this.log('Starting Structured Outputs API Test Suite');
    let passed = 0;
    let failed = 0;

    // Test 1: Create structured output
    const success1 = await this.runTest('Create structured output', async () => {
      const outputData = {
        name: 'User Profile Schema',
        description: 'Schema for user profile data structure',
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
            },
            preferences: {
              type: 'object',
              properties: {
                theme: {
                  type: 'string',
                  enum: ['light', 'dark']
                },
                notifications: {
                  type: 'boolean'
                }
              }
            }
          },
          required: ['name', 'email'],
          additionalProperties: false
        },
        example_output: {
          name: 'John Doe',
          email: 'john@example.com',
          age: 30,
          preferences: {
            theme: 'dark',
            notifications: true
          }
        },
        is_public: false
      };

      const result = await this.api.createOutput(outputData);
      
      if (!result.id) throw new Error('No ID returned');
      if (result.name !== outputData.name) throw new Error('Name mismatch');
      if (result.version !== 1) throw new Error('Initial version should be 1');
      if (!result.json_schema) throw new Error('JSON schema not returned');
      
      this.testOutputId = result.id;
      this.log(`Created structured output with ID: ${this.testOutputId}`);
    });
    success1 ? passed++ : failed++;

    // Test 2: Get structured output
    const success2 = await this.runTest('Get structured output', async () => {
      if (!this.testOutputId) throw new Error('No test output ID available');
      
      const result = await this.api.getOutput(this.testOutputId);
      
      if (result.id !== this.testOutputId) throw new Error('ID mismatch');
      if (result.name !== 'User Profile Schema') throw new Error('Name mismatch');
      if (!result.json_schema) throw new Error('JSON schema missing');
    });
    success2 ? passed++ : failed++;

    // Test 3: List structured outputs
    const success3 = await this.runTest('List structured outputs', async () => {
      const result = await this.api.listOutputs();
      
      if (!result.schemas || !Array.isArray(result.schemas)) throw new Error('Schemas should be an array');
      if (result.schemas.length === 0) throw new Error('Should have at least one schema');
      
      const testOutput = result.schemas.find(s => s.id === this.testOutputId);
      if (!testOutput) throw new Error('Test schema not found in list');
    });
    success3 ? passed++ : failed++;

    // Test 4: Update structured output (creates new version)
    const success4 = await this.runTest('Update structured output', async () => {
      if (!this.testOutputId) throw new Error('No test output ID available');
      
      const updateData = {
        name: 'Enhanced User Profile Schema',
        description: 'Updated schema with additional fields',
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
            },
            preferences: {
              type: 'object',
              properties: {
                theme: {
                  type: 'string',
                  enum: ['light', 'dark', 'auto']
                },
                notifications: {
                  type: 'boolean'
                },
                language: {
                  type: 'string',
                  description: 'Preferred language code'
                }
              }
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
      if (!result.is_latest) throw new Error('Updated output should be latest');
      
      // Check if new property was added
      if (!result.json_schema.properties.location) throw new Error('New location property missing');
    });
    success4 ? passed++ : failed++;

    // Test 5: Get version history
    const success5 = await this.runTest('Get version history', async () => {
      if (!this.testOutputId) throw new Error('No test output ID available');
      
      const versions = await this.api.getOutputVersions(this.testOutputId);
      
      if (!Array.isArray(versions)) throw new Error('Versions should be an array');
      if (versions.length !== 1) throw new Error('Should have 1 version in history (v1)');
      if (versions[0].version !== 1) throw new Error('First version should be version 1');
      if (versions[0].name !== 'User Profile Schema') throw new Error('Version 1 name mismatch');
    });
    success5 ? passed++ : failed++;

    // Test 6: Restore previous version
    const success6 = await this.runTest('Restore previous version', async () => {
      if (!this.testOutputId) throw new Error('No test output ID available');
      
      const result = await this.api.restoreOutputVersion(this.testOutputId, 1, 'Restored to original schema');
      
      if (result.version !== 3) throw new Error('Restored version should be version 3');
      if (result.name !== 'User Profile Schema') throw new Error('Restored name should match version 1');
      if (!result.is_latest) throw new Error('Restored output should be latest');
      
      // Check if location property is removed (back to v1)
      if (result.json_schema.properties.location) throw new Error('Location property should not exist in restored v1');
    });
    success6 ? passed++ : failed++;

    // Test 7: Search outputs
    const success7 = await this.runTest('Search structured outputs', async () => {
      const result = await this.api.listOutputs({ search: 'Profile' });
      
      if (!result.schemas || !Array.isArray(result.schemas)) throw new Error('Search results should be an array');
      const testOutput = result.schemas.find(s => s.id === this.testOutputId);
      if (!testOutput) throw new Error('Test output should be found in search');
    });
    success7 ? passed++ : failed++;

    // Test 8: Test schema validation
    const success8 = await this.runTest('Test invalid schema validation', async () => {
      const invalidOutputData = {
        name: 'Invalid Schema',
        description: 'This should fail validation',
        json_schema: {
          // Missing required 'type' field
          properties: {
            field1: { type: 'string' }
          }
        },
        is_public: false
      };

      try {
        await this.api.createOutput(invalidOutputData);
        throw new Error('Should have failed validation for invalid schema');
      } catch (error) {
        if (!error.message.includes('Invalid JSON Schema')) {
          throw new Error('Expected JSON Schema validation error');
        }
      }
    });
    success8 ? passed++ : failed++;

    // Test 9: Test complex schema with nested objects and arrays
    const success9 = await this.runTest('Create complex nested schema', async () => {
      const complexOutputData = {
        name: 'Complex Order Schema',
        description: 'Schema for e-commerce order data',
        json_schema: {
          type: 'object',
          properties: {
            order_id: {
              type: 'string',
              pattern: '^ORD-[0-9]{6}$'
            },
            customer: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string', format: 'email' }
              },
              required: ['id', 'name', 'email']
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  product_id: { type: 'string' },
                  name: { type: 'string' },
                  quantity: { type: 'integer', minimum: 1 },
                  price: { type: 'number', minimum: 0 }
                },
                required: ['product_id', 'name', 'quantity', 'price']
              },
              minItems: 1
            },
            total_amount: {
              type: 'number',
              minimum: 0
            },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']
            }
          },
          required: ['order_id', 'customer', 'items', 'total_amount', 'status'],
          additionalProperties: false
        },
        is_public: false
      };

      const result = await this.api.createOutput(complexOutputData);
      
      if (!result.id) throw new Error('Complex schema creation failed');
      if (result.name !== complexOutputData.name) throw new Error('Complex schema name mismatch');
      
      // Clean up by deleting this test schema
      await this.api.deleteOutput(result.id);
    });
    success9 ? passed++ : failed++;

    // Test 10: Delete structured output
    const success10 = await this.runTest('Delete structured output', async () => {
      if (!this.testOutputId) throw new Error('No test output ID available');
      
      const result = await this.api.deleteOutput(this.testOutputId);
      
      if (!result.success) throw new Error('Delete should return success');
    });
    success10 ? passed++ : failed++;

    // Test 11: Verify deletion
    const success11 = await this.runTest('Verify output deletion', async () => {
      if (!this.testOutputId) throw new Error('No test output ID available');
      
      try {
        await this.api.getOutput(this.testOutputId);
        throw new Error('Should not be able to get deleted output');
      } catch (error) {
        if (!error.message.includes('404') && !error.message.includes('not found')) {
          throw new Error('Expected 404 error for deleted output');
        }
      }
    });
    success11 ? passed++ : failed++;

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
  module.exports = { StructuredOutputsAPI, StructuredOutputsTestSuite };
} else {
  // Run tests if this file is executed directly
  async function runTests() {
    const api = new StructuredOutputsAPI(testConfig);
    const testSuite = new StructuredOutputsTestSuite(api);
    
    try {
      await testSuite.runAllTests();
    } catch (error) {
      console.error('Test suite failed:', error);
    }
  }
  
  // Auto-run tests if in browser environment
  if (typeof window !== 'undefined') {
    window.runStructuredOutputsTests = runTests;
    console.log('Structured Outputs API tests loaded. Run window.runStructuredOutputsTests() to execute.');
  }
}