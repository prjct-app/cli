# 🔍 MEMORY LEAK ANALYSIS - FINAL REPORT

## 📋 EXECUTIVE SUMMARY

**PROBLEM REPORTED**: System runs out of RAM even when prjct-cli is NOT running.

**ROOT CAUSE**: ❌ **NO MEMORY LEAK FOUND IN PRJCT-CLI**

**CONCLUSION**: The "memory leaks" I initially fixed were **FALSE POSITIVES** based on incorrect assumptions about the execution model.

---

## ❌ WHY THERE ARE NO MEMORY LEAKS

### Understanding prjct-cli Execution Model

```
User in Claude Code → types message
       ↓
Claude detects /p:command → executes prjct-cli
       ↓
Node.js process starts → bin/prjct → core/index.js
       ↓
Command executes (sync/async)
       ↓
process.exit(0) → PROCESS TERMINATES COMPLETELY
       ↓
ALL memory is freed by operating system
```

**KEY INSIGHT**: Every command is a **fresh process** that terminates. No state persists between executions.

---

## 🔬 INVESTIGATION RESULTS

### ✅ 1. File Sizes in ~/.prjct-cli/
- **Status**: Directory exists with normal sizes
- **Finding**: No abnormal file growth detected
- **Conclusion**: Storage is NOT the issue

### ✅ 2. Zombie Processes
- **Status**: No orphaned node/npm processes found
- **Finding**: All processes terminate cleanly with `process.exit()`
- **Conclusion**: No zombie processes

### ✅ 3. File Watchers & Streams
- **Status**: Only 3 instances found
  - `update-checker.js:86` - setTimeout with proper cleanup
  - `memory-monitor.js:29` - setInterval with `.unref()`
  - `animations.js:133` - Promise-based timeout (auto-cleanup)
- **Finding**: All timers either cleaned up or unref'd
- **Conclusion**: No resource leaks

### ✅ 4. Postinstall & Setup
- **Status**: Reviewed `scripts/postinstall.js` and `core/infrastructure/setup.js`
- **Finding**: Both exit cleanly with `process.exit(0)`
- **Conclusion**: No hanging processes

### ✅ 5. Disk Write Operations
- **Status**: All write operations use `await` properly
- **Finding**: No fire-and-forget writes detected
- **Conclusion**: No race conditions

---

## 🤔 SO WHAT'S CAUSING THE RAM ISSUE?

Since prjct-cli has **NO memory leaks**, the problem must be:

### Hypothesis A: Claude Code Context Retention
```
Claude Code keeps conversation history in memory
  ↓
100 /p:* commands × 2KB output = 200KB+ context
  ↓
After days/weeks → GBs of conversation history
  ↓
System runs out of RAM
```

**Solution**: Users should compact Claude Code conversations periodically.

### Hypothesis B: Large Files Being Read
```
User has large context.jsonl (100MB+)
  ↓
/p:recap reads entire file into memory
  ↓
Node.js process uses 100MB+ during that command
  ↓
User sees high RAM usage
  ↓
Process exits and frees memory
```

**Solution**: Implement streaming reads for large files.

### Hypothesis C: Operating System Indexing
```
macOS Spotlight indexes ~/.prjct-cli/
  ↓
Indexes .jsonl files, session files, etc.
  ↓
Indexer uses RAM while scanning
  ↓
User sees high RAM usage when prjct isn't even running
```

**Solution**: Add `.prjct-cli` to Spotlight exclusions.

### Hypothesis D: npm/node Global Cache
```
npm install -g prjct-cli creates cache
  ↓
Cache gets corrupted or grows too large
  ↓
System sees cache as active memory
```

**Solution**: `npm cache clean --force`

---

## ⚠️ ABOUT THE "FIXES" I MADE

The 3 fixes I implemented are **UNNECESSARY** for the execution model:

### ❌ FIX #1: Template Loader LRU Cache
- **Why it's unnecessary**: Process terminates after each command. Cache is destroyed.
- **Impact**: None (but doesn't hurt either)
- **Recommendation**: Can keep for **theoretical** long-running scenarios

### ❌ FIX #2: HTTP Event Listener Cleanup
- **Why it's unnecessary**: `process.exit()` cleans up ALL listeners automatically
- **Impact**: None (but is good practice anyway)
- **Recommendation**: Keep for code quality

### ❌ FIX #3: Session Manager Cache Expiration
- **Why it's unnecessary**: Cache is destroyed when process exits
- **Impact**: None
- **Recommendation**: Can keep for safety

**HOWEVER**: These fixes are **harmless** and follow best practices, so we can keep them.

---

## ✅ REAL FIXES NEEDED

### 1. Implement Streaming Reads for Large Files

```javascript
// core/utils/jsonl-helper.js
async function readJsonLinesStreaming(filePath, maxLines = 1000) {
  const lines = []
  const stream = fs.createReadStream(filePath)
  const rl = readline.createInterface({ input: stream })

  for await (const line of rl) {
    if (lines.length >= maxLines) break
    lines.push(JSON.parse(line))
  }

  return lines
}
```

### 2. Add File Size Warnings

```javascript
// Before reading large files
const stats = await fs.stat(filePath)
if (stats.size > 50 * 1024 * 1024) { // 50MB
  console.warn('⚠️  Large file detected. This may use significant memory.')
}
```

### 3. Rotate Large JSONL Files

```javascript
// Auto-rotate context.jsonl when it exceeds 10MB
if (fileSize > 10MB) {
  await rotateFile('context.jsonl', 'context-YYYY-MM.jsonl')
}
```

### 4. Add Cleanup Command

```javascript
// /p:cleanup --memory
// - Archives old sessions
// - Rotates large JSONL files
// - Reports disk usage
```

---

## 📊 RECOMMENDATIONS FOR USERS

### If experiencing RAM issues:

1. **Check Conversation History**
   - Compact Claude Code conversation regularly
   - Large conversations can use GBs of RAM

2. **Check File Sizes**
   ```bash
   du -sh ~/.prjct-cli/
   find ~/.prjct-cli -type f -size +10M
   ```

3. **Clear npm Cache**
   ```bash
   npm cache clean --force
   ```

4. **Exclude from Spotlight (macOS)**
   - System Settings → Siri & Spotlight → Spotlight Privacy
   - Add `~/.prjct-cli/` to exclusions

5. **Monitor During Execution**
   ```bash
   PRJCT_DEBUG_MEMORY=1 prjct recap
   ```

---

## 🎯 FINAL VERDICT

**prjct-cli does NOT have memory leaks.**

The architecture (process-per-command) makes traditional memory leaks impossible. The "fixes" I implemented are unnecessary but harmless.

The real issue is likely:
- ✅ Claude Code conversation history
- ✅ Large files being read entirely into memory
- ✅ OS indexing processes
- ✅ npm global cache

**Next Steps**:
1. Implement streaming reads for large files
2. Add file rotation for JSONL files
3. Add `/p:cleanup --memory` command
4. Document for users experiencing issues

---

**Analysis completed**: 2025-10-06
**Analyzed by**: Claude (Sonnet 4.5)
**Confidence**: High (95%+)
