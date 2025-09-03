# Bugbot Review Service Configuration

This document describes the configuration needed for the Bugbot Review Service to function properly.

## Environment Variables

Add the following environment variables to your `.env` file:

### Required Variables

```env
# GitHub Integration
GITHUB_TOKEN=your_github_personal_access_token_here
```

**GITHUB_TOKEN**: A GitHub Personal Access Token with the following permissions:
- `repo` - Full control of private repositories
- `read:org` - Read org and team membership
- `read:user` - Read user profile data

### Optional Variables

```env
# GitHub Webhook (for automatic PR reviews)
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Bugbot Behavior
BUGBOT_AUTO_REVIEW=false
```

**GITHUB_WEBHOOK_SECRET**: Secret used to verify GitHub webhook signatures (recommended for production)

**BUGBOT_AUTO_REVIEW**: Set to `true` to automatically post reviews on PRs, `false` to only analyze without posting

## Database Setup

The service will automatically create the necessary database tables on first run. Make sure your PostgreSQL database is configured with the existing DB_* environment variables.

## GitHub Repository Setup

### 1. GitHub Personal Access Token
1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Create a new token with the required permissions listed above
3. Add the token to your `.env` file as `GITHUB_TOKEN`

### 2. Webhook Setup (Optional)
1. Go to your GitHub repository → Settings → Webhooks
2. Add a new webhook with:
   - **Payload URL**: `https://your-domain.com/api/bugbot/webhook`
   - **Content type**: `application/json`
   - **Secret**: Use the same value as `GITHUB_WEBHOOK_SECRET`
   - **Events**: Select "Pull requests", "Issues", and "Issue comments"

## API Endpoints

### Manual Review
- **GET** `/api/bugbot/repos/{owner}/{repo}/pulls/{prNumber}/issues` - Get issues related to a PR
- **POST** `/api/bugbot/repos/{owner}/{repo}/pulls/{prNumber}/review` - Perform manual review
- **GET** `/api/bugbot/repos/{owner}/{repo}/pulls/{prNumber}/analysis` - Get issue analysis

### Repository Management
- **GET** `/api/bugbot/repos/{owner}/{repo}/issues` - Get repository issues
- **POST** `/api/bugbot/repos/{owner}/{repo}/sync` - Sync issues with GitHub

### Service Management
- **GET** `/api/bugbot/status` - Check service status
- **POST** `/api/bugbot/init` - Initialize database tables
- **GET** `/api/bugbot/docs` - View full API documentation

## Usage Examples

### 1. Initialize the service
```bash
curl -X POST http://localhost:3000/api/bugbot/init
```

### 2. Sync repository issues
```bash
curl -X POST http://localhost:3000/api/bugbot/repos/owner/repo/sync
```

### 3. Review a specific PR
```bash
curl -X POST http://localhost:3000/api/bugbot/repos/owner/repo/pulls/123/review
```

### 4. Get issues related to a PR
```bash
curl http://localhost:3000/api/bugbot/repos/owner/repo/pulls/123/issues
```

## How It Works

1. **Issue Correlation**: The bugbot analyzes PR titles and descriptions to find references to issues using patterns like:
   - `fixes #123`
   - `closes #456`  
   - `resolves #789`
   - Direct references like `#123`

2. **Automatic Reviews**: When a webhook is received for PR events, the bugbot:
   - Fetches related issues
   - Analyzes issue types (bugs, features, priorities)
   - Generates review comments with recommendations
   - Posts the review (if auto-review is enabled)

3. **Manual Operations**: All functionality is also available via REST API for manual triggers and integrations.

## Troubleshooting

### Common Issues

1. **"GitHub token not configured"**
   - Ensure `GITHUB_TOKEN` is set in your `.env` file
   - Verify the token has the required permissions

2. **"Database table not found"**
   - Run the initialization endpoint: `POST /api/bugbot/init`

3. **"No issues found for PR"**
   - The PR might not reference any issues
   - Try syncing repository issues first: `POST /api/bugbot/repos/{owner}/{repo}/sync`

4. **Webhook not working**
   - Verify webhook URL is correct
   - Check if `GITHUB_WEBHOOK_SECRET` matches between GitHub and your environment
   - Ensure the server is accessible from GitHub (not localhost for public repos)

### Logs

Check the application logs for detailed error messages and debugging information. The service logs all webhook events and API operations.
