# lama.app

**Production-ready mobile app** for LAMA (Local AI Messaging Assistant) built with Expo 54 and the unified plan-based architecture.

This is the new mobile app that replaces the legacy `../lama/` app. It runs real business logic from `*.core` packages directly in React Native using `one.core.expo`.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start

# Run on platforms
npm run ios       # iOS simulator
npm run android   # Android emulator
npm run web       # Web browser
```

## Features

✅ **Real Business Logic** - Runs actual `*.core` plans (not mocks)
✅ **ONE.core Native** - Uses one.core.expo for React Native compatibility
✅ **Full UI Migration** - Complete UI from legacy app with compatibility layer
✅ **Tab Navigation** - Home, Messages, Journal, Devices
✅ **Self-Contained** - All dependencies bundled locally
✅ **Plan-Based** - Unified architecture across all platforms

## Architecture

```
UI Components (React Native)
    ↓
Compatibility Layer (useInstance hook)
    ↓
Client Layer (useLamaClient hook)
    ↓
Transport Layer (PlanTransportAdapter)
    ↓
Business Logic (*.core plans)
    ↓
Data Layer (ONE.core via one.core.expo)
```

## Technology Stack

- **Expo**: 54.0.23
- **React**: 19.1.0
- **React Native**: 0.81.5 (New Architecture enabled)
- **TypeScript**: 5.9.2
- **ONE.core**: 0.6.1-beta-3 (via one.core.expo)

## Documentation

See [CLAUDE.md](./CLAUDE.md) for complete development documentation including:
- Detailed architecture overview
- Migration guide from legacy app
- Development workflows
- Troubleshooting guide
- API documentation

## Key Differences from Legacy App

| Legacy `../lama` | New `lama.app` |
|------------------|----------------|
| Direct model access | Plan-based architecture |
| ChatModel, TopicModel | useLamaClient() hook |
| Complex 3-phase init | Simple adapter init |
| Node.js one.core | one.core.expo (RN) |

## Local Packages

All dependencies are bundled locally in `packages/`:

- `one.core.expo/` - React Native compatible ONE.core
- `one.models/` - Data models and schemas
- `chat.core/` - Chat business logic
- `lama.core/` - Core handlers
- `connection.core/` - P2P connections

## Project Structure

```
lama.app/
├── app/              # Expo Router pages
│   ├── (tabs)/       # Tab navigation
│   └── (screens)/    # Modal screens
├── src/
│   ├── components/   # UI components (migrated)
│   ├── hooks/        # React hooks
│   └── transport/    # Plan adapters
└── packages/         # Local dependencies
```

## Development

```bash
# Clear cache and restart
npm run start:clear

# Generate native projects
npm run prebuild

# Update local packages from parent
rsync -a --exclude='node_modules' ../chat.core/ packages/chat.core/
```

## Status

**Current**: Production-ready with full UI migration
**Next**: Gradual modernization of components to use plans directly

## License

Same as parent LAMA project
