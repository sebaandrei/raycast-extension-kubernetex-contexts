# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **functional** Raycast extension for managing Kubernetes contexts. The core functionality is implemented and working using direct kubeconfig file manipulation.

## ✅ Current Status: WORKING EXTENSION

**Core Features Implemented:**
- ✅ Context listing and display
- ✅ Context switching (actually works!)
- ✅ Current context detection
- ✅ Real-time kubeconfig file monitoring
- ✅ Error handling and user feedback

## Architecture Overview

### **Direct Kubeconfig Approach** (Primary - WORKING)
- **`src/utils/kubeconfig-direct.ts`** - Direct YAML file manipulation
- **`src/hooks/useKubeconfig.ts`** - React hooks for kubeconfig operations
- **`src/kubeconfig-test.tsx`** - Working test command with context switching
- **No kubectl dependency** - bypasses all PATH/execution issues

### **Alternative kubectl Approaches** (Backup - Had Issues)  
- **`src/utils/kubectl-discovery.ts`** - Smart kubectl path discovery
- **`src/utils/kubectl-new.ts`** - useExec hook implementations
- **`src/utils/kubectl-fixed.ts`** - Multiple kubectl execution strategies

## Development Commands

- `npm run dev` - Development mode with hot reloading ✅ **WORKING**
- `npm run build` - Build the extension for distribution
- `npm run lint` - Code linting  
- `npm run fix-lint` - Auto-fix linting issues

## Key Files Structure

```
src/
├── hooks/
│   └── useKubeconfig.ts          # React hooks for kubeconfig operations
├── utils/
│   ├── kubeconfig-direct.ts      # Direct kubeconfig file manipulation (PRIMARY)
│   ├── kubectl-discovery.ts     # kubectl path discovery utilities
│   ├── kubectl-new.ts           # useExec hook approaches (backup)
│   └── errors.ts                # Error handling and user feedback
├── types/
│   └── index.ts                 # TypeScript interfaces
├── kubeconfig-test.tsx          # WORKING test command (try this!)
└── [various test commands]
```

## Dependencies

**Core Dependencies:**
- `@raycast/api` - Raycast extension API
- `@raycast/utils` - Raycast utility functions
- `yaml` - **CRITICAL** - For kubeconfig YAML parsing

## How It Works

### **Kubeconfig Direct Approach** (Recommended)
1. **Read**: `~/.kube/config` file directly using Node.js `fs`
2. **Parse**: YAML content using `yaml` library
3. **Manipulate**: JavaScript objects for context operations
4. **Write**: Modified YAML back to file for context switching
5. **No shell commands** - completely bypasses kubectl execution

### **Key Functions:**
- `getAllContexts()` - Get all contexts from kubeconfig
- `getCurrentContext()` - Get active context
- `switchToContext(name)` - Switch to different context ✅ **WORKS**
- `setContextNamespace(ctx, ns)` - Set namespace for context

## Testing Commands Available

1. **"Kubeconfig Direct Test"** ⭐ **RECOMMENDED** - Working context management
2. **"Simple kubectl Test"** - Basic kubectl discovery without hooks
3. **"Debug kubectl Hooks"** - kubectl path discovery testing
4. Various other test commands for debugging

## Development Considerations

### **What Works:**
- ✅ Direct kubeconfig file manipulation
- ✅ Context switching via keyboard shortcuts
- ✅ Real-time context detection
- ✅ YAML parsing and writing
- ✅ Error handling and user feedback

### **What Had Issues (but solved via kubeconfig approach):**
- ❌ kubectl command execution via `useExec` hook
- ❌ PATH environment issues in Raycast
- ❌ Shell command reliability

### **Security Considerations:**
- File permissions on `~/.kube/config`
- YAML parsing validation
- Error handling for malformed kubeconfig files
- No external network dependencies

## Next Development Steps

**Ready for Enhanced Features:**
1. Namespace management and selection
2. Advanced filtering and search
3. Menubar integration showing current context
4. Context creation and management
5. Polish for Raycast store publication

## Key Insight

**BREAKTHROUGH**: Direct kubeconfig manipulation proved superior to kubectl command execution:
- More reliable (no subprocess failures)
- Faster (no command execution overhead)  
- More secure (no shell injection risks)
- Independent of kubectl installation/PATH issues
- Works in any environment where kubeconfig exists

The extension is **functional and ready for use** with the core context management features working perfectly.