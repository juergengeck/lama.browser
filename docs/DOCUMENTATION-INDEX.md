# Documentation Index

Complete guide to LAMA documentation.

## Quick Start

- **`/CLAUDE.md`** - Quick reference, commands, patterns
- **`lama.cube/CLAUDE.md`** - Electron-specific essentials
- **`~/.claude/CLAUDE.md`** - Global engineering principles

## Architecture

- **`docs/ARCHITECTURE-SUMMARY.md`** - Quick architecture reference
- **`ARCHITECTURE.md`** - Full architecture documentation
- **`ARCHITECTURE-V3.md`** - V3 architecture details
- **`FEDERATION-ARCHITECTURE.md`** - Federation patterns
- **`specs/008-unified-plan-system/ARCHITECTURE-UNIFIED-PLAN-SYSTEM.md`** - Future plan-based architecture

## Core Concepts

- **`docs/RECIPES.md`** - ONE.core recipe system guide
- **`docs/one-core-fundamentals.md`** - Complete ONE.core fundamentals
- **`docs/TESTING.md`** - Testing guide
- **`docs/config-quickstart.md`** - Configuration quickstart
- **`docs/config-platform-support.md`** - Platform configuration details

## Features

Current features:
- **`specs/018-we-must-create/`** - Structured LLM communication
- **`specs/019-above-the-chat/`** - Context-aware proposals
- **`specs/021-ai-assistant-core-refactor/`** - AI assistant refactor

Each feature spec includes:
- `spec.md` - Feature specification
- `plan.md` - Implementation plan
- `quickstart.md` - Quick start guide
- `data-model.md` - Data structures (if applicable)
- `contracts/` - API contracts (if applicable)

## Platform-Specific

- **`lama.cube/CLAUDE.md`** - Electron implementation
- **`*.core/CLAUDE.md`** - Core library details (if present)

## By Topic

### Getting Started
1. `/CLAUDE.md` - Overview and commands
2. `docs/ARCHITECTURE-SUMMARY.md` - Architecture principles
3. `lama.cube/CLAUDE.md` - Electron specifics (if using lama.cube)

### Development
1. `docs/RECIPES.md` - Creating ONE.core objects
2. `docs/TESTING.md` - Running tests
3. `docs/config-quickstart.md` - Configuration

### Deep Dives
1. `docs/one-core-fundamentals.md` - ONE.core internals
2. `ARCHITECTURE.md` - Full architecture
3. `specs/*/` - Feature specifications

## Document Structure

### CLAUDE.md Files
- **Global** (`~/.claude/CLAUDE.md`): Personal principles
- **Root** (`/CLAUDE.md`): Quick reference for entire monorepo
- **Platform** (`lama.cube/CLAUDE.md`): Electron-specific essentials

### docs/ Directory
- **Summaries**: `*-SUMMARY.md` - Quick references
- **Guides**: Step-by-step how-tos
- **References**: Complete technical details

### specs/ Directory
- Feature specifications using Specify framework
- Self-contained per feature
- Includes implementation status

## Keeping Docs Fresh

When making changes:

1. **Code changes**: Update relevant `CLAUDE.md` if patterns change
2. **New features**: Create spec in `specs/*/`
3. **Architecture changes**: Update `docs/ARCHITECTURE-SUMMARY.md` and `ARCHITECTURE.md`
4. **New patterns**: Add to `docs/RECIPES.md` or create new guide

## Size Optimization

CLAUDE.md files are optimized for context window:
- Root: 137 lines (was 468)
- lama.cube: 156 lines (was 425)
- Global: 29 lines (was 20 but better structured)

Detailed content moved to `docs/` with cross-references.
