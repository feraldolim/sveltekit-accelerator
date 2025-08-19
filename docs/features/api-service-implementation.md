# Developer API Service Implementation Plan

## Overview

This document outlines the implementation of a comprehensive developer API service that allows external developers to build applications on top of our LLM infrastructure. The service provides API key management, system prompt templates, structured outputs, conversation management, and multimodal file processing capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer API Service                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   API Keys  │  │   Prompts   │  │  Structured Outputs │ │
│  │ Management  │  │ Management  │  │     (JSON Schema)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │Conversations│  │    Files    │  │    Rate Limiting    │ │
│  │ Management  │  │ Processing  │  │   & Analytics       │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                    Core LLM Service                         │
│              (OpenRouter Integration)                       │
└─────────────────────────────────────────────────────────────┘
```

## Phase 1: Database Schema

### New Tables

#### `api_keys`
```sql
CREATE TABLE api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- 'ska_live_' or 'ska_test_'
  key_hash TEXT NOT NULL UNIQUE, -- bcrypt hash of full key
  scopes TEXT[] NOT NULL DEFAULT '{}', -- ['read', 'write', 'delete']
  rate_limit INTEGER DEFAULT 100, -- requests per hour
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
```

#### `system_prompts`
```sql
CREATE TABLE system_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '{}', -- Variable definitions and defaults
  category TEXT DEFAULT 'general',
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_prompts_user_id ON system_prompts(user_id);
CREATE INDEX idx_system_prompts_category ON system_prompts(category);
CREATE INDEX idx_system_prompts_public ON system_prompts(is_public) WHERE is_public = true;
```

#### `structured_outputs`
```sql
CREATE TABLE structured_outputs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  json_schema JSONB NOT NULL,
  example_output JSONB,
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_structured_outputs_user_id ON structured_outputs(user_id);
CREATE INDEX idx_structured_outputs_public ON structured_outputs(is_public) WHERE is_public = true;
```

#### `conversations`
```sql
CREATE TABLE conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  system_prompt TEXT,
  model TEXT NOT NULL,
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER,
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_api_key_id ON conversations(api_key_id);
CREATE INDEX idx_conversations_active ON conversations(is_active) WHERE is_active = true;
```

#### `conversation_messages`
```sql
CREATE TABLE conversation_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL,
  tokens_used INTEGER,
  model TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversation_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX idx_conversation_messages_created_at ON conversation_messages(created_at);
```

#### `file_uploads`
```sql
CREATE TABLE file_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'image', 'audio')),
  processed_data JSONB, -- Extracted text, transcription, etc.
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX idx_file_uploads_type ON file_uploads(file_type);
CREATE INDEX idx_file_uploads_status ON file_uploads(processing_status);
```

## Phase 2: API Key Management System

### Key Generation
- Format: `ska_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (production) or `ska_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (development)
- Use cryptographically secure random generation
- Store bcrypt hash in database, never plaintext
- Implement key rotation mechanism

### Authentication Middleware
- Validate API key on every request to `/api/v1/`
- Check scopes and rate limits
- Track usage and update last_used_at

### Rate Limiting
- Implement sliding window rate limiting
- Different limits based on user tier
- Graceful degradation with meaningful error messages

## Phase 3: System Prompts Management

### Features
- Template variables with type checking
- Variable substitution engine
- Prompt versioning and rollback
- Public prompt marketplace
- Usage analytics and optimization suggestions

### Variable System
```typescript
interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
  default?: any;
  description?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
}
```

## Phase 4: Structured Outputs

### JSON Schema Integration
- Validate response format using JSON Schema
- Support for complex nested structures
- Automatic retry with schema enforcement
- Schema marketplace and templates

### Implementation
```typescript
interface StructuredRequest {
  messages: ChatMessage[];
  schema: JSONSchema;
  model: string;
  strict?: boolean; // Enforce strict schema compliance
  max_retries?: number;
}
```

## Phase 5: Conversation Management

### Features
- Persistent conversation threads
- Automatic context window management
- Conversation summarization
- Export/import conversation history
- Real-time collaboration support

### Context Management
- Automatic token counting and management
- Smart message truncation preserving context
- Conversation summarization for long threads

## Phase 6: File Processing

### PDF Processing
- Text extraction using pdf-parse
- Page-by-page processing
- OCR for scanned documents
- Metadata extraction

### Image Processing
- Base64 encoding for vision models
- Image compression and optimization
- Multi-format support (JPG, PNG, WebP, GIF)
- Integration with GPT-4V, Claude Vision

### Audio Processing
- Transcription using Whisper API
- Speaker diarization
- Multiple audio format support
- Real-time streaming transcription

## API Endpoints Specification

### Authentication & Management
```
POST   /api/v1/auth/keys              - Generate new API key
GET    /api/v1/auth/keys              - List user's API keys  
PUT    /api/v1/auth/keys/:id          - Update API key
DELETE /api/v1/auth/keys/:id          - Revoke API key
GET    /api/v1/auth/usage             - Get usage statistics
```

### System Prompts
```
POST   /api/v1/prompts                - Create prompt template
GET    /api/v1/prompts                - List prompts
GET    /api/v1/prompts/:id            - Get specific prompt
PUT    /api/v1/prompts/:id            - Update prompt
DELETE /api/v1/prompts/:id            - Delete prompt
POST   /api/v1/prompts/:id/execute    - Execute with variables
```

### Structured Outputs
```
POST   /api/v1/schemas                - Create JSON Schema
GET    /api/v1/schemas                - List schemas
GET    /api/v1/schemas/:id            - Get specific schema
PUT    /api/v1/schemas/:id            - Update schema
DELETE /api/v1/schemas/:id            - Delete schema
POST   /api/v1/completions/structured - Get structured response
```

### Conversations
```
POST   /api/v1/conversations          - Create conversation
GET    /api/v1/conversations          - List conversations
GET    /api/v1/conversations/:id      - Get conversation
PUT    /api/v1/conversations/:id      - Update conversation
DELETE /api/v1/conversations/:id      - Delete conversation
POST   /api/v1/conversations/:id/messages - Add message
GET    /api/v1/conversations/:id/messages - Get messages
```

### File Processing
```
POST   /api/v1/files/upload           - Upload file
GET    /api/v1/files                  - List files
GET    /api/v1/files/:id              - Get file info
DELETE /api/v1/files/:id              - Delete file
POST   /api/v1/files/:id/extract      - Extract text from PDF
POST   /api/v1/files/:id/transcribe   - Transcribe audio
POST   /api/v1/files/:id/analyze      - Analyze image with vision
```

## Security Considerations

1. **API Key Security**
   - Secure key generation using crypto.randomBytes
   - bcrypt hashing with salt rounds
   - Key rotation and expiration
   - Scope-based permissions

2. **Rate Limiting**
   - Per-key rate limiting
   - Burst protection
   - Graceful degradation

3. **Input Validation**
   - JSON Schema validation
   - File type and size limits
   - Content sanitization

4. **Access Control**
   - Row Level Security on all tables
   - API key scoping
   - Resource ownership validation

## Testing Strategy

1. **Unit Tests**
   - API key generation and validation
   - Prompt variable substitution
   - Schema validation
   - File processing utilities

2. **Integration Tests**
   - End-to-end API workflows
   - Authentication middleware
   - Database operations
   - File upload and processing

3. **Load Testing**
   - Rate limiting enforcement
   - Concurrent request handling
   - Database performance under load

## Deployment Considerations

1. **Environment Variables**
   - Separate API keys for development/production
   - File storage configuration
   - Rate limiting settings

2. **Database Migrations**
   - Staged rollout of schema changes
   - Data migration scripts
   - Rollback procedures

3. **Monitoring**
   - API usage metrics
   - Error rate tracking
   - Performance monitoring
   - Cost tracking for LLM usage

## Developer Experience

1. **Documentation**
   - Interactive API documentation
   - Code examples in multiple languages
   - SDK development (JavaScript/TypeScript, Python)

2. **Developer Console**
   - API key management
   - Usage analytics
   - Testing playground
   - Logs and debugging tools

3. **Onboarding**
   - Quick start guide
   - Example applications
   - Best practices documentation
   - Community support

This implementation will provide a robust, scalable developer API service that enables building sophisticated AI-powered applications while maintaining security, performance, and ease of use.