# Cursor Agent Web Demo

This Next.js application provides a web interface for interacting with the Cursor Agent API, replicating the functionality of the CLI demo in a browser.

## Features

- 🎯 Interactive prompt input
- 🔄 Real-time streaming responses
- 🤔 Thinking process visualization
- 🔧 Tool call execution tracking
- 📝 Summary display
- 💬 Chat-like interface

## Setup

1. **Install dependencies** (already done):
   ```bash
   pnpm install
   ```

2. **Set up your Cursor API Key**:
   
   Create a `.env.local` file in the project root:
   ```bash
   echo "CURSOR_API_KEY=your_api_key_here" > .env.local
   ```
   
   Replace `your_api_key_here` with your actual Cursor API key from https://app.cursor.sh

3. **Run the development server**:
   ```bash
   pnpm dev
   ```

4. **Open your browser**:
   Navigate to http://localhost:3088

## How It Works

### API Route (`/app/api/agent/route.ts`)
- Accepts POST requests with a message and optional model parameter
- Creates a CursorAgent instance with your API key
- Streams responses back to the client using Vercel AI SDK
- Sends structured data for thinking, tool calls, and summaries

### Frontend (`/app/page.tsx`)
- Uses the `useChat` hook from Vercel AI SDK
- Displays real-time updates as they stream in
- Shows:
  - User prompts
  - Agent thinking process
  - Tool calls with arguments and results
  - Assistant responses
  - Summaries

## Example Prompts

Try these prompts to see the agent in action:

- "List files in this directory"
- "Read the package.json file"
- "Create a new file called hello.txt with the content 'Hello World'"
- "What files are in the app directory?"
- "Count the number of lines in page.tsx"

## Tech Stack

- **Next.js 16** - React framework
- **React 19** - UI library
- **Tailwind CSS 4** - Styling
- **@cursor-ai/january** - Cursor Agent SDK
- **Vercel AI SDK** - Streaming AI responses
- **Lucide React** - Icons

## Comparison with CLI Demo

This web demo provides the same functionality as the original CLI script:

| Feature | CLI Demo | Web Demo |
|---------|----------|----------|
| Stream responses | ✅ Console | ✅ Browser UI |
| Show thinking | ✅ Text | ✅ Purple card |
| Display tool calls | ✅ Text | ✅ Styled cards |
| Show results | ✅ Text | ✅ Formatted JSON |
| Interactive | ❌ Run once | ✅ Continuous chat |

## Environment Variables

- `CURSOR_API_KEY` (required) - Your Cursor API key
- `AGENT_MODEL` (optional) - Model to use (default: claude-4-sonnet)

## Notes

- The API route has a 300-second timeout for long-running agent tasks
- Tool call results are displayed with syntax highlighting
- The interface auto-scrolls to show new messages
- All agent operations run in your local directory context

