# Agent Stuck Issue - Fixed

## Problem
The agent was getting "stuck" during execution, showing incomplete tool outputs like `[object Object]` instead of actual results. The stream appeared to freeze mid-execution.

## Root Causes

### 1. **Object Serialization Issue** (Primary Issue)
Tool call results were being converted to strings using `String()`, which produces `[object Object]` for objects:

```typescript
// ❌ BEFORE - Wrong approach
output: data.toolCall?.result?.value 
  ? String(data.toolCall.result.value)  // This creates "[object Object]"
  : data.toolCall?.result?.error || ""
```

**Fix**: Properly serialize objects as JSON:
```typescript
// ✅ AFTER - Correct approach
output: data.toolCall?.result?.value 
  ? (typeof data.toolCall.result.value === "string" 
    ? data.toolCall.result.value 
    : JSON.stringify(data.toolCall.result.value, null, 2))
  : data.toolCall?.result?.error 
  ? (typeof data.toolCall.result.error === "string"
    ? data.toolCall.result.error
    : JSON.stringify(data.toolCall.result.error, null, 2))
  : ""
```

### 2. **Lack of Monitoring** (Secondary Issue)
There was no way to detect if the stream genuinely stopped sending updates vs. just taking a long time.

**Fix**: Added heartbeat monitoring:
- Logs a warning if no updates received for 60 seconds
- Checks every 30 seconds
- Helps distinguish between "stuck" and "slow"

### 3. **Poor Error Logging** (Secondary Issue)
When JSON.stringify failed, it would silently fail or crash the stream.

**Fix**: Added try-catch around serialization:
```typescript
try {
  const data = JSON.stringify(update);
  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
} catch (stringifyError) {
  console.error(`Failed to stringify update #${updateCount}:`, stringifyError);
  // Send error update instead of crashing
  const errorData = JSON.stringify({
    type: "error",
    text: `Failed to serialize agent update: ${error.message}`,
  });
  controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
}
```

## How to Debug Future Issues

### 1. Check Server Logs
Look for these patterns in your terminal running `pnpm dev`:

```bash
# Normal operation
[Update #1] text-delta | text: "I'll help you..."
[Update #2] tool-call-started | callId: abc123 | tool: shell
[Update #3] tool-call-completed | callId: abc123 | result: success

# Stuck stream warning
⚠️ No updates for 78s - stream may be stuck

# Serialization error
Failed to stringify update #42: TypeError: Converting circular structure to JSON
```

### 2. Check Browser Console
The client logs progress updates:
```javascript
[Task task-123] Progress: 10 updates received
[Task task-123] Progress: 20 updates received
```

If these stop incrementing, the stream is stuck.

### 3. Check Network Tab
- Open DevTools → Network
- Find the `/api/agent` request
- Check the EventStream tab
- You should see continuous SSE messages
- If messages stop but connection is open = stuck stream

### 4. Common Stuck Patterns

#### Pattern A: Shell Command Never Completes
```
shell
$
cd /path/to/repo && long-running-command
[object Object]  # ← BAD! Should show actual output
```

**Solution**: The fix above handles this.

#### Pattern B: Stream Freezes After Tool Call
```
tool-call-started
# ... then nothing ...
```

**Cause**: The Cursor SDK agent is waiting for a tool to complete but it never does.

**Solution**: 
1. Check if the tool command is valid
2. Check if the directory exists
3. The 5-minute timeout will eventually terminate it

#### Pattern C: HTTP/2 Connection Error
```
=== UNHANDLED REJECTION IN AGENT ===
Error: NGHTTP2_INTERNAL_ERROR
```

**Cause**: Connection to Cursor API dropped.

**Solution**: 
1. Check your internet connection
2. Check if Cursor API is accessible
3. The error handler now catches this and shows user-friendly message

## Improvements Made

### 1. Better Logging
- Shows tool type when tool call starts
- Shows result status when tool call completes
- Tracks time since last update
- Logs warning if stream appears stuck

### 2. Error Handling
- Try-catch around JSON serialization
- Graceful error messages sent to client
- Doesn't crash the stream on serialization errors

### 3. Timeout Management
- 5-minute hard timeout for entire stream
- 60-second inactivity detection (warning only)
- Both timers are properly cleaned up

### 4. Proper Serialization
- Type checking before string conversion
- JSON.stringify for objects
- Handles both value and error fields
- Works for all tool types (not just shell)

## Testing the Fix

1. Run an agent task that uses shell commands:
   ```
   Action: "Update Dependencies"
   ```

2. Watch the output - you should now see:
   ```
   shell
   $
   cd /Users/you/repo && pnpm outdated
   
   Package  Current  Wanted  Latest
   next     14.0.0   15.0.0  15.0.0
   react    18.2.0   18.3.0  19.0.0
   
   Exit code: 0
   ```

3. Instead of:
   ```
   [object Object]
   ```

## When to Worry

### Still Stuck After Fix?

If agents still get stuck with the same symptoms:

1. **Check Cursor SDK Version**
   ```bash
   pnpm list @cursor-ai/january
   ```
   Update if outdated:
   ```bash
   pnpm update @cursor-ai/january
   ```

2. **Check if it's a Tool Issue**
   Some tools genuinely take a long time:
   - `pnpm install` - Can take 5+ minutes
   - Large file operations
   - Network requests

   The 60s warning will alert you, but these aren't "stuck" - just slow.

3. **Check Agent Prompt**
   If the agent is confused about the working directory, it might be trying to access non-existent paths:
   ```
   Error: ENOENT: no such file or directory
   ```

4. **Enable Verbose Logging**
   Edit `app/api/agent/route.ts` and change log level:
   ```typescript
   // Log EVERY update, not just every 10th
   console.log(`[Update #${updateCount}]`, update);
   ```

## Related Files Changed

1. `app/page.tsx` - Fixed object serialization in tool results (2 places)
2. `app/api/agent/route.ts` - Added better logging, error handling, and heartbeat monitoring
3. `AGENT-STUCK-DEBUG.md` - This file (documentation)

## Prevention

To avoid similar issues in the future:

1. **Always type-check before `String()` conversion**
2. **Use `JSON.stringify()` for objects**
3. **Add try-catch around serialization**
4. **Log enough detail to debug remotely**
5. **Add timeout/heartbeat monitoring for streams**
