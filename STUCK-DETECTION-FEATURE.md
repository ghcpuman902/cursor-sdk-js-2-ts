# Stuck Agent Detection & Recovery Feature

## Overview

Added a 10-second inactivity detector that alerts users when the agent appears stuck and provides quick action buttons to help unstick it.

## How It Works

### 1. **Update Time Tracking**
Every time the agent sends an update (text, thinking, tool call, etc.), we record `lastUpdateTime` on the current message.

### 2. **10-Second Detection**
A timer checks every second if:
- Task status is "running"
- The last message is still streaming
- No updates have been received for 10+ seconds

### 3. **Visual Alert**
When stuck is detected, a prominent amber warning appears above the chat input:

```
⚠️ Agent appears stuck                  15s no activity
No updates received for 15 seconds. Try sending a message to unstick the agent.

[Send "Continue"]  [Ask Status]  [Dismiss]
```

### 4. **Quick Actions**

**"Send Continue" Button:**
Sends: "Please continue with your task. If you're stuck, let me know what the issue is."

**"Ask Status" Button:**
Sends: "What's your current status? Are you waiting for something?"

**Manual Input:**
- Input box becomes enabled (amber border)
- Placeholder changes to "Type a message to unstick the agent..."
- Send button changes to "Unstick"
- User can type any custom message

### 5. **Backend Logging**
Server logs warnings every 5 seconds if no updates for 10+ seconds:
```
⚠️ No updates for 12s - stream may be stuck
Last update count: 45
```

## Files Changed

### 1. `lib/types.ts`
Added `lastUpdateTime` field to `ChatMessage`:
```typescript
export interface ChatMessage {
  // ... existing fields
  lastUpdateTime?: number; // Track when this message last received an update
}
```

### 2. `app/page.tsx`
- Initialize assistant messages with `lastUpdateTime: Date.now()`
- Update `lastUpdateTime` in `updateAssistantMessage` helper (2 places)
- Ensures every message update refreshes the timestamp

### 3. `app/components/agent-view.tsx`
**Added State:**
```typescript
const [isStuck, setIsStuck] = useState(false);
const [stuckDuration, setStuckDuration] = useState(0);
```

**Added Detection Logic:**
- useEffect that checks every second
- Calculates time since last update
- Sets `isStuck` to true if 10+ seconds
- Tracks duration for display

**Added UI:**
- Amber warning box with quick action buttons
- Input box highlights in amber when stuck
- Send button changes color and text
- Allows sending messages even when status is "running" if stuck

### 4. `app/api/agent/route.ts`
**Improved Heartbeat:**
- Changed threshold from 60s to 10s
- Check interval from 30s to 5s
- Better logging with update count

## User Experience

### Before (Stuck Agent)
```
User: "Update dependencies"
Agent: *shows some output*
[... silence for 30+ seconds ...]
User: "Is it working? Should I restart?"
```

### After (Stuck Detection)
```
User: "Update dependencies"
Agent: *shows some output*
[... 10 seconds pass ...]

⚠️ Agent appears stuck - 12s no activity
[Send "Continue"]  [Ask Status]

User: *clicks "Send Continue"*
Agent: "Continuing with dependency updates..."
```

## Why This Helps

### Common Stuck Scenarios

1. **Agent Waiting for User Input**
   - Sometimes the SDK agent thinks it asked a question
   - Detection prompts user to respond

2. **Tool Call Timeout**
   - Shell command might be waiting
   - Sending message can trigger timeout handling

3. **Context Loss**
   - Agent might have lost track of what it was doing
   - "Continue" message reminds it of the task

4. **API Connection Issues**
   - Transient network problems
   - Follow-up message can restart the stream

5. **Cursor SDK Internal State**
   - Sometimes the SDK just needs a nudge
   - User message can reset internal state

## Configuration

### Adjust Detection Timeout
In `app/components/agent-view.tsx`:

```typescript
// Change from 10 seconds to 15 seconds
if (secondsStuck >= 15) {  // was: >= 10
  setIsStuck(true);
  setStuckDuration(secondsStuck);
}
```

### Adjust Check Interval
```typescript
// Check every 2 seconds instead of 1
const interval = setInterval(checkStuck, 2000);  // was: 1000
```

### Adjust Backend Warning
In `app/api/agent/route.ts`:

```typescript
// Warn after 20 seconds instead of 10
if (timeSinceLastUpdate > 20000) {  // was: 10000
  console.warn(`⚠️ No updates for ${Math.floor(timeSinceLastUpdate / 1000)}s`);
}
```

## Testing

### Manual Test
1. Start an agent task (e.g., "Update Dependencies")
2. Wait for 10 seconds of inactivity
3. Verify warning appears
4. Click "Send Continue"
5. Verify agent responds

### Simulated Stuck Agent
Add this to test mode:
```typescript
// In handleAction, add artificial delay
await new Promise(resolve => setTimeout(resolve, 15000));
```

## Troubleshooting

### Warning Appears Too Often
- Increase threshold from 10s to 15s or 20s
- Some tasks naturally have longer pauses

### Warning Never Appears
- Check that `lastUpdateTime` is being updated
- Verify `isStreaming` is true
- Check browser console for errors

### "Continue" Doesn't Help
- Try "Ask Status" instead
- Or type custom message explaining the issue
- May need to cancel and restart the task

## Future Improvements

1. **Adaptive Timeout**
   - Learn typical pause lengths per action type
   - Only warn if pause is abnormal

2. **Automatic Retry**
   - Option to auto-send "continue" after 15s
   - With user preference toggle

3. **Better Diagnostics**
   - Show which tool is stuck
   - Show last successful operation
   - Estimate remaining time

4. **Agent Introspection**
   - Ask agent to report its internal state
   - Show what it's waiting for
   - Display current operation

5. **Network Status**
   - Show connection quality
   - Detect if Cursor API is slow
   - Indicate if issue is local vs remote

## Related Documents

- `AGENT-STUCK-DEBUG.md` - Debugging guide for stuck agents
- `DEBUGGING.md` - General debugging information
- `IMPROVEMENTS.md` - Future enhancement ideas

