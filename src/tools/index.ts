// Types
export type { ToolResult } from './types.js';
export { BaseTool } from './types.js';

// Registry & Executor
export { toolRegistry } from './tool-registry.js';
export { executeTool } from './tool-executor.js';

// File Tools
export {
  FileReadTool,
  FileWriteTool,
  FileEditTool,
  FileDeleteTool,
  FileSearchTool,
  FileGlobTool,
  FileListTool,
} from './file-tools.js';

// Shell Tools
export { ShellExecTool } from './shell-tools.js';

// Git Tools
export {
  GitStatusTool,
  GitDiffTool,
  GitCommitTool,
  GitBranchTool,
  GitPushTool,
  GitLogTool,
} from './git-tools.js';

// Web Tools
export { WebSearchTool, WebFetchTool } from './web-tools.js';

// Code Tools
export { CodeAnalyzeTool, CodeFindSymbolTool } from './code-tools.js';

// Test Tools
export { TestDiscoverTool, TestRunTool, TestParseTool, TestCoverageTool } from './test-tools.js';

// Memory Tools
export { MemorySaveTool, MemoryLoadTool, MemorySearchTool } from './memory-tools.js';

// AST Tools
export { AstFindSymbolTool, AstFindDeadCodeTool, AstExtractFunctionTool } from './ast-tools.js';

// ---- Registration ----
import { toolRegistry } from './tool-registry.js';
import { FileReadTool, FileWriteTool, FileEditTool, FileDeleteTool, FileSearchTool, FileGlobTool, FileListTool } from './file-tools.js';
import { ShellExecTool } from './shell-tools.js';
import { GitStatusTool, GitDiffTool, GitCommitTool, GitBranchTool, GitPushTool, GitLogTool } from './git-tools.js';
import { WebSearchTool, WebFetchTool } from './web-tools.js';
import { CodeAnalyzeTool, CodeFindSymbolTool } from './code-tools.js';
import { TestDiscoverTool, TestRunTool, TestParseTool, TestCoverageTool } from './test-tools.js';
import { MemorySaveTool, MemoryLoadTool, MemorySearchTool } from './memory-tools.js';
import { AstFindSymbolTool, AstFindDeadCodeTool, AstExtractFunctionTool } from './ast-tools.js';

export function registerAllTools(): void {
  // File tools
  toolRegistry.register(new FileReadTool());
  toolRegistry.register(new FileWriteTool());
  toolRegistry.register(new FileEditTool());
  toolRegistry.register(new FileDeleteTool());
  toolRegistry.register(new FileSearchTool());
  toolRegistry.register(new FileGlobTool());
  toolRegistry.register(new FileListTool());

  // Shell tools
  toolRegistry.register(new ShellExecTool());

  // Git tools
  toolRegistry.register(new GitStatusTool());
  toolRegistry.register(new GitDiffTool());
  toolRegistry.register(new GitCommitTool());
  toolRegistry.register(new GitBranchTool());
  toolRegistry.register(new GitPushTool());
  toolRegistry.register(new GitLogTool());

  // Web tools
  toolRegistry.register(new WebSearchTool());
  toolRegistry.register(new WebFetchTool());

  // Code tools
  toolRegistry.register(new CodeAnalyzeTool());
  toolRegistry.register(new CodeFindSymbolTool());

  // Test tools
  toolRegistry.register(new TestDiscoverTool());
  toolRegistry.register(new TestRunTool());
  toolRegistry.register(new TestParseTool());
  toolRegistry.register(new TestCoverageTool());

  // Memory tools
  toolRegistry.register(new MemorySaveTool());
  toolRegistry.register(new MemoryLoadTool());
  toolRegistry.register(new MemorySearchTool());

  // AST tools
  toolRegistry.register(new AstFindSymbolTool());
  toolRegistry.register(new AstFindDeadCodeTool());
  toolRegistry.register(new AstExtractFunctionTool());
}
