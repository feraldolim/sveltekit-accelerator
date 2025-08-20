-- Migration: API Service Tables
-- Description: Creates tables for API key management, system prompts, structured outputs, conversations, and file uploads

-- Create api_keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  rate_limit INTEGER DEFAULT 100,
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create system_prompts table
CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  category TEXT DEFAULT 'general',
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add versioning columns to existing system_prompts table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_prompts' AND column_name = 'version') THEN
    ALTER TABLE system_prompts ADD COLUMN version INTEGER DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_prompts' AND column_name = 'is_latest') THEN
    ALTER TABLE system_prompts ADD COLUMN is_latest BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'system_prompts' AND column_name = 'parent_id') THEN
    ALTER TABLE system_prompts ADD COLUMN parent_id UUID REFERENCES system_prompts(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create system_prompt_versions table for version history
CREATE TABLE IF NOT EXISTS system_prompt_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_id UUID REFERENCES system_prompts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '{}',
  category TEXT DEFAULT 'general',
  is_public BOOLEAN DEFAULT false,
  changed_by UUID REFERENCES auth.users(id),
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(prompt_id, version)
);

-- Create structured_outputs table
CREATE TABLE IF NOT EXISTS structured_outputs (
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

-- Add versioning columns to existing structured_outputs table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'structured_outputs' AND column_name = 'version') THEN
    ALTER TABLE structured_outputs ADD COLUMN version INTEGER DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'structured_outputs' AND column_name = 'is_latest') THEN
    ALTER TABLE structured_outputs ADD COLUMN is_latest BOOLEAN DEFAULT true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'structured_outputs' AND column_name = 'parent_id') THEN
    ALTER TABLE structured_outputs ADD COLUMN parent_id UUID REFERENCES structured_outputs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create structured_output_versions table for version history
CREATE TABLE IF NOT EXISTS structured_output_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  output_id UUID REFERENCES structured_outputs(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  json_schema JSONB NOT NULL,
  example_output JSONB,
  is_public BOOLEAN DEFAULT false,
  changed_by UUID REFERENCES auth.users(id),
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(output_id, version)
);

-- Create conversations table (for API)
CREATE TABLE IF NOT EXISTS api_conversations (
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

-- Create conversation_messages table
CREATE TABLE IF NOT EXISTS api_conversation_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES api_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL,
  tokens_used INTEGER,
  model TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create file_uploads table
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'image', 'audio')),
  processed_data JSONB,
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE structured_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE structured_output_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for api_keys
DROP POLICY IF EXISTS "Users can view own API keys" ON api_keys;
CREATE POLICY "Users can view own API keys" ON api_keys FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own API keys" ON api_keys;
CREATE POLICY "Users can create own API keys" ON api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own API keys" ON api_keys;
CREATE POLICY "Users can update own API keys" ON api_keys FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own API keys" ON api_keys;
CREATE POLICY "Users can delete own API keys" ON api_keys FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for system_prompts
DROP POLICY IF EXISTS "Users can view own or public prompts" ON system_prompts;
CREATE POLICY "Users can view own or public prompts" ON system_prompts FOR SELECT USING (auth.uid() = user_id OR is_public = true);
DROP POLICY IF EXISTS "Users can create own prompts" ON system_prompts;
CREATE POLICY "Users can create own prompts" ON system_prompts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own prompts" ON system_prompts;
CREATE POLICY "Users can update own prompts" ON system_prompts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own prompts" ON system_prompts;
CREATE POLICY "Users can delete own prompts" ON system_prompts FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for system_prompt_versions
DROP POLICY IF EXISTS "Users can view own prompt versions" ON system_prompt_versions;
CREATE POLICY "Users can view own prompt versions" ON system_prompt_versions FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM system_prompts WHERE id = prompt_id)
);
DROP POLICY IF EXISTS "Users can create prompt versions" ON system_prompt_versions;
CREATE POLICY "Users can create prompt versions" ON system_prompt_versions FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT user_id FROM system_prompts WHERE id = prompt_id)
);

-- Create RLS policies for structured_outputs
DROP POLICY IF EXISTS "Users can view own or public schemas" ON structured_outputs;
CREATE POLICY "Users can view own or public schemas" ON structured_outputs FOR SELECT USING (auth.uid() = user_id OR is_public = true);
DROP POLICY IF EXISTS "Users can create own schemas" ON structured_outputs;
CREATE POLICY "Users can create own schemas" ON structured_outputs FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own schemas" ON structured_outputs;
CREATE POLICY "Users can update own schemas" ON structured_outputs FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own schemas" ON structured_outputs;
CREATE POLICY "Users can delete own schemas" ON structured_outputs FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for structured_output_versions
DROP POLICY IF EXISTS "Users can view own output versions" ON structured_output_versions;
CREATE POLICY "Users can view own output versions" ON structured_output_versions FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM structured_outputs WHERE id = output_id) OR
  auth.role() = 'service_role'
);
DROP POLICY IF EXISTS "Users can create output versions" ON structured_output_versions;
CREATE POLICY "Users can create output versions" ON structured_output_versions FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT user_id FROM structured_outputs WHERE id = output_id) OR 
  auth.role() = 'service_role'
);

-- Create RLS policies for api_conversations
DROP POLICY IF EXISTS "Users can view own API conversations" ON api_conversations;
CREATE POLICY "Users can view own API conversations" ON api_conversations FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own API conversations" ON api_conversations;
CREATE POLICY "Users can create own API conversations" ON api_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own API conversations" ON api_conversations;
CREATE POLICY "Users can update own API conversations" ON api_conversations FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own API conversations" ON api_conversations;
CREATE POLICY "Users can delete own API conversations" ON api_conversations FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for api_conversation_messages
DROP POLICY IF EXISTS "Users can view own API conversation messages" ON api_conversation_messages;
CREATE POLICY "Users can view own API conversation messages" ON api_conversation_messages FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM api_conversations WHERE id = conversation_id)
);
DROP POLICY IF EXISTS "Users can create messages in own API conversations" ON api_conversation_messages;
CREATE POLICY "Users can create messages in own API conversations" ON api_conversation_messages FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT user_id FROM api_conversations WHERE id = conversation_id)
);

-- Create RLS policies for file_uploads
DROP POLICY IF EXISTS "Users can view own or public files" ON file_uploads;
CREATE POLICY "Users can view own or public files" ON file_uploads FOR SELECT USING (auth.uid() = user_id OR is_public = true);
DROP POLICY IF EXISTS "Users can create own files" ON file_uploads;
CREATE POLICY "Users can create own files" ON file_uploads FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own files" ON file_uploads;
CREATE POLICY "Users can update own files" ON file_uploads FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own files" ON file_uploads;
CREATE POLICY "Users can delete own files" ON file_uploads FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_system_prompts_user_id ON system_prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_system_prompts_category ON system_prompts(category);
CREATE INDEX IF NOT EXISTS idx_system_prompts_public ON system_prompts(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_system_prompts_latest ON system_prompts(is_latest) WHERE is_latest = true;
CREATE INDEX IF NOT EXISTS idx_system_prompts_parent_id ON system_prompts(parent_id);
CREATE INDEX IF NOT EXISTS idx_system_prompts_version ON system_prompts(parent_id, version);

CREATE INDEX IF NOT EXISTS idx_system_prompt_versions_prompt_id ON system_prompt_versions(prompt_id);
CREATE INDEX IF NOT EXISTS idx_system_prompt_versions_version ON system_prompt_versions(prompt_id, version);
CREATE INDEX IF NOT EXISTS idx_system_prompt_versions_created_at ON system_prompt_versions(created_at);

CREATE INDEX IF NOT EXISTS idx_structured_outputs_user_id ON structured_outputs(user_id);
CREATE INDEX IF NOT EXISTS idx_structured_outputs_public ON structured_outputs(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_structured_outputs_latest ON structured_outputs(is_latest) WHERE is_latest = true;
CREATE INDEX IF NOT EXISTS idx_structured_outputs_parent_id ON structured_outputs(parent_id);
CREATE INDEX IF NOT EXISTS idx_structured_outputs_version ON structured_outputs(parent_id, version);

CREATE INDEX IF NOT EXISTS idx_structured_output_versions_output_id ON structured_output_versions(output_id);
CREATE INDEX IF NOT EXISTS idx_structured_output_versions_version ON structured_output_versions(output_id, version);
CREATE INDEX IF NOT EXISTS idx_structured_output_versions_created_at ON structured_output_versions(created_at);

CREATE INDEX IF NOT EXISTS idx_api_conversations_user_id ON api_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_api_conversations_api_key_id ON api_conversations(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_conversations_active ON api_conversations(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_api_conversation_messages_conversation_id ON api_conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_api_conversation_messages_created_at ON api_conversation_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_type ON file_uploads(file_type);
CREATE INDEX IF NOT EXISTS idx_file_uploads_status ON file_uploads(processing_status);

-- Create function to increment usage count atomically
CREATE OR REPLACE FUNCTION increment_usage_count(key_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE api_keys 
  SET usage_count = usage_count + 1
  WHERE id = key_id
  RETURNING usage_count INTO new_count;
  
  RETURN new_count;
END;
$$ LANGUAGE plpgsql;

-- Add api_key_id column to existing api_usage table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_usage') THEN
    ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_api_usage_api_key_id ON api_usage(api_key_id);
  END IF;
END $$;

-- Add foreign key constraints to link chats and messages to system prompts and structured outputs
-- These are added here because the system_prompts and structured_outputs tables are created in this migration

-- Add missing columns to messages table if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    -- Add system_prompt_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'system_prompt_id') THEN
      ALTER TABLE messages ADD COLUMN system_prompt_id UUID;
    END IF;
    
    -- Add system_prompt_version column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'system_prompt_version') THEN
      ALTER TABLE messages ADD COLUMN system_prompt_version INTEGER;
    END IF;
    
    -- Add structured_output_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'structured_output_id') THEN
      ALTER TABLE messages ADD COLUMN structured_output_id UUID;
    END IF;
    
    -- Add structured_output_version column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'structured_output_version') THEN
      ALTER TABLE messages ADD COLUMN structured_output_version INTEGER;
    END IF;
  END IF;
END $$;

-- Add foreign key constraints to messages table (created in 001_initial_schema.sql)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    -- Add system_prompt foreign key constraint
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'messages_system_prompt_id_fkey' 
                   AND table_name = 'messages') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'system_prompt_id') THEN
        ALTER TABLE messages 
        ADD CONSTRAINT messages_system_prompt_id_fkey 
        FOREIGN KEY (system_prompt_id) REFERENCES system_prompts(id) ON DELETE SET NULL;
      END IF;
    END IF;
    
    -- Add structured_output foreign key constraint
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'messages_structured_output_id_fkey' 
                   AND table_name = 'messages') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'structured_output_id') THEN
        ALTER TABLE messages 
        ADD CONSTRAINT messages_structured_output_id_fkey 
        FOREIGN KEY (structured_output_id) REFERENCES structured_outputs(id) ON DELETE SET NULL;
      END IF;
    END IF;
  END IF;
END $$;

-- Add missing columns to chats table if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chats') THEN
    -- Add default_system_prompt_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'default_system_prompt_id') THEN
      ALTER TABLE chats ADD COLUMN default_system_prompt_id UUID;
    END IF;
    
    -- Add default_structured_output_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'default_structured_output_id') THEN
      ALTER TABLE chats ADD COLUMN default_structured_output_id UUID;
    END IF;
    
    -- Add message_count column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'message_count') THEN
      ALTER TABLE chats ADD COLUMN message_count INTEGER DEFAULT 0;
    END IF;
    
    -- Add is_pinned column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'is_pinned') THEN
      ALTER TABLE chats ADD COLUMN is_pinned BOOLEAN DEFAULT false;
    END IF;
  END IF;
END $$;

-- Add foreign key constraints to chats table (created in 001_initial_schema.sql)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chats') THEN
    -- Add default_system_prompt foreign key constraint
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chats_default_system_prompt_id_fkey' 
                   AND table_name = 'chats') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'default_system_prompt_id') THEN
        ALTER TABLE chats
        ADD CONSTRAINT chats_default_system_prompt_id_fkey
        FOREIGN KEY (default_system_prompt_id) REFERENCES system_prompts(id) ON DELETE SET NULL;
      END IF;
    END IF;
    
    -- Add default_structured_output foreign key constraint
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'chats_default_structured_output_id_fkey' 
                   AND table_name = 'chats') THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'default_structured_output_id') THEN
        ALTER TABLE chats
        ADD CONSTRAINT chats_default_structured_output_id_fkey
        FOREIGN KEY (default_structured_output_id) REFERENCES structured_outputs(id) ON DELETE SET NULL;
      END IF;
    END IF;
  END IF;
END $$;