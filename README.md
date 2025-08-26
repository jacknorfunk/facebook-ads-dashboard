# Voluum Dashboard with Taboola Creative Analysis Engine

A comprehensive Next.js dashboard that integrates with Taboola Backstage API to provide AI-powered creative analysis, performance insights, and automated lifecycle logging with learning capabilities.

## 🎯 Features

### Core Creative Analysis Engine
- **Real-time Creative Performance Analysis** - Live data from Taboola Backstage API
- **AI-Powered Feature Extraction** - Automatic analysis of headlines and images
- **Performance Insights** - Compare creatives against peers with statistical significance
- **Spec-Compliant Recommendations** - Generate headlines and image suggestions validated against current Taboola policies

### Lifecycle Logging & Learning
- **Complete Action Tracking** - Log every test, scale, and pause decision with reasons
- **Outcome Analysis** - Track post-action performance to validate decisions
- **Learning Loop** - Improve future recommendations based on historical outcomes
- **Automated Recommendations** - Rule-based and ML-driven action suggestions

### Authentication & Security
- **NextAuth.js Integration** - Secure session management
- **Password Protection** - Simple password or OAuth authentication
- **Route Protection** - Middleware-based authentication for all routes
- **API Security** - Server-side credential management

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Taboola Backstage API credentials
- Database (SQLite by default, PostgreSQL optional)

### 1. Environment Setup

Copy the environment template:
```bash
cp .env.example .env.local
```

Configure your environment variables:

```env
# Database
DATABASE_URL="file:./dev.db"

# Taboola API Credentials (Required)
TABOOLA_CLIENT_ID="your_taboola_client_id"
TABOOLA_CLIENT_SECRET="your_taboola_client_secret"
TABOOLA_ACCOUNT_ID="your_taboola_account_id"

# Authentication (Required)
NEXTAUTH_SECRET="your_nextauth_secret_key_here"
NEXTAUTH_URL="http://localhost:3000"
DASHBOARD_PASSWORD="your_secure_dashboard_password"

# Optional: OpenAI for enhanced creative analysis
OPENAI_API_KEY="your_openai_api_key"

# Production: PostgreSQL Database (Optional)
# DATABASE_URL="postgresql://username:password@localhost:5432/voluum_dashboard"
```

### 2. Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Initialize database
npm run db:push

# Start development server
npm run dev
```

### 3. Access the Dashboard

Open [http://localhost:3000](http://localhost:3000) and login with:
- Username: `admin`
- Password: `[your DASHBOARD_PASSWORD]`

## 📋 Environment Variables Guide

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TABOOLA_CLIENT_ID` | Your Taboola Backstage API Client ID | `client_12345` |
| `TABOOLA_CLIENT_SECRET` | Your Taboola Backstage API Client Secret | `secret_abcdef` |
| `TABOOLA_ACCOUNT_ID` | Your Taboola Account ID | `account-name` |
| `NEXTAUTH_SECRET` | Secret key for NextAuth.js sessions | `openssl rand -base64 32` |
| `DASHBOARD_PASSWORD` | Password for dashboard access | `your_secure_password` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `file:./dev.db` |
| `OPENAI_API_KEY` | OpenAI API key for enhanced analysis | Not used |
| `NEXTAUTH_URL` | Base URL for NextAuth | `http://localhost:3000` |

## 🔧 Taboola API Setup

### 1. Get API Credentials

1. Log into [Taboola Backstage](https://backstage.taboola.com)
2. Go to Account Settings → API Access
3. Create new API credentials
4. Note down your Client ID, Client Secret, and Account ID

### 2. API Permissions

Ensure your API credentials have access to:
- ✅ Campaign data
- ✅ Item (creative) data  
- ✅ Performance reports
- ✅ Account information

### 3. Test Connection

The dashboard will automatically test your API connection on first load. If you see connection errors:

1. Verify credentials in `.env.local`
2. Check API permissions in Taboola Backstage
3. Ensure your account has active campaigns with data

## 📊 Using the Creative Analysis Engine

### Navigation
- Access via main dashboard → "Creative Analysis Engine"
- Or direct URL: `/creative-engine`

### Key Features

#### Performance Analysis Table
- **Creative Overview** - Thumbnails, headlines, campaign info
- **Insight Chips** - Auto-detected features (faces, numbers, questions, etc.)
- **Performance Metrics** - Spend, CTR, conversions, CPA, ROAS
- **Analysis Score** - AI-generated performance score (0-100)
- **Quick Actions** - Scale, Pause, or view detailed recommendations

#### Lifecycle Logging
- **Action Tracking** - Every scale/pause decision is logged with reasons
- **Real-time Feed** - See recent actions across all creatives
- **Learning Insights** - Patterns identified from historical data
- **Outcome Analysis** - Track post-action performance changes

#### Recommendations Engine
- **Headline Variations** - 12+ spec-compliant headline suggestions
- **Image Optimization** - 8+ image improvement recommendations
- **Validation** - All suggestions checked against current Taboola specs
- **Confidence Scores** - ML-driven confidence ratings for each suggestion

### Filters & Controls
- **Date Range** - 7, 14, or 30 days
- **Sort Options** - By score, spend, CTR, conversions, or ROAS
- **Campaign Filter** - Focus on specific campaigns
- **Lifecycle Panel** - Toggle action history view

## 🗄️ Database Schema

### Core Models

```prisma
model Creative {
  id              String   @id               // Taboola item_id
  campaignId      String
  headline        String
  thumbnailUrl    String
  destinationUrl  String
  
  // Performance aggregates
  aggSpend        Float    @default(0)
  aggImpr         Int      @default(0)
  aggClicks       Int      @default(0)
  aggConv         Int      @default(0)
  aggCpa          Float?
  aggRoas         Float?
  
  // Analysis data
  featuresJson    String?  // Extracted features
  status          String   @default("active")
  
  actions         Action[]
  metricSnapshots MetricSnapshot[]
}

model Action {
  id            String   @id @default(cuid())
  creativeId    String
  type          String   // "tested" | "scaled" | "paused"
  reasonShort   String   // UI chip label
  reasonDetail  String   // Full explanation
  decidedBy     String   // "rule" | "human" | "model"
  decidedAt     DateTime @default(now())
  inputsJson    String?  // Decision inputs
}

model MetricSnapshot {
  id          String   @id @default(cuid())
  creativeId  String
  at          DateTime @default(now())
  spend       Float
  impr        Int
  clicks      Int
  ctr         Float
  cpc         Float
  conv        Int
  cpa         Float?
  roas        Float?
}
```

## 🔧 Configuration & Thresholds

### Learning Configuration

The system maintains configurable thresholds per account:

```typescript
// Default thresholds
{
  targetCpa: 25.0,        // Target cost per acquisition
  targetRoas: 1.3,        // Target return on ad spend
  minSpend: 5.0,          // Minimum spend for analysis
  minConversions: 1,      // Minimum conversions for decisions
  pauseThresholdDays: 3,  // Days of poor performance before pause
  scaleThresholdDays: 2   // Days of good performance before scale
}
```

### Automated Action Rules

#### Scale Conditions
- Spend ≥ minSpend AND Conversions ≥ minConversions
- (CPA ≤ targetCPA) OR (ROAS ≥ targetRoas)
- CTR ≥ peer median AND CVR ≥ peer median
- Optional: Positive feature drivers detected

#### Pause Conditions  
- Spend ≥ minSpend
- (CPA > targetCPA × 1.5) OR (ROAS < targetRoas × 0.7) OR (CTR < 0.5%)
- Poor performance sustained for pauseThresholdDays

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Connect Repository**
   ```bash
   # Push to GitHub/GitLab
   git add .
   git commit -m "Initial dashboard setup"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Connect repository in Vercel dashboard
   - Configure environment variables
   - Deploy automatically

3. **Environment Variables in Vercel**
   ```bash
   # Required in Vercel Environment Variables
   TABOOLA_CLIENT_ID=your_client_id
   TABOOLA_CLIENT_SECRET=your_client_secret
   TABOOLA_ACCOUNT_ID=your_account_id
   NEXTAUTH_SECRET=your_nextauth_secret
   DASHBOARD_PASSWORD=your_dashboard_password
   DATABASE_URL=your_production_database_url
   ```

### Database Setup for Production

#### PostgreSQL (Recommended)
```bash
# 1. Create PostgreSQL database
createdb voluum_dashboard

# 2. Update DATABASE_URL in production
DATABASE_URL="postgresql://username:password@localhost:5432/voluum_dashboard"

# 3. Run migrations
npm run db:push
```

#### Supabase (Alternative)
```bash
# 1. Create Supabase project
# 2. Get connection string from Supabase dashboard
# 3. Update DATABASE_URL
DATABASE_URL="postgresql://postgres:password@db.supabase.co:5432/postgres"
```

## 🔍 API Reference

### Creative Analysis
```typescript
GET /api/taboola/items
  ?start_date=2024-01-01
  &end_date=2024-01-08
  &analyze=true
  &update_lifecycle=true
```

### Lifecycle Actions
```typescript
POST /api/lifecycle/action
{
  "creativeId": "item_123",
  "type": "scaled",
  "reasonShort": "Strong ROAS",
  "reasonDetail": "ROAS 2.1x above target 1.3x for 3 days",
  "decidedBy": "human"
}
```

### Specs Validation
```typescript
POST /api/specs
{
  "type": "headline",
  "content": "Amazing Deals - Save 50% Today!"
}
```

## 🛠️ Development

### Project Structure
```
├── pages/
│   ├── api/                 # API endpoints
│   │   ├── auth/           # NextAuth configuration
│   │   ├── taboola/        # Taboola API integration
│   │   └── lifecycle/      # Action logging endpoints
│   ├── creative-engine.tsx # Main analysis dashboard
│   ├── login.tsx          # Authentication page
│   └── index.tsx          # Main dashboard
├── lib/
│   ├── taboolaClient.ts   # Taboola API client
│   ├── analysisEngine.ts  # Creative analysis logic
│   ├── specsClient.ts     # Taboola specs validation
│   └── lifecycle.ts       # Action logging & learning
├── prisma/
│   └── schema.prisma      # Database schema
└── styles/
    └── globals.css        # Global styles
```

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:push      # Push schema to database
npm run db:migrate   # Run database migrations
```

## 🔒 Security Considerations

### API Security
- ✅ Server-side credential storage
- ✅ Token-based authentication with auto-refresh
- ✅ Request/response validation
- ✅ Rate limiting considerations

### Authentication Security
- ✅ NextAuth.js session management
- ✅ CSRF protection
- ✅ Secure cookie settings
- ✅ Password hashing support

### Data Protection
- ✅ Environment variable isolation
- ✅ No sensitive data in client-side code
- ✅ Database connection encryption
- ✅ API endpoint authentication

## 📈 Performance Optimization

### Data Fetching
- **Incremental Loading** - Load analysis data progressively
- **Smart Caching** - Cache Taboola specs and frequent queries
- **Parallel Requests** - Fetch multiple data sources simultaneously
- **Error Boundaries** - Graceful degradation on API failures

### UI Performance
- **Virtual Scrolling** - Handle large creative lists efficiently
- **Lazy Loading** - Load recommendations and details on demand
- **Optimistic Updates** - Immediate UI feedback for user actions
- **Responsive Design** - Mobile-optimized interface

## 🐛 Troubleshooting

### Common Issues

#### "Taboola API connection failed"
1. Verify `TABOOLA_CLIENT_ID`, `TABOOLA_CLIENT_SECRET`, and `TABOOLA_ACCOUNT_ID`
2. Check API permissions in Taboola Backstage
3. Ensure account has active campaigns with data
4. Verify network connectivity to Taboola API

#### "Database connection error"
1. Check `DATABASE_URL` format
2. Ensure database exists and is accessible
3. Run `npm run db:push` to sync schema
4. Verify database permissions

#### "Authentication not working"
1. Set `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`)
2. Verify `DASHBOARD_PASSWORD` is set
3. Clear browser cookies and try again
4. Check `NEXTAUTH_URL` matches your domain

#### "No analysis data showing"
1. Verify Taboola account has recent campaign data
2. Check date range filters (default: last 7 days)
3. Ensure campaigns have items with sufficient spend/conversions
4. Check browser console for API errors

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
DEBUG=taboola:*
```

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Standards
- TypeScript for type safety
- ESLint for code quality
- Prettier for formatting
- Conventional commits

## 📄 License

This project is private and confidential. Unauthorized copying, distribution, or modification is prohibited.

## 📞 Support

For technical support or questions:
1. Check the troubleshooting section above
2. Review Taboola API documentation
3. Contact the development team

---

**Built with Next.js, TypeScript, Prisma, and Tailwind CSS**