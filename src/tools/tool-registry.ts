import { BaseTool } from './types.js';
import { logger } from '../utils/logger.js';

class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  register(tool: BaseTool): void {
    if (this.tools.has(tool.name)) {
      logger.warn('tool-registry', `Tool "${tool.name}" already registered, overwriting`);
    }
    this.tools.set(tool.name, tool);
    logger.debug('tool-registry', `Registered tool: ${tool.name}`);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getSchemas(names?: string[]): { name: string; description: string; parameters: { type: string; properties: Record<string, unknown>; required?: string[] } }[] {
    const tools = names
      ? names.map((n) => this.tools.get(n)).filter((t): t is BaseTool => t !== undefined)
      : this.getAll();
    return tools.map((t) => t.toSchema());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  names(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Register a tool from a plugin with namespace prefix.
   * Alias for register() — the plugin loader handles prefixing.
   */
  registerFromPlugin(pluginName: string, tool: BaseTool): void {
    const prefixed = `${pluginName}:${tool.name}`;
    if (this.tools.has(prefixed)) {
      logger.warn('tool-registry', `Plugin tool "${prefixed}" already registered, overwriting`);
    }
    // Rename the tool to include namespace
    tool.name = prefixed;
    this.tools.set(prefixed, tool);
    logger.debug('tool-registry', `Registered plugin tool: ${prefixed}`);
  }

  /**
   * Get all tools matching a namespace prefix (e.g., "myPlugin:").
   */
  getByNamespace(namespace: string): BaseTool[] {
    const prefix = namespace.endsWith(':') ? namespace : `${namespace}:`;
    return Array.from(this.tools.values()).filter(t => t.name.startsWith(prefix));
  }
}

export const toolRegistry = new ToolRegistry();
