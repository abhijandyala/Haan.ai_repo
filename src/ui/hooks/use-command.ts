export interface ParsedCommand {
  isCommand: boolean;
  command: string;
  args: string[];
  raw: string;
}

export function useCommand() {
  function parseCommand(input: string): ParsedCommand {
    const trimmed = input.trim();

    if (!trimmed.startsWith('/')) {
      return { isCommand: false, command: '', args: [], raw: trimmed };
    }

    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0] || '';
    const args = parts.slice(1);

    return { isCommand: true, command, args, raw: trimmed };
  }

  return { parseCommand };
}
