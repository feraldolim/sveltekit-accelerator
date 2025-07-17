# Cloudflare Pages Deployment Guide

This guide walks you through deploying your SvelteKit Accelerator application to Cloudflare Pages.

## Prerequisites

1. A [Cloudflare account](https://dash.cloudflare.com/sign-up)
2. [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
3. Your application ready for deployment

## Installation

### 1. Install Cloudflare Adapter

First, install the SvelteKit Cloudflare adapter:

```bash
npm install -D @sveltejs/adapter-cloudflare
```

### 2. Update SvelteKit Configuration

Update your `svelte.config.js`:

```javascript
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // See below for options
      routes: {
        include: ['/*'],
        exclude: ['<all>']
      }
    })
  }
};

export default config;
```

### 3. Install Wrangler

```bash
npm install -D wrangler
```

Add deployment scripts to `package.json`:

```json
{
  "scripts": {
    "deploy": "npm run build && wrangler pages deploy .svelte-kit/cloudflare",
    "deploy:preview": "npm run build && wrangler pages deploy .svelte-kit/cloudflare --branch=preview",
    "cf:login": "wrangler login"
  }
}
```

## Deployment Methods

### Method 1: GitHub Integration (Recommended)

1. **Connect Repository**
   - Go to [Cloudflare Pages Dashboard](https://dash.cloudflare.com/?to=/:account/pages)
   - Click "Create a project" → "Connect to Git"
   - Authorize Cloudflare to access your GitHub account
   - Select your repository

2. **Configure Build Settings**
   - Framework preset: `SvelteKit`
   - Build command: `npm run build`
   - Build output directory: `.svelte-kit/cloudflare`
   - Root directory: `/` (or your project path)

3. **Environment Variables**
   - Click "Environment variables"
   - Add all variables from `.env.example`
   - Set different values for preview and production

4. **Deploy**
   - Click "Save and Deploy"
   - Cloudflare will build and deploy your application

### Method 2: Direct Upload with Wrangler

1. **Login to Cloudflare**
   ```bash
   npx wrangler login
   ```

2. **Create Pages Project**
   ```bash
   npx wrangler pages project create sveltekit-accelerator
   ```

3. **Deploy**
   ```bash
   # Production deployment
   npm run deploy

   # Preview deployment
   npm run deploy:preview
   ```

### Method 3: CI/CD Pipeline

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Cloudflare Pages

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'npm'
      
      - run: npm ci
      - run: npm run build
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: sveltekit-accelerator
          directory: .svelte-kit/cloudflare
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
          branch: ${{ github.ref == 'refs/heads/main' && 'main' || 'preview' }}
```

## Environment Variables

### Setting Environment Variables

1. **Via Dashboard**
   - Navigate to your Pages project
   - Go to Settings → Environment variables
   - Add each variable for both production and preview

2. **Via Wrangler** (secrets only)
   ```bash
   npx wrangler pages secret put OPENROUTER_API_KEY
   npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY
   ```

### Required Variables

```env
# Public variables (available in browser)
PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
PUBLIC_APP_URL=https://your-project.pages.dev
PUBLIC_APP_NAME=Your App Name

# Secret variables (server-only)
OPENROUTER_API_KEY=sk-or-v1-...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
JWT_SECRET=your-secret-key
```

## Advanced Configuration

### Custom Domains

1. **Add Custom Domain**
   - Go to your Pages project → Custom domains
   - Click "Add custom domain"
   - Enter your domain (e.g., `app.yourdomain.com`)
   - Follow DNS configuration instructions

2. **SSL/TLS**
   - Cloudflare automatically provisions SSL certificates
   - Ensure SSL/TLS mode is set to "Full" or "Full (strict)"

### Cloudflare Services Integration

#### D1 Database (SQLite)

1. Create database:
   ```bash
   npx wrangler d1 create sveltekit-accelerator-db
   ```

2. Update `wrangler.toml`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "sveltekit-accelerator-db"
   database_id = "your-database-id"
   ```

3. Access in your app:
   ```typescript
   export async function load({ platform }) {
     const db = platform?.env?.DB;
     const result = await db?.prepare('SELECT * FROM users').all();
     return { users: result?.results ?? [] };
   }
   ```

#### R2 Storage

1. Create bucket:
   ```bash
   npx wrangler r2 bucket create sveltekit-accelerator-storage
   ```

2. Update `wrangler.toml`:
   ```toml
   [[r2_buckets]]
   binding = "STORAGE"
   bucket_name = "sveltekit-accelerator-storage"
   ```

3. Use in your app:
   ```typescript
   export async function POST({ request, platform }) {
     const formData = await request.formData();
     const file = formData.get('file') as File;
     
     await platform?.env?.STORAGE.put(file.name, file);
     
     return json({ success: true });
   }
   ```

#### KV Namespace (Key-Value Storage)

1. Create namespace:
   ```bash
   npx wrangler kv:namespace create CACHE
   ```

2. Update `wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "CACHE"
   id = "your-namespace-id"
   ```

3. Use for caching:
   ```typescript
   export async function load({ platform, setHeaders }) {
     const cache = platform?.env?.CACHE;
     
     const cached = await cache?.get('data', 'json');
     if (cached) {
       setHeaders({ 'cache-control': 'max-age=300' });
       return cached;
     }
     
     const data = await fetchData();
     await cache?.put('data', JSON.stringify(data), { expirationTtl: 300 });
     
     return data;
   }
   ```

### Performance Optimization

1. **Enable Auto Minify**
   - Dashboard → Speed → Optimization
   - Enable JavaScript, CSS, and HTML minification

2. **Configure Caching**
   ```typescript
   // In your routes
   export async function load({ setHeaders }) {
     setHeaders({
       'cache-control': 'public, max-age=3600',
     });
     // ...
   }
   ```

3. **Use Cloudflare CDN**
   - Static assets are automatically served from Cloudflare's edge network
   - Configure Page Rules for custom caching behavior

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version (must be 18+)
   - Verify all dependencies are installed
   - Check build logs in Cloudflare dashboard

2. **Environment Variable Issues**
   - Ensure all required variables are set
   - Use correct prefixes (PUBLIC_ for client-side)
   - Check variable names match exactly

3. **Function Size Limits**
   - Cloudflare Pages Functions have a 1MB limit
   - Optimize dependencies and bundle size
   - Use dynamic imports for large libraries

4. **API Route Errors**
   - Check function logs in Cloudflare dashboard
   - Verify API endpoints use correct paths
   - Ensure proper error handling

### Debugging

1. **Local Testing with Wrangler**
   ```bash
   npx wrangler pages dev .svelte-kit/cloudflare
   ```

2. **View Logs**
   - Real-time logs: Dashboard → Functions → Real-time logs
   - Or use: `npx wrangler pages deployment tail`

3. **Preview Deployments**
   - Each PR creates a preview deployment
   - Test changes before merging to production

## Monitoring

1. **Analytics**
   - Built-in analytics in Cloudflare dashboard
   - Track page views, performance, and errors

2. **Web Analytics**
   ```html
   <!-- Add to app.html -->
   <script defer src='https://static.cloudflareinsights.com/beacon.min.js' 
           data-cf-beacon='{"token": "your-token"}'></script>
   ```

3. **Error Tracking**
   - Integrate with services like Sentry
   - Use Cloudflare's built-in error logging

## Best Practices

1. **Security**
   - Never expose sensitive keys in client code
   - Use environment variables for all secrets
   - Enable Cloudflare WAF for additional protection

2. **Performance**
   - Leverage Cloudflare's edge network
   - Implement proper caching strategies
   - Optimize images with Cloudflare Images

3. **Reliability**
   - Set up health checks
   - Configure custom error pages
   - Use Cloudflare's DDoS protection

## Cost Optimization

- **Free Tier**: 500 builds/month, unlimited requests
- **Optimize Build Frequency**: Use branch protection rules
- **Cache Aggressively**: Reduce function invocations
- **Monitor Usage**: Check dashboard for usage statistics

## Next Steps

1. Set up custom domain
2. Configure Web Analytics
3. Enable additional security features
4. Set up monitoring and alerts
5. Optimize for Core Web Vitals

For more information, refer to:
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [SvelteKit Cloudflare Adapter](https://kit.svelte.dev/docs/adapter-cloudflare)
- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/) 