# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development

```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run preview       # Preview production build
npm run check         # Type checking and validation
npm run check:watch   # Type checking in watch mode
```

### Code Quality

```bash
npm run format        # Format code with Prettier
npm run lint          # Run linting (Prettier + ESLint)
```

### Deployment

```bash
npm run deploy             # Deploy to Cloudflare Pages (production)
npm run deploy:preview     # Deploy to Cloudflare Pages (preview)
npm run cf:login          # Login to Cloudflare
npm run cf:dev            # Local development with Cloudflare
```

### Component Management

```bash
npm run shadcn:add <component>  # Add shadcn-svelte components
# Example: npm run shadcn:add card dialog form
```

## Architecture Overview

### Tech Stack

- **Framework**: SvelteKit with TypeScript
- **UI Library**: shadcn-svelte components + Tailwind CSS
- **Authentication**: Supabase Auth with cookie-based sessions
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **AI/LLM**: OpenRouter API for multiple model access
- **Deployment**: Cloudflare Pages with edge functions

### Key Directories

```
src/
├── lib/
│   ├── components/ui/    # shadcn-svelte components
│   ├── server/          # Server-side utilities
│   │   ├── auth.ts      # Authentication helpers
│   │   ├── llm.ts       # OpenRouter LLM client
│   │   └── supabase.ts  # Database client
│   ├── stores/          # Svelte stores
│   └── utils/           # Shared utilities
├── routes/
│   ├── +layout.server.ts # Global auth handling
│   ├── api/             # API endpoints
│   │   ├── chat/        # Chat completion endpoint
│   │   └── completion/  # Text completion endpoint
│   └── auth/            # Authentication routes
└── hooks.server.ts      # Server hooks for auth
```

## Authentication System

### Session Management

- Uses Supabase Auth with httpOnly cookies (`sb-access-token`, `sb-refresh-token`)
- Sessions automatically refresh and are available in `event.locals.session`
- User profiles stored in `profiles` table with RLS policies

### Key Functions (src/lib/server/auth.ts)

- `getSession(event)` - Get current session from request
- `requireAuth(event)` - Require authentication (redirects to login)
- `getUserProfile(userId)` - Get user profile from database
- `setAuthCookies(event, session)` - Set authentication cookies

### Database Schema

```sql
-- Required profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## LLM Integration

### OpenRouter Client (src/lib/server/llm.ts)

- Supports multiple AI models through OpenRouter API
- Handles both streaming and non-streaming completions
- Includes token estimation and message truncation

### Key Functions

- `createCompletion(request)` - Standard completion
- `createCompletionStream(request)` - Streaming completion
- `generateText(prompt, systemPrompt?, model?)` - Simple text generation
- `getAvailableModels()` - List available models
- `truncateMessages(messages, maxTokens)` - Prevent token limit issues

### API Endpoints

- `/api/chat` - Chat completions with conversation history
- `/api/completion` - Simple text completions

## Development Workflow

### Adding shadcn-svelte Components

```bash
# List available components
npx shadcn-svelte@latest add

# Add specific components
npx shadcn-svelte@latest add button card input dialog
```

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

- `OPENROUTER_API_KEY` - Get from https://openrouter.ai/keys
- `PUBLIC_SUPABASE_URL` - Supabase project URL
- `PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

### Authentication Flow

1. User visits protected route
2. `hooks.server.ts` gets session from cookies
3. Session stored in `event.locals.session`
4. Routes can use `requireAuth()` to enforce authentication
5. Failed auth redirects to `/auth/login`

### Adding New Routes

1. Create route in `src/routes/`
2. Use `export async function load({ locals })` for auth-aware pages
3. Call `requireAuth(event)` for protected routes
4. Access user via `locals.session.user`

## Testing and Validation

### Type Checking

- Run `npm run check` before committing
- Use `npm run check:watch` during development
- TypeScript configured with strict settings

### Code Quality

- Always run `npm run lint` before committing
- Prettier handles formatting automatically
- ESLint configured for Svelte + TypeScript

## Deployment Notes

### Cloudflare Pages Setup

- Uses `@sveltejs/adapter-cloudflare`
- Build output: `.svelte-kit/cloudflare`
- Environment variables set in Cloudflare dashboard
- Functions deployed as edge functions

### Production Checklist

1. Set environment variables in Cloudflare dashboard
2. Configure custom domain (optional)
3. Set up Supabase database with RLS policies
4. Test authentication flow
5. Verify API endpoints work with OpenRouter

### Common Issues

- **Build failures**: Check Node.js version (18+) and dependencies
- **Auth issues**: Verify Supabase keys and redirect URLs
- **API errors**: Check OpenRouter API key and model availability
- **Type errors**: Run `npm run check` to identify issues

## Architecture Patterns

### Server-Side Operations

- All database operations use server-side functions
- API endpoints validate authentication
- Use `supabaseAdmin` for bypassing RLS when needed

### Client-Side State

- Minimal client-side auth state
- Use Svelte stores for app state
- Leverage SvelteKit's load functions for data fetching

### Error Handling

- API endpoints return proper HTTP status codes
- Client-side error handling with toast notifications
- Server errors logged but not exposed to client

## Security Considerations

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client
- Use Row Level Security for all database access
- Validate all user inputs on server side
- Use httpOnly cookies for session management
- Environment variables properly configured for each environment
