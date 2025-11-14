# Clear Browser Storage

The HashGroup recipe has been updated in one.core. You need to clear old storage data.

## Steps:

1. Open the browser app (http://localhost:5173 or wherever it's running)
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to "Application" tab
4. Click "Storage" in the left sidebar
5. Click "Clear site data" button
6. Reload the page
7. Log in again

The empty HashGroup error should be fixed now.

## What Changed:

- one.core commit `5e0f1bc1`: Fixed HashGroup recipe to use 'person' Set instead of 'members' array
- This allows empty groups without triggering "missing person property" errors
