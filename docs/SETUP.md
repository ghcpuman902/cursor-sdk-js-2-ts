# Setup Guide

Quick setup guide for Multi-Repo Agent Manager.

## Prerequisites

- **Node.js 18+**: [Download](https://nodejs.org/)
- **pnpm**: [Install](https://pnpm.io/installation)
- **Cursor API Key**: [Get from app.cursor.sh](https://app.cursor.sh/settings)

## Installation Steps

### 1. Clone Repository

```bash
git clone https://github.com/cursor-ai/multi-repo-agent-manager.git
cd multi-repo-agent-manager
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

Copy the example file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Cursor API key:

```bash
CURSOR_API_KEY=your_actual_api_key_here
```

**Getting your API key:**
1. Go to [https://app.cursor.sh/settings](https://app.cursor.sh/settings)
2. Navigate to API Keys section
3. Generate a new API key
4. Copy and paste into `.env.local`

### 4. Run Development Server

```bash
pnpm run dev
```

### 5. Grant Permissions

When you run the app for the first time, your terminal or IDE will prompt you to grant access to your home folder. This is required for agents to work on your repositories.

**⚠️ Security Notice:** See [SECURITY.md](../SECURITY.md) for important information about restricting agent access.

### 6. Open Browser

Navigate to:

```
http://localhost:3088
```

## Configuration

### Restrict Agent Access (Recommended)

By default, agents can access your entire home directory. To restrict this:

1. Open `app/api/agent/route.ts`
2. Find the line with: `// Gets ~/Users/username on Mac, C:\Users\username on Windows`
3. Replace with your preferred path:

```typescript
const workingDirectory = path.resolve('/path/to/your/safe/folder', repo.path);
```

Example:
```typescript
// Restrict to only ~/dev/ai-projects
const workingDirectory = path.resolve(os.homedir(), 'dev/ai-projects', repo.path);
```

### Change Port

If port 3088 is already in use, edit `package.json`:

```json
"scripts": {
  "dev": "next dev --port 3000"
}
```

## Troubleshooting

### "CURSOR_API_KEY is not set"

- Check that `.env.local` exists in the project root
- Verify the API key is correctly pasted
- Restart the development server after adding the key

### "Permission denied" errors

- Grant folder access when prompted by your terminal/IDE
- On macOS: System Settings > Privacy & Security > Files and Folders
- On Windows: Check folder permissions

### Port already in use

```bash
# Kill process on port 3088
lsof -ti:3088 | xargs kill -9

# Or change port in package.json
```

### Database errors

Delete and recreate the database:

```bash
rm ~/.cursor-sdk-manager/tasks.db
```

The app will create a new database on next startup.

## Next Steps

1. Scan for repositories in a directory
2. Test with a non-critical project first
3. Review changes made by agents before committing
4. Explore different pre-built actions

See the main [README.md](../README.md) for usage instructions.
