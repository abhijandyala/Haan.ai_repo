export interface ToolResult {
  output: string;
  isError: boolean;
  metadata?: Record<string, unknown>;
}

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };

  abstract execute(params: Record<string, unknown>): Promise<ToolResult>;

  toSchema(): {
    name: string;
    description: string;
    parameters: { type: string; properties: Record<string, unknown>; required?: string[] };
  } {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    };
  }

  protected success(output: string, metadata?: Record<string, unknown>): ToolResult {
    return { output, isError: false, metadata };
  }

  protected error(output: string): ToolResult {
    return { output, isError: true };
  }
}
