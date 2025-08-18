# Cloudflare Pages Deployment Guide

This guide walks you through deploying your SvelteKit Accelerator to Cloudflare Pages.

## Prerequisites

- A Cloudflare account (free tier is sufficient)
- Your repository pushed to GitHub/GitLab
- Environment variables ready (from your `.env.local` file)

## Method 1: Dashboard Setup (Recommended)

### Step 1: Create Cloudflare Pages Project

1. **Log into Cloudflare Dashboard**
   - Go to [dash.cloudflare.com](https://dash.cloudflare.com)
   - Navigate to **Pages** in the sidebar

2. **Create a new project**
   - Click **Create a project**
   - Choose **Connect to Git**

3. **Connect your repository**
   - Authorize Cloudflare to access your GitHub/GitLab
   - Select your `sveltekit-accelerator` repository

### Step 2: Configure Build Settings

Set the following build configuration:

```
Framework preset: None (or SvelteKit if available)
Build command: npm run build
Build output directory: .svelte-kit/cloudflare
Root directory: / (leave empty)
```

**Advanced settings:**
- Node.js version: `18` or `20`
- Environment variables: `NODE_ENV=production`

### Step 3: Set Environment Variables

In the **Settings** > **Environment variables** section, add these variables:

#### Required Variables
```
OPENROUTER_API_KEY=your_openrouter_api_key
PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

#### App Configuration
```
PUBLIC_APP_URL=https://your-project-name.pages.dev
PUBLIC_APP_NAME=SvelteKit Accelerator
```

#### Optional Variables
```
JWT_SECRET=your_secure_jwt_secret
MAX_FILE_SIZE=52428800
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf
DEBUG=false
NODE_ENV=production
```

### Step 4: Deploy

1. Click **Save and Deploy**
2. Cloudflare will build and deploy your app
3. Your app will be available at `https://your-project-name.pages.dev`

### Step 5: Configure Custom Domain (Optional)

1. Go to **Custom domains** in your Pages project
2. Click **Set up a custom domain**
3. Enter your domain name
4. Follow the DNS configuration instructions

## Method 2: CLI Deployment

### Prerequisites

1. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**
   ```bash
   npm run cf:login
   # or
   wrangler login
   ```

### Deploy Commands

```bash
# Deploy to production
npm run deploy

# Deploy to preview
npm run deploy:preview

# Local development with Cloudflare
npm run cf:dev
```

## Environment Configuration

### Production Environment Variables

Set these in the Cloudflare Dashboard under **Pages** > **Settings** > **Environment variables**:

```env
# Required for all environments
OPENROUTER_API_KEY=your_openrouter_api_key
PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Production-specific
PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
DEBUG=false
```

### Preview Environment Variables

For preview deployments, you can set different values:

```env
PUBLIC_APP_URL=https://preview-branch.your-project.pages.dev
DEBUG=true
```

## Deployment Branches

### Production Branch
- **Branch**: `main`
- **URL**: `https://your-project-name.pages.dev`
- **Environment**: Production variables

### Preview Branches
- **Branches**: Any branch other than `main`
- **URL**: `https://branch-name.your-project.pages.dev`
- **Environment**: Preview variables (if configured)

## Build Configuration

The project is configured with:

- **Adapter**: `@sveltejs/adapter-cloudflare`
- **Build output**: `.svelte-kit/cloudflare`
- **Node.js compatibility**: Edge runtime compatible

### Wrangler Configuration

The `wrangler.toml` file contains:

```toml
name = "sveltekit-accelerator"
compatibility_date = "2024-01-01"

[build]
command = "npm run build"

[vars]
PUBLIC_APP_NAME = "SvelteKit Accelerator"

[env.production]
vars = { PUBLIC_APP_URL = "https://your-domain.com" }

[env.preview]
vars = { PUBLIC_APP_URL = "https://preview.your-project.pages.dev" }
```

## Troubleshooting

### Common Issues

1. **Build fails with module errors**
   - Ensure all dependencies are in `dependencies`, not `devDependencies`
   - Check Node.js version is 18+

2. **Environment variables not working**
   - Verify variables are set in Cloudflare Dashboard
   - Check variable names match exactly (case-sensitive)
   - Redeploy after adding variables

3. **Database connection issues**
   - Verify Supabase URLs and keys
   - Check Row Level Security policies
   - Ensure Supabase project is not paused

4. **File upload errors**
   - Check storage bucket configuration
   - Verify CORS settings in Supabase
   - Ensure proper file size limits

### Performance Optimization

1. **Enable caching**
   - Static assets are automatically cached
   - API responses can be cached with headers

2. **Optimize images**
   - Use WebP format when possible
   - Implement responsive images

3. **Database optimization**
   - Use proper indexes
   - Implement query optimization
   - Consider edge caching for static data

## Monitoring and Analytics

### Cloudflare Analytics

Access deployment analytics in the Cloudflare Dashboard:
- **Pages Analytics**: Traffic, performance metrics
- **Real User Monitoring**: Core Web Vitals
- **Security Events**: Attack monitoring

### Application Analytics

The app includes built-in analytics:
- API usage tracking
- User activity monitoring
- Storage usage metrics
- Error tracking

Access via `/api/analytics` endpoint or implement a dashboard.

## Custom Domains and SSL

### Setting up Custom Domain

1. **Add domain in Cloudflare Pages**
   - Go to Custom domains
   - Add your domain
   - Choose between Cloudflare nameservers or CNAME

2. **DNS Configuration**
   - If using Cloudflare nameservers: automatic
   - If using external DNS: add CNAME record

3. **SSL Certificate**
   - Automatically provisioned by Cloudflare
   - Full (strict) SSL mode recommended

## Security Considerations

### Environment Variables
- Never commit secrets to version control
- Use different keys for preview/production
- Rotate keys regularly

### Supabase Security
- Enable Row Level Security
- Use service role key only on server side
- Configure CORS properly

### Cloudflare Security
- Enable Bot Fight Mode
- Configure WAF rules if needed
- Monitor security events

## Support

For deployment issues:
1. Check Cloudflare Pages documentation
2. Review build logs in dashboard
3. Test locally with `npm run cf:dev`
4. Check Supabase status and configuration