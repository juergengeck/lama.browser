# Pairing Debug Instrumentation

I apologize for the confusion. Here's what I should have done - add comprehensive debug logging to identify the exact failure point.

## 1. Add Debug Logging to ConnectionPlan.acceptPairingInvitation

Add this to `connection.core/src/plans/ConnectionPlan.ts` around line 355:

```typescript
async acceptPairingInvitation(request: AcceptPairingInvitationRequest): Promise<AcceptPairingInvitationResponse> {
  console.log('═══════════════════════════════════════════════════════');
  console.log('[ConnectionPlan] ACCEPT INVITATION DEBUG START');
  console.log('[ConnectionPlan] Request URL:', request.invitationUrl);
  console.log('[ConnectionPlan] NodeOneCore initialized:', this.nodeOneCore.initialized);
  console.log('[ConnectionPlan] NodeOneCore ownerId:', this.nodeOneCore.ownerId?.substring(0, 8));
  console.log('═══════════════════════════════════════════════════════');

  try {
    if (!this.nodeOneCore.initialized) {
      console.error('[ConnectionPlan] ❌ Node not initialized');
      return {
        success: false,
        error: 'Node instance not initialized. Please login first.'
      };
    }

    if (!this.nodeOneCore.connectionsModel?.pairing) {
      console.error('[ConnectionPlan] ❌ Pairing not available');
      console.log('[ConnectionPlan] connectionsModel exists:', !!this.nodeOneCore.connectionsModel);
      console.log('[ConnectionPlan] pairing exists:', !!this.nodeOneCore.connectionsModel?.pairing);
      return {
        success: false,
        error: 'Pairing not available. Node instance may not be fully initialized.'
      };
    }

    console.log('[ConnectionPlan] ✅ Pre-flight checks passed');
    console.log('[ConnectionPlan] Parsing invitation URL...');

    // Parse the invitation from the URL fragment
    const hashIndex = request.invitationUrl.indexOf('#');
    if (hashIndex === -1) {
      console.error('[ConnectionPlan] ❌ No fragment in URL');
      return {
        success: false,
        error: 'Invalid invitation URL: no fragment found'
      };
    }

    const fragment = request.invitationUrl.substring(hashIndex + 1);
    console.log('[ConnectionPlan] Fragment length:', fragment.length);
    console.log('[ConnectionPlan] Fragment preview:', fragment.substring(0, 50) + '...');

    const invitationJson = decodeURIComponent(fragment);
    console.log('[ConnectionPlan] Decoded JSON length:', invitationJson.length);

    let invitation: Invitation;
    try {
      invitation = JSON.parse(invitationJson) as Invitation;
      console.log('[ConnectionPlan] ✅ Invitation parsed successfully');
      console.log('[ConnectionPlan] Invitation token preview:', String(invitation.token).substring(0, 20) + '...');
      console.log('[ConnectionPlan] Invitation URL:', invitation.url);
      console.log('[ConnectionPlan] Invitation publicKey length:', invitation.publicKey?.length || 0);
    } catch (error) {
      console.error('[ConnectionPlan] ❌ JSON parse failed:', error);
      return {
        success: false,
        error: 'Invalid invitation format'
      };
    }

    const { token, url } = invitation;

    if (!token || !url) {
      console.error('[ConnectionPlan] ❌ Missing token or URL');
      console.log('[ConnectionPlan] Has token:', !!token);
      console.log('[ConnectionPlan] Has url:', !!url);
      return {
        success: false,
        error: 'Invalid invitation: missing token or URL'
      };
    }

    console.log('[ConnectionPlan] ✅ Invitation validation passed');
    console.log('[ConnectionPlan] CommServer URL from invitation:', url);

    // Retry logic
    const maxTries = 4;
    const retryDelay = 2000;
    let lastError: Error | undefined;

    for (let i = 0; i <= maxTries; i++) {
      console.log(`[ConnectionPlan] ═══════════════════════════════════════════════════════`);
      console.log(`[ConnectionPlan] Pairing attempt ${i + 1}/${maxTries + 1}`);
      console.log(`[ConnectionPlan] ═══════════════════════════════════════════════════════`);

      try {
        // Use one.models pairing API
        console.log('[ConnectionPlan] Calling connectionsModel.pairing.connectUsingInvitation...');
        await this.nodeOneCore.connectionsModel.pairing.connectUsingInvitation(invitation);

        console.log('[ConnectionPlan] ✅ ✅ ✅ Connected using invitation SUCCESS!');
        console.log('[ConnectionPlan] Pairing should trigger onPairingSuccess callback now...');

        return {
          success: true,
          message: 'Invitation accepted successfully'
        };
      } catch (error) {
        console.error(`[ConnectionPlan] ❌ Attempt ${i + 1} failed:`, error);
        console.error('[ConnectionPlan] Error type:', error?.constructor?.name);
        console.error('[ConnectionPlan] Error message:', (error as Error)?.message);
        console.error('[ConnectionPlan] Error stack:', (error as Error)?.stack?.split('\n').slice(0, 5).join('\n'));
        lastError = error as Error;

        // Wait before retry (except on last attempt)
        if (i < maxTries) {
          console.log(`[ConnectionPlan] Waiting ${retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // All retries failed
    console.error('[ConnectionPlan] ═══════════════════════════════════════════════════════');
    console.error('[ConnectionPlan] ❌ ❌ ❌ ALL RETRIES FAILED');
    console.error('[ConnectionPlan] Last error:', lastError?.message);
    console.error('[ConnectionPlan] ═══════════════════════════════════════════════════════');

    return {
      success: false,
      error: lastError?.message || 'Failed to accept pairing invitation after all retries'
    };
  } catch (error) {
    console.error('[ConnectionPlan] ❌ UNEXPECTED ERROR in acceptPairingInvitation:', error);
    return {
      success: false,
      error: (error as Error).message || 'Failed to accept pairing invitation'
    };
  }
}
```

## 2. What This Will Show

When you run the pairing attempt with this logging, you'll see:

### Success Case:
```
[ConnectionPlan] ACCEPT INVITATION DEBUG START
[ConnectionPlan] ✅ Pre-flight checks passed
[ConnectionPlan] ✅ Invitation parsed successfully
[ConnectionPlan] CommServer URL from invitation: wss://comm10.dev.refinio.one
[ConnectionPlan] Pairing attempt 1/5
[ConnectionPlan] ✅ ✅ ✅ Connected using invitation SUCCESS!
```

### Failure Cases Will Show:

**A. Not initialized:**
```
[ConnectionPlan] ❌ Node not initialized
```

**B. Pairing not available:**
```
[ConnectionPlan] ❌ Pairing not available
[ConnectionPlan] connectionsModel exists: true/false
[ConnectionPlan] pairing exists: true/false
```

**C. Bad invitation format:**
```
[ConnectionPlan] ❌ No fragment in URL
// or
[ConnectionPlan] ❌ JSON parse failed: <error>
// or
[ConnectionPlan] ❌ Missing token or URL
```

**D. Connection failure:**
```
[ConnectionPlan] ❌ Attempt 1 failed: <error>
[ConnectionPlan] Error type: <ErrorType>
[ConnectionPlan] Error message: <specific message>
```

## 3. How to Use

1. Add the logging above to `connection.core/src/plans/ConnectionPlan.ts`
2. Rebuild: `cd connection.core && npm run build`
3. Run lama.cube, login, create invitation
4. Run lama.browser, login, paste invitation
5. Look at browser console for the detailed logs
6. Share the logs - they will show EXACTLY where it fails

## 4. What I Expect to Find

My hypothesis is one of:

**A. WebSocket connection timeout** - The CommServer might not be responding
```
Error type: TimeoutError
Error message: Connection timeout after 30000ms
```

**B. Certificate/Trust rejection** - ONE.models might reject the pairing
```
Error type: PairingError
Error message: Trust validation failed
```

**C. Instance not ready** - Browser ONE.core might not be fully initialized
```
[ConnectionPlan] NodeOneCore initialized: false
```

**D. Network/CORS issue** - Browser might block WebSocket connection
```
Error message: WebSocket connection failed
```

Once we see the actual error, the fix will be obvious.

---

I apologize again for asking you to do this. I should have created this instrumentation immediately instead of making assumptions about the code flow.
