# SvelteKit Accelerator Implementation Guide

This guide provides detailed instructions for setting up and customizing the SvelteKit Accelerator template for your specific project needs.

## Table of Contents

1. [Initial Setup](#initial-setup)
2. [Authentication Setup](#authentication-setup)
3. [Database Configuration](#database-configuration)
4. [LLM Integration](#llm-integration)
5. [UI Components](#ui-components)
6. [Deployment](#deployment)
7. [Customization](#customization)
8. [Best Practices](#best-practices)

## Initial Setup

### 1. Prerequisites

Ensure you have the following installed:
- Node.js 18.x or higher
- npm, pnpm, or yarn
- Git
- A code editor (VS Code or Cursor recommended)

### 2. Project Initialization

```bash
# Clone the template
git clone https://github.com/yourusername/sveltekit-accelerator.git my-project
cd my-project

# Remove existing git history
rm -rf .git
git init

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

### 3. Environment Configuration

Edit `.env.local` with your actual API keys:

```env
# Get from https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-...

# Get from Supabase project settings
PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

## Authentication Setup

### 1. Supabase Project Setup

1. Create a new Supabase project at [app.supabase.com](https://app.supabase.com)
2. Navigate to Settings → API
3. Copy your project URL and keys to `.env.local`

### 2. Configure Authentication Providers

In your Supabase dashboard:

1. Go to Authentication → Providers
2. Enable desired providers (Email, Google, GitHub, etc.)
3. Configure OAuth credentials for each provider

### 3. Database Schema

Run this SQL in your Supabase SQL editor to set up the user profiles table:

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Create trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

### 4. Implementing Auth in Your App

The template includes auth utilities in `src/lib/server/auth.ts`. Use them in your routes:

```typescript
// src/routes/+page.server.ts
import { requireAuth } from '$lib/server/auth';

export async function load({ locals }) {
  const session = await requireAuth(locals);
  
  return {
    user: session.user
  };
}
```

## Database Configuration

### 1. Database Schema Design

Plan your database schema based on your application needs. Example for a blog:

```sql
-- Posts table
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments table
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
```

### 2. Database Utilities

Use the provided database utilities in `src/lib/server/db.ts`:

```typescript
import { db } from '$lib/server/db';

// Query example
export async function getPosts() {
  const { data, error } = await db
    .from('posts')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false });
    
  if (error) throw error;
  return data;
}
```

## LLM Integration

### 1. OpenRouter Setup

1. Sign up at [OpenRouter](https://openrouter.ai)
2. Generate an API key
3. Add to `.env.local`

### 2. Using the LLM Client

The template includes an OpenRouter client in `src/lib/server/llm.ts`:

```typescript
import { createCompletion } from '$lib/server/llm';

// Basic completion
const response = await createCompletion({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello!' }
  ],
  model: 'openai/gpt-3.5-turbo' // or any model from OpenRouter
});

// Streaming response
const stream = await createCompletionStream({
  messages: [...],
  model: 'anthropic/claude-3-sonnet-20240229'
});

// Use in server-side endpoint
// src/routes/api/chat/+server.ts
import { json } from '@sveltejs/kit';
import { createCompletion } from '$lib/server/llm';

export async function POST({ request }) {
  const { prompt } = await request.json();
  
  const response = await createCompletion({
    messages: [{ role: 'user', content: prompt }]
  });
  
  return json({ response });
}
```

### 3. Available Models

Popular models on OpenRouter:
- `openai/gpt-4`
- `openai/gpt-3.5-turbo`
- `anthropic/claude-3-opus-20240229`
- `anthropic/claude-3-sonnet-20240229`
- `google/gemini-pro`
- `meta-llama/llama-2-70b-chat`

## UI Components

### 1. Installing Additional shadcn-svelte Components

```bash
# Install specific components
npx shadcn-svelte@latest add card
npx shadcn-svelte@latest add dialog
npx shadcn-svelte@latest add form
npx shadcn-svelte@latest add input
npx shadcn-svelte@latest add label
npx shadcn-svelte@latest add select
npx shadcn-svelte@latest add textarea
npx shadcn-svelte@latest add toast

# Or install multiple at once
npx shadcn-svelte@latest add card dialog form input
```

### 2. Using Components

```svelte
<!-- src/routes/+page.svelte -->
<script>
  import { Button } from '$lib/components/ui/button';
  import { Card } from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Welcome</Card.Title>
  </Card.Header>
  <Card.Content>
    <Input placeholder="Enter your name" />
    <Button>Submit</Button>
  </Card.Content>
</Card.Root>
```

### 3. Theming

Customize your theme in `src/app.css`:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    /* ... other variables */
  }
  
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark mode variables */
  }
}
```

## Deployment

### Cloudflare Pages Deployment

1. Install Cloudflare adapter:
```bash
npm install -D @sveltejs/adapter-cloudflare
```

2. Update `svelte.config.js`:
```javascript
import adapter from '@sveltejs/adapter-cloudflare';

export default {
  kit: {
    adapter: adapter()
  }
};
```

3. Configure `wrangler.toml` (see deployment guide for details)

4. Deploy:
```bash
npm run build
npx wrangler pages deploy ./build
```

## Customization

### 1. Project Structure

```
src/
├── lib/
│   ├── components/     # Reusable UI components
│   ├── server/         # Server-side utilities
│   │   ├── auth.ts     # Authentication helpers
│   │   ├── db.ts       # Database client
│   │   └── llm.ts      # LLM client
│   ├── stores/         # Svelte stores
│   └── utils/          # Shared utilities
├── routes/
│   ├── api/           # API endpoints
│   ├── auth/          # Auth routes
│   └── (app)/         # App routes (with layout)
```

### 2. Adding New Features

Example: Adding a chat feature

1. Create database schema:
```sql
CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

2. Create API endpoint:
```typescript
// src/routes/api/chat/+server.ts
import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import { createCompletion } from '$lib/server/llm';
import { db } from '$lib/server/db';

export async function POST({ request, locals }) {
  const session = await requireAuth(locals);
  const { message } = await request.json();
  
  // Save user message
  await db.from('chat_messages').insert({
    user_id: session.user.id,
    content: message,
    role: 'user'
  });
  
  // Get AI response
  const response = await createCompletion({
    messages: [{ role: 'user', content: message }]
  });
  
  // Save AI response
  await db.from('chat_messages').insert({
    user_id: session.user.id,
    content: response.content,
    role: 'assistant'
  });
  
  return json({ response: response.content });
}
```

3. Create UI:
```svelte
<!-- src/routes/chat/+page.svelte -->
<script>
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  
  let message = '';
  let messages = [];
  
  async function sendMessage() {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    
    const data = await response.json();
    messages = [...messages, 
      { role: 'user', content: message },
      { role: 'assistant', content: data.response }
    ];
    message = '';
  }
</script>

<div class="max-w-2xl mx-auto p-4">
  <div class="space-y-4 mb-4">
    {#each messages as msg}
      <div class="p-3 rounded {msg.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'}">
        {msg.content}
      </div>
    {/each}
  </div>
  
  <form on:submit|preventDefault={sendMessage} class="flex gap-2">
    <Input bind:value={message} placeholder="Type a message..." />
    <Button type="submit">Send</Button>
  </form>
</div>
```

## Best Practices

### 1. Security

- Never expose sensitive keys in client code
- Use environment variables for all secrets
- Implement proper RLS policies in Supabase
- Validate all user inputs
- Use CSRF protection for forms

### 2. Performance

- Use SvelteKit's built-in preloading
- Implement proper caching strategies
- Optimize images and assets
- Use lazy loading for heavy components
- Minimize bundle size

### 3. Code Organization

- Keep components small and focused
- Use TypeScript for type safety
- Follow the project structure conventions
- Write tests for critical functionality
- Document complex logic

### 4. Development Workflow

1. Use feature branches for new development
2. Write meaningful commit messages
3. Test locally before deploying
4. Use environment-specific configurations
5. Monitor errors and performance in production

## Troubleshooting

### Common Issues

1. **Supabase connection errors**
   - Check your environment variables
   - Ensure your IP is whitelisted in Supabase

2. **Build errors**
   - Clear `.svelte-kit` directory
   - Delete `node_modules` and reinstall
   - Check for TypeScript errors

3. **Authentication issues**
   - Verify Supabase auth settings
   - Check redirect URLs
   - Ensure cookies are enabled

### Getting Help

- [SvelteKit Documentation](https://kit.svelte.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [OpenRouter Documentation](https://openrouter.ai/docs)
- [shadcn-svelte Documentation](https://www.shadcn-svelte.com)

## Next Steps

1. Customize the theme to match your brand
2. Add your specific business logic
3. Set up monitoring and analytics
4. Configure CI/CD pipelines
5. Launch your application!

Remember to remove any example code and customize the template to fit your specific needs. 