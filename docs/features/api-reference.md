# Developer API Reference

## Overview

The SvelteKit Accelerator Developer API provides programmatic access to AI capabilities including chat completions, system prompt management, structured outputs, conversation management, and file processing.

## Authentication

All API requests require authentication using an API key. Include your API key in the `Authorization` header:

```bash
Authorization: Bearer ska_live_your_api_key_here
```

### API Key Formats
- **Production**: `ska_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Development**: `ska_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## Base URL

```
https://your-domain.com/api/v1
```

## Rate Limits

- **Standard**: 100 requests per hour
- **Premium**: 1000 requests per hour
- **Enterprise**: Custom limits

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Request limit per hour
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Timestamp when rate limit resets

## Error Handling

The API uses conventional HTTP response codes and returns error details in JSON format:

```json
{
  "error": {
    "code": "invalid_request",
    "message": "The request body is missing required field 'messages'",
    "param": "messages",
    "type": "invalid_request_error"
  }
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## API Endpoints

### Authentication & API Keys

#### Create API Key
```http
POST /api/v1/auth/keys
```

**Parameters:**
```json
{
  "name": "My App Key",
  "scopes": ["read", "write"],
  "rate_limit": 100,
  "expires_at": "2024-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "id": "key_123",
  "name": "My App Key",
  "key": "ska_live_abcd1234...",
  "scopes": ["read", "write"],
  "rate_limit": 100,
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### List API Keys
```http
GET /api/v1/auth/keys
```

**Response:**
```json
{
  "keys": [
    {
      "id": "key_123",
      "name": "My App Key",
      "key_prefix": "ska_live_abcd...",
      "scopes": ["read", "write"],
      "rate_limit": 100,
      "usage_count": 42,
      "last_used_at": "2024-01-01T12:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Revoke API Key
```http
DELETE /api/v1/auth/keys/{key_id}
```

**Response:**
```json
{
  "deleted": true
}
```

### System Prompts

#### Create System Prompt
```http
POST /api/v1/prompts
```

**Parameters:**
```json
{
  "name": "Customer Support Assistant",
  "description": "Helpful customer support chatbot",
  "content": "You are a helpful customer support assistant for {{company_name}}. Always be polite and professional. Current date: {{current_date}}",
  "variables": {
    "company_name": {
      "type": "string",
      "required": true,
      "description": "Name of the company"
    },
    "current_date": {
      "type": "string", 
      "required": false,
      "default": "{{NOW}}",
      "description": "Current date in YYYY-MM-DD format"
    }
  },
  "category": "customer_service"
}
```

**Response:**
```json
{
  "id": "prompt_123",
  "name": "Customer Support Assistant",
  "description": "Helpful customer support chatbot",
  "content": "You are a helpful customer support assistant for {{company_name}}...",
  "variables": {...},
  "category": "customer_service",
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### Execute System Prompt
```http
POST /api/v1/prompts/{prompt_id}/execute
```

**Parameters:**
```json
{
  "variables": {
    "company_name": "Acme Corp",
    "current_date": "2024-01-01"
  },
  "messages": [
    {
      "role": "user", 
      "content": "I need help with my order"
    }
  ],
  "model": "openai/gpt-4",
  "temperature": 0.7
}
```

### Structured Outputs

#### Create Schema
```http
POST /api/v1/schemas
```

**Parameters:**
```json
{
  "name": "Product Review Analysis",
  "description": "Analyze product reviews for sentiment and key themes",
  "json_schema": {
    "type": "object",
    "properties": {
      "sentiment": {
        "type": "string",
        "enum": ["positive", "negative", "neutral"]
      },
      "score": {
        "type": "number",
        "minimum": 0,
        "maximum": 1
      },
      "themes": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "summary": {
        "type": "string"
      }
    },
    "required": ["sentiment", "score", "summary"]
  },
  "example_output": {
    "sentiment": "positive",
    "score": 0.85,
    "themes": ["quality", "value", "customer_service"],
    "summary": "Customer is very satisfied with product quality and value."
  }
}
```

#### Get Structured Completion
```http
POST /api/v1/completions/structured
```

**Parameters:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Analyze this review: 'Great product, excellent quality and fast shipping!'"
    }
  ],
  "schema_id": "schema_123",
  "model": "openai/gpt-4",
  "strict": true,
  "max_retries": 3
}
```

**Response:**
```json
{
  "id": "completion_123",
  "object": "completion",
  "created": 1704067200,
  "model": "openai/gpt-4",
  "structured_output": {
    "sentiment": "positive",
    "score": 0.92,
    "themes": ["quality", "shipping"],
    "summary": "Very positive review highlighting product quality and fast shipping."
  },
  "usage": {
    "prompt_tokens": 45,
    "completion_tokens": 28,
    "total_tokens": 73
  }
}
```

### Conversations

#### Create Conversation
```http
POST /api/v1/conversations
```

**Parameters:**
```json
{
  "title": "Customer Support Chat",
  "system_prompt": "You are a helpful assistant",
  "model": "openai/gpt-3.5-turbo",
  "temperature": 0.7,
  "max_tokens": 2000,
  "metadata": {
    "customer_id": "cust_123",
    "priority": "high"
  }
}
```

#### Add Message to Conversation
```http
POST /api/v1/conversations/{conversation_id}/messages
```

**Parameters:**
```json
{
  "role": "user",
  "content": "Hello, I need help with my account"
}
```

**Response:**
```json
{
  "user_message": {
    "id": "msg_123",
    "role": "user",
    "content": "Hello, I need help with my account",
    "created_at": "2024-01-01T12:00:00Z"
  },
  "assistant_message": {
    "id": "msg_124", 
    "role": "assistant",
    "content": "I'd be happy to help you with your account. What specific issue are you experiencing?",
    "tokens_used": 23,
    "model": "openai/gpt-3.5-turbo",
    "created_at": "2024-01-01T12:00:01Z"
  },
  "usage": {
    "prompt_tokens": 45,
    "completion_tokens": 23,
    "total_tokens": 68
  }
}
```

### File Processing

#### Upload File
```http
POST /api/v1/files/upload
```

**Parameters:**
```bash
curl -X POST \
  -H "Authorization: Bearer ska_live_your_key" \
  -F "file=@document.pdf" \
  -F "type=pdf" \
  https://your-domain.com/api/v1/files/upload
```

**Response:**
```json
{
  "id": "file_123",
  "original_name": "document.pdf",
  "file_type": "pdf",
  "file_size": 1024000,
  "mime_type": "application/pdf",
  "processing_status": "pending",
  "created_at": "2024-01-01T12:00:00Z"
}
```

#### Extract Text from PDF
```http
POST /api/v1/files/{file_id}/extract
```

**Parameters:**
```json
{
  "pages": [1, 2, 3],
  "format": "markdown"
}
```

**Response:**
```json
{
  "id": "file_123",
  "processing_status": "completed",
  "processed_data": {
    "text": "# Document Title\n\nThis is the extracted text...",
    "pages": 10,
    "word_count": 1250,
    "format": "markdown"
  }
}
```

#### Transcribe Audio
```http
POST /api/v1/files/{file_id}/transcribe
```

**Parameters:**
```json
{
  "language": "en",
  "speaker_labels": true,
  "format": "srt"
}
```

**Response:**
```json
{
  "id": "file_123",
  "processing_status": "completed",
  "processed_data": {
    "transcript": "Hello, this is a test recording...",
    "duration": 120.5,
    "speakers": 2,
    "format": "srt",
    "confidence": 0.95
  }
}
```

#### Analyze Image
```http
POST /api/v1/files/{file_id}/analyze
```

**Parameters:**
```json
{
  "prompt": "What objects do you see in this image?",
  "model": "openai/gpt-4-vision-preview",
  "detail": "high"
}
```

**Response:**
```json
{
  "id": "file_123",
  "analysis": {
    "description": "I can see a modern office space with desks, computers, and people working...",
    "objects": ["desk", "computer", "chair", "person", "window"],
    "confidence": 0.89
  },
  "usage": {
    "prompt_tokens": 1024,
    "completion_tokens": 45,
    "total_tokens": 1069
  }
}
```

## Webhooks

You can configure webhooks to receive notifications about asynchronous operations:

### Register Webhook
```http
POST /api/v1/webhooks
```

**Parameters:**
```json
{
  "url": "https://your-app.com/webhooks/ai-completion",
  "events": ["completion.completed", "file.processed"],
  "secret": "your_webhook_secret"
}
```

### Webhook Payload Example
```json
{
  "id": "evt_123",
  "type": "completion.completed",
  "data": {
    "completion_id": "comp_123",
    "conversation_id": "conv_123",
    "status": "completed",
    "result": {...}
  },
  "created_at": "2024-01-01T12:00:00Z"
}
```

## SDKs and Libraries

### JavaScript/TypeScript
```bash
npm install @your-org/ai-api-sdk
```

```typescript
import { AIClient } from '@your-org/ai-api-sdk';

const client = new AIClient({
  apiKey: 'ska_live_your_key_here',
  baseUrl: 'https://your-domain.com/api/v1'
});

// Create completion
const completion = await client.completions.create({
  messages: [{ role: 'user', content: 'Hello!' }],
  model: 'openai/gpt-3.5-turbo'
});

// Use structured output
const analysis = await client.structured.complete({
  messages: [{ role: 'user', content: 'Analyze this text...' }],
  schemaId: 'schema_123'
});
```

### Python
```bash
pip install your-org-ai-api
```

```python
from your_org_ai import AIClient

client = AIClient(api_key='ska_live_your_key_here')

# Create completion
completion = client.completions.create(
    messages=[{"role": "user", "content": "Hello!"}],
    model="openai/gpt-3.5-turbo"
)

# Upload and process file
file = client.files.upload('document.pdf', type='pdf')
extracted = client.files.extract_text(file.id)
```

## Best Practices

1. **API Key Security**
   - Store API keys as environment variables
   - Use different keys for development and production
   - Regularly rotate your API keys

2. **Error Handling**
   - Always check response status codes
   - Implement retry logic with exponential backoff
   - Handle rate limit errors gracefully

3. **Cost Optimization**
   - Use appropriate models for your use case
   - Implement client-side caching where appropriate
   - Monitor usage and set alerts

4. **Performance**
   - Use streaming for real-time applications
   - Batch requests when possible
   - Implement proper pagination for large datasets

## Support

- **Documentation**: https://your-domain.com/docs
- **Community**: https://github.com/your-org/community
- **Support**: support@your-domain.com
- **Status Page**: https://status.your-domain.com