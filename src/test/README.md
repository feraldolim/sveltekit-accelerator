# Testing Infrastructure

This project uses Vitest for testing with comprehensive test coverage for server-side functions, utilities, and API endpoints.

## Setup

The testing infrastructure is configured with:

- **Vitest**: Modern testing framework with TypeScript support
- **jsdom**: Browser environment simulation for DOM testing
- **@testing-library/svelte**: Utilities for Svelte component testing (if needed)

## Configuration

- `vitest.config.ts`: Main Vitest configuration
- `src/test/setup.ts`: Global test setup and mocks

## Test Structure

Tests are organized alongside source files with `.test.ts` or `.spec.ts` extensions:

```
src/
├── lib/
│   ├── utils.test.ts
│   └── server/
│       ├── analytics.test.ts
│       ├── llm.test.ts
│       └── pdf-processor.test.ts
└── routes/
    └── api/
        └── analytics/
            └── analytics.test.ts
```

## Running Tests

```bash
# Run all tests
npm run test

# Run tests once (CI mode)
npm run test:run

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test:run src/lib/utils.test.ts
```

## What's Tested

### ✅ Currently Covered

1. **Utility Functions** (`src/lib/utils.test.ts`)
   - `cn` function for className merging
   - Conditional class handling
   - Tailwind class conflict resolution

2. **Analytics Functions** (`src/lib/server/analytics.test.ts`)
   - API usage tracking
   - User activity tracking
   - API tracker creation and usage

3. **LLM Utilities** (`src/lib/server/llm.test.ts`)
   - Token estimation
   - Message truncation
   - Text generation with mocked API calls

4. **PDF Processor** (`src/lib/server/pdf-processor.test.ts`)
   - PDF chunking logic
   - Q&A functionality
   - Summary generation

5. **API Endpoints** (`src/routes/api/analytics/analytics.test.ts`)
   - Authentication requirements
   - Different data type responses
   - Error handling

### 🚧 Areas for Future Testing

1. **Svelte Components**
   - Requires more complex setup for component testing
   - Consider using @testing-library/svelte for component tests

2. **Integration Tests**
   - Full API workflow tests
   - Database integration tests
   - File upload/download workflows

3. **E2E Tests**
   - User authentication flows
   - Chat functionality
   - PDF upload and processing

## Test Patterns

### Mocking External Dependencies

```typescript
// Mock Supabase
vi.mock('./supabase.js', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null }))
    }))
  }
}));

// Mock environment variables
vi.mock('$env/static/private', () => ({
  OPENROUTER_API_KEY: 'test-api-key'
}));
```

### Testing Async Functions

```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### Testing Error Handling

```typescript
it('should handle errors gracefully', async () => {
  vi.mocked(mockFunction).mockRejectedValue(new Error('Test error'));
  
  await expect(functionUnderTest()).rejects.toThrow('Test error');
});
```

## CI/CD Integration

Tests are automatically run in GitHub Actions on:
- Push to main/develop branches
- Pull requests to main

See `.github/workflows/ci.yml` for the full CI configuration.

## Troubleshooting

### Memory Issues

If you encounter memory issues during testing, the configuration includes:

```typescript
pool: 'forks',
poolOptions: {
  forks: {
    singleFork: true
  }
}
```

This prevents memory leaks from parallel test execution.

### Environment Variables

Tests use mocked environment variables defined in `src/test/setup.ts`. Update this file if you need different test configurations.

### Svelte Component Testing

For complex Svelte component testing, you may need to:

1. Install additional dependencies
2. Configure proper DOM environment
3. Use testing-library utilities

Currently, component testing is not included due to complexity but can be added as needed.

