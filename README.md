# Multi-Repo Agent Manager

A Next.js web application that leverages the Cursor SDK to manage and maintain multiple code repositories in parallel using AI agents.

## 🌟 Features

- **Repository Scanner**: Automatically discover Node.js/JavaScript projects in any directory
- **Parallel Agent Execution**: Run multiple AI agents simultaneously, each in its own repository workspace
- **Pre-built Actions**: One-click maintenance tasks (TypeScript migration, framework upgrades, documentation, dependency updates)
- **Real-time Streaming**: Watch agent activity live via Server-Sent Events
- **Persistent Chat History**: All tasks and conversations are saved locally using SQLite - restart the app without losing progress
- **Multi-turn Conversations**: Continue conversations with agents across sessions

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and pnpm installed
- Cursor API key from [https://app.cursor.sh](https://app.cursor.sh)

### Installation

1. Clone the repository and install dependencies:

```bash
pnpm install
```

2. Set up your Cursor API Key:

Create a `.env.local` file in the project root:

```bash
echo "CURSOR_API_KEY=your_api_key_here" > .env.local
```

Replace `your_api_key_here` with your actual Cursor API key.

3. Run the development server:

```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📊 Data Persistence

All task data is automatically persisted using **SQLite**, a lightweight, file-based database perfect for local applications.

### Storage Location

- Database file: `~/.cursor-sdk-manager/tasks.db`
- Stored in your home directory, outside the project folder
- Persists across app restarts and system reboots

### What's Stored

- ✅ All agent tasks (status, timestamps, metadata)
- ✅ Complete chat history (messages, tool calls, thinking)
- ✅ Terminal output and activity logs
- ✅ Token usage statistics

### Benefits

- **No data loss**: Restart the app anytime without losing work
- **Fast**: SQLite is optimized for local read/write operations
- **Simple**: No database server setup required
- **Portable**: Single `.db` file you can backup or move
- **Concurrent**: Multiple tasks can save data simultaneously

### Database Management

The database is automatically created on first run. No manual setup needed!

To reset your data, simply delete the database file:

```bash
rm ~/.cursor-sdk-manager/tasks.db
```

## 💡 Usage

### 1. Scan for Repositories

- Select a root directory (e.g., `~/dev`, `~/projects`)
- Click "Scan" to discover all Node.js projects
- View detected projects with their framework and TypeScript status

### 2. Run Actions

Choose from 5 pre-built actions for any repository:

- **Upgrade to TypeScript**: Convert JavaScript projects to TypeScript
- **Upgrade Framework**: Update Next.js, React, Vue, etc. to latest version
- **Summarize Codebase**: Generate comprehensive README.md
- **Update Dependencies**: Upgrade outdated packages
- **Custom Prompt**: Run any custom maintenance task

### 3. Monitor Progress

- View real-time agent output in the center panel
- Switch between multiple running tasks using tabs
- See thinking process, tool calls, and responses
- Track token usage and completion status

## 🏗️ Architecture

### Tech Stack

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Modern styling
- **@cursor-ai/january** - Cursor Agent SDK
- **better-sqlite3** - Fast, synchronous SQLite database
- **Lucide React** - Icons

### Key Components

- `/app/page.tsx` - Main UI with repo scanner, agent view, and task sidebar
- `/app/api/agent/route.ts` - Agent execution API with SSE streaming
- `/app/api/tasks/` - Task persistence endpoints
- `/lib/db.ts` - SQLite database operations
- `/lib/types.ts` - TypeScript type definitions

### Data Flow

1. User selects directory → Scanner finds repos → Display in list
2. User clicks action → Create task → Save to DB
3. Agent spawns in repo directory → Stream updates → Save to DB
4. Real-time UI updates → Task tracked in sidebar → Persisted on disk
5. On restart → Load tasks from DB → Restore complete state

## 🔧 API Endpoints

- `POST /api/scan-repos` - Scan directory for repositories
- `POST /api/agent` - Create/run Cursor agent with working directory
- `GET /api/tasks` - Load all persisted tasks
- `POST /api/tasks/save` - Save or update a task
- `DELETE /api/tasks/:id` - Delete a specific task
- `DELETE /api/tasks` - Clear all completed tasks

## 🎯 Use Cases

- Maintain multiple side projects simultaneously
- Migrate several repos to TypeScript in parallel
- Generate documentation for forgotten projects
- Keep dependencies up-to-date across your portfolio
- Run custom automation tasks on multiple codebases

## 📝 Notes

- Designed for **local laptop usage**, not for deployment to Vercel
- Each agent runs in an **isolated workspace directory**
- Agents can work on **completely different codebases** simultaneously
- Chat history persists **across restarts** - pick up where you left off
- Task data is **debounced** to minimize database writes during streaming

## 🔐 Privacy & Security

All data is stored locally on your machine. Nothing is sent to external databases or cloud storage (except API calls to Cursor for AI functionality).
