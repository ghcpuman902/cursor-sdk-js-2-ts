# Stuck Agent Detection & Recovery System

## Problem

The Cursor SDK agents would occasionally hang/freeze, stopping all updates mid-task. This happened when:
1. The SDK encountered an internal error but didn't report it
2. The agent entered an infinite thinking loop
3. Network issues caused stream interruptions
4. Long-running operations exceeded internal timeouts

Users would see tool calls stuck in "running" state indefinitely with no way to recover except restarting the app.

## Solution: Multi-Layer Stuck Detection & Recovery

### 1. Backend Auto-Kill (2-minute timeout)

**Location**: `app/api/agent/route.ts`

Added automatic detection and termination of truly hung agents:

```typescript
// Heartbeat monitor checks every 5 seconds
const heartbeatInterval = setInterval(() => {
  const timeSinceLastUpdate = Date.now() - lastUpdateTime;
  const secondsStuck = Math.floor(timeSinceLastUpdate / 1000);
  
  // Warn after 10 seconds
  if (timeSinceLastUpdate > 10000) {
    console.warn(`⚠️ No updates for ${secondsStuck}s - stream may be stuck`);
  }
  
  // AUTO-KILL after 2 minutes
  if (timeSinceLastUpdate > 120000) {
    console.error(`🔥 AGENT HUNG FOR 2 MINUTES - FORCE KILLING`);
    // Cancel SDK submission
    // Send error to client
    // Clean up session
  }
}, 5000);
```

**Benefits**:
- Prevents agents from hanging indefinitely
- Automatically recovers from SDK bugs
- Preserves database state up to the point of hang
- Client receives clear error message

### 2. Force-Stop Cancellation

**Location**: `app/api/agent/route.ts`

Improved the session reuse logic to FORCE-STOP stuck agents:

```typescript
if (session.isSubmitting) {
  console.log("🛑 Attempting to FORCE-STOP previous submission");
  
  // Try SDK cancellation
  if (session.currentSubmission?.cancel) {
    session.currentSubmission.cancel();
  }
  
  // FORCE close stream
  if (session.currentController) {
    session.currentController.close();
  }
  
  // FORCE clean up - don't wait for SDK
  session.currentSubmission = undefined;
  session.isSubmitting = false;
}
```

**Before**: Waited for SDK to gracefully cancel (never happened)
**After**: Forces session cleanup immediately

### 3. Nuclear Option - Session Destruction

If an agent is STILL stuck after force-stop:

```typescript
if (submitError.message.includes("Agent busy")) {
  console.error("🔥 DESTROYING session to break the deadlock");
  
  // Delete entire session
  agentSessions.delete(sessionId);
  
  return {
    error: "Agent was stuck. Session cleared. Please retry.",
    sessionCleared: true
  };
}
```

**Frontend handling**:
```typescript
if (errData.sessionCleared) {
  // Clear sessionId from task
  // Generate new sessionId
  // Retry with fresh session
}
```

### 4. Frontend Stuck Warning UI

**Location**: `app/components/agent-view.tsx`

Added visual warning banner when agent appears stuck:

```tsx
{isStuck && status === "running" && (
  <div className="amber-warning-banner">
    <div>
      Agent appears stuck ({stuckDuration}s with no updates)
      The agent may be processing a slow operation, or it could be hung.
    </div>
    <button onClick={handleKillSession}>
      Force Stop
    </button>
  </div>
)}
```

**Detection logic**:
- Tracks `lastUpdateTime` in message metadata
- Checks every second
- Shows warning after 10 seconds of no updates
- Offers "Force Stop" button for manual intervention

### 5. Manual Session Termination API

**Endpoint**: `DELETE /api/agent?sessionId={id}`

Allows manual killing of specific stuck sessions:

```typescript
// Kill specific session
DELETE /api/agent?sessionId=session-abc123

// Kill all sessions
DELETE /api/agent
```

**What it does**:
1. Cancels SDK submission via `.cancel()`
2. Closes SSE stream controller
3. Removes session from memory
4. Returns success confirmation

## User Experience Flow

### Scenario 1: Agent Hangs (Auto-Recovery)

1. User starts task → Agent works normally
2. SDK hangs at update #83
3. **10 seconds**: Warning in logs
4. **30 seconds**: UI shows "Agent appears stuck" banner
5. **2 minutes**: Backend AUTO-KILLS agent
6. Client receives error: "Agent hung for 2 minutes. Task cancelled."
7. Task marked as "failed" with partial progress saved

### Scenario 2: Manual Force-Stop

1. User sees stuck warning banner (after 10s)
2. User clicks "Force Stop" button
3. Frontend calls `DELETE /api/agent?sessionId=...`
4. Backend terminates session
5. Client receives "Session terminated by user"
6. User can retry the task

### Scenario 3: Session Deadlock

1. User tries to send follow-up message
2. Backend detects agent still busy
3. **First attempt**: Force-stop and wait 100ms
4. **Still busy**: DESTROY session (nuclear option)
5. Client receives `sessionCleared: true`
6. Frontend generates new sessionId
7. Retry with fresh session
8. Task continues successfully

## Technical Details

### Session State Management

```typescript
interface AgentSession {
  agent: CursorAgent;
  lastAccess: number;
  workingDirectory: string;
  currentController?: ReadableStreamDefaultController;
  currentSubmission?: { cancel: () => void };
  isSubmitting: boolean; // Prevents concurrent submissions
}
```

### Cancellation Hierarchy

1. **Graceful**: `submission.cancel()` - Preserves conversation history
2. **Force**: Close stream controller - Stops client updates
3. **Nuclear**: Delete session - Breaks all connections

### Timeouts

- **Stuck warning**: 10 seconds (UI shows banner)
- **Auto-kill**: 2 minutes (backend terminates)
- **Overall timeout**: 5 minutes (max task duration)
- **Retry delay**: 1-2 seconds (gives SDK time to clean up)

## Database Persistence

**Key improvement**: Messages are saved during stuck states!

Even if agent hangs, all messages up to that point are preserved:
- User message saved immediately
- Assistant message saved every 10 updates
- Tool calls saved on completion
- Final save attempted even on error

**Result**: Users don't lose work when agents hang

## Testing Checklist

- [x] Agent hangs mid-task → Auto-killed after 2 minutes
- [x] User clicks "Force Stop" → Session terminated immediately
- [x] Attempt retry while stuck → Session destroyed and recreated
- [x] Multiple concurrent stuck agents → All killed independently
- [x] Partial progress after hang → Messages visible in database
- [x] Follow-up after force-stop → New session created successfully

## Performance Impact

- **Memory**: Minimal (session metadata only)
- **CPU**: Negligible (5-second interval checks)
- **Network**: No additional overhead
- **Database**: Slight increase (saves on error states)

## Future Enhancements

1. **Configurable timeouts**: Let users adjust stuck threshold
2. **Restart button**: Attempt to resume from last save point
3. **Stuck statistics**: Track which operations hang most often
4. **SDK improvements**: Report upstream bugs to Cursor team
5. **Graceful degradation**: Fall back to simpler operations if stuck

## Conclusion

The multi-layer approach ensures:
- ✅ Automatic recovery from SDK hangs
- ✅ Manual control when needed
- ✅ No data loss during failures
- ✅ Clear user feedback
- ✅ Robust session management

Users can now confidently run long tasks knowing they won't get permanently stuck!
