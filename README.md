# SvelteKit Accelerator ⚡

A modern, production-ready boilerplate for building full-stack web applications with SvelteKit, featuring AI/LLM integration, authentication, and cloud deployment.

## 🚀 Features

- **🎨 UI Components**: Pre-configured with [shadcn-svelte](https://www.shadcn-svelte.com/) for beautiful, accessible components
- **🤖 AI/LLM Integration**: OpenRouter API integration for AI-powered features
- **🔐 Authentication**: Supabase Auth with secure user management
- **💾 Database & Storage**: Supabase for PostgreSQL database and file storage
- **☁️ Cloud Deployment**: Configured for Cloudflare Pages deployment
- **📝 TypeScript**: Full type safety throughout the application
- **🎯 Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **🧪 Testing Ready**: Pre-configured testing setup
- **📱 Responsive**: Mobile-first design approach

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- Node.js 18+
- npm or pnpm
- Git

## 🛠️ Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/feraldolim/sveltekit-accelerator.git
   cd sveltekit-accelerator
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Then edit `.env.local` with your API keys and configuration.

4. **Start the development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env.local` and configure the following:

```env
# OpenRouter API Configuration
OPENROUTER_API_KEY=your_openrouter_api_key

# Supabase Configuration
PUBLIC_SUPABASE_URL=your_supabase_project_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Application Configuration
PUBLIC_APP_URL=http://localhost:5173
```

## 📚 Documentation

- [Implementation Guide](./docs/IMPLEMENTATION_GUIDE.md) - Detailed setup and customization instructions
- [Deployment Guide](./docs/DEPLOYMENT.md) - Instructions for deploying to Cloudflare Pages
- [API Documentation](./docs/API.md) - API endpoints and usage
- [Component Library](./docs/COMPONENTS.md) - Available UI components

## 🏗️ Project Structure

```
sveltekit-accelerator/
├── src/
│   ├── lib/
│   │   ├── components/     # Reusable components
│   │   ├── server/         # Server-side utilities
│   │   ├── stores/         # Svelte stores
│   │   └── utils/          # Utility functions
│   ├── routes/             # SvelteKit routes
│   └── app.html            # App template
├── static/                 # Static assets
├── wrangler.toml          # Cloudflare configuration
└── package.json           # Dependencies
```

## 🚀 Deployment

This template is configured for easy deployment to Cloudflare Pages. See the [Deployment Guide](./docs/DEPLOYMENT.md) for detailed instructions.

Quick deploy:

```bash
npm run build
npx wrangler pages deploy ./build
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [SvelteKit](https://kit.svelte.dev/) - The web framework
- [shadcn-svelte](https://www.shadcn-svelte.com/) - UI components
- [Supabase](https://supabase.com/) - Backend as a Service
- [OpenRouter](https://openrouter.ai/) - LLM API gateway
- [Cloudflare Pages](https://pages.cloudflare.com/) - Deployment platform

## 📧 Support

For support, please open an issue in the GitHub repository or reach out to the community.
