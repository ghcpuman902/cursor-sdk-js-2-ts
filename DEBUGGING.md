# Debugging Guide - Cursor SDK Multi-Repo Agent Manager

## Known Issues

### HTTP/2 Stream Errors (NGHTTP2_INTERNAL_ERROR)

**Symptoms:**
```
⨯ unhandledRejection: [internal] Stream closed with error code NGHTTP2_INTERNAL_ERROR
```

**What it means:**
- The Cursor SDK's HTTP/2 connection to their backend API was interrupted
- This is an issue with the SDK's connection, not your code
- The agent's stream was terminated unexpectedly

**Common causes:**
1. **Timeout** - The agent took too long (> 5 minutes)
2. **Rate limiting** - Too many requests to Cursor API
3. **Network issues** - Connection interrupted
4. **API instability** - Cursor's API had an internal error

**What we've done to handle it:**
- ✅ Added proper error catching in stream handlers
- ✅ Added global unhandled rejection handlers
- ✅ Added 5-minute timeout with clear error messages
- ✅ Better error messages sent to UI
- ✅ Detailed logging to identify when/why it happens

## Debugging Tools Added

### 1. Test Page (`/test`)
Simple isolated test environment with no session management to rule out complexity.

**How to use:**
1. Navigate to `http://localhost:3000/test`
2. Enter absolute path (e.g., `/Users/username/project`)
3. Enter simple prompt (e.g., "List files")
4. Open browser console (F12) and watch terminal logs

**What it shows:**
- Every SSE update with detailed info
- HTTP/2 errors if they occur
- Stream progress and completion

### 2. Verbose Logging

**Server logs** (terminal where `pnpm run dev` runs):
```
=== AGENT REQUEST START ===
Message: ...
Session ID: ...
Working Directory: ...
=== STREAM START ===
[Update #1] session
[Update #2] text-delta "Hello..."
[Update #3] tool-call-started (call-123)
...
=== STREAM COMPLETE ===
Total updates: 45
```

**Client logs** (browser console F12):
```
[Task task-123] === STARTING AGENT REQUEST ===
[Task task-123] Session ID: abc-123
[Task task-123] Progress: 10 updates received
[Task task-123] Agent completed successfully
```

### 3. Database Management

**New buttons in Database Info popup:**
- 🔴 **Kill All Agents** - Terminates all active agent sessions
- 🗑️ **Clear All Cache** - Deletes all tasks and scanned repos

**When to use:**
- Kill agents: When agents are stuck or you see HTTP/2 errors
- Clear cache: Fresh start after errors

### 4. Session Management UI

**Indicators added:**
- Green dot + "Session Active" badge in task header
- Green dot in task sidebar tabs
- Full session ID displayed in task tabs (hover to see full ID)
- Message count in chat input footer

## Debugging Checklist

When agent gets stuck or errors:

1. **Check server logs** for HTTP/2 errors
   ```bash
   # Look for:
   NGHTTP2_INTERNAL_ERROR
   Stream closed with error code
   ```

2. **Check browser console** for client-side errors
   ```javascript
   // Look for:
   [Task xxx] Error from agent
   Failed to parse SSE data
   ```

3. **Use test page** to isolate issue
   - Go to `/test`
   - Try simple prompt: "Echo hello world"
   - If this fails = SDK/API issue
   - If this works = session/state management issue

4. **Kill stuck agents**
   - Click "Data Storage" → "Kill All Agents"
   - This clears the agent session cache

5. **Check API key**
   ```bash
   echo $CURSOR_API_KEY
   # Should be set and valid
   ```

## Error Recovery

### If HTTP/2 errors persist:

1. **Wait and retry** - May be temporary API issue
2. **Check Cursor API status** - Visit status page
3. **Reduce concurrency** - Run fewer agents simultaneously
4. **Use test page** - Simpler requests may work

### If agents get stuck (no updates for 30s):

1. **Check terminal** - Look for last update logged
2. **Kill all agents** - Use button in Database Info
3. **Clear cache** - Fresh start
4. **Restart dev server** - `pnpm run dev`

## Session Management

### How it works:
- Each agent creates a session on first message
- Session ID stored in task state
- Follow-up messages reuse the same agent instance
- Sessions auto-expire after 30 minutes of inactivity
- Multiple sessions can exist simultaneously (one per task)

### Session indicators:
- ✅ Green "Session Active" badge = Has active session
- ✅ "• Chat" label in sidebar = Can send follow-ups
- ✅ Session ID shown = Unique agent identifier

## Common Issues

### "Agent gets stuck after tool calls"
**Likely cause:** HTTP/2 timeout or connection error
**Solution:** Check terminal logs, kill agents, retry with simpler prompt

### "Chat input not showing"
**Expected:** Input only shows when session exists (after first agent response)
**Solution:** Wait for first response to complete, session will be created

### "Multiple agents interfering"
**Should not happen:** Each agent has isolated session and working directory
**If it does:** Clear all cache and restart

## Performance Tips

1. **Limit concurrent agents** - 2-3 agents max at once
2. **Use simple prompts** - Complex tasks = longer streams = more timeout risk
3. **Monitor memory** - Each session keeps agent in memory
4. **Clear old sessions** - Use "Clear All Cache" periodically

## Useful Commands

```bash
# Watch server logs in real-time
pnpm run dev | grep "==="

# Check active sessions
curl http://localhost:3000/api/agent

# Kill all agents (alternative to UI button)
curl -X DELETE http://localhost:3000/api/agent

# View database info
curl http://localhost:3000/api/db-info
```

## Next Steps If Issues Continue

1. **Report to Cursor SDK** - HTTP/2 errors are SDK-level issues
2. **Add retry logic** - Automatically retry on connection errors
3. **Implement rate limiting** - Prevent overwhelming API
4. **Add circuit breaker** - Stop sending requests after repeated failures
5. **Use different model** - Try gpt-4 or claude-3 variants

## File Locations

- Main agent route: `app/api/agent/route.ts`
- Test agent route: `app/api/test-agent/route.ts`
- Test page: `app/test/page.tsx`
- Agent view: `app/components/agent-view.tsx`
- Database ops: `lib/db.ts`
