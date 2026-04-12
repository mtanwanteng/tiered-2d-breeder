export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogCategory = "player" | "api" | "game" | "era" | "system";

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
}

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  private entries: LogEntry[] = [];
  private listeners: Array<(entry: LogEntry) => void> = [];
  minLevel: LogLevel = "debug";
  activeCategories: Set<LogCategory> = new Set(["player", "api", "game", "era", "system"]);

  private emit(level: LogLevel, category: LogCategory, message: string) {
    const entry: LogEntry = { timestamp: Date.now(), level, category, message };
    this.entries.push(entry);
    if (this.entries.length > 500) this.entries.shift();

    // Mirror to real console
    const tag = `[${category}]`;
    if (level === "error") console.error(tag, message);
    else if (level === "warn") console.warn(tag, message);
    else if (level === "debug") console.debug(tag, message);
    else console.log(tag, message);

    for (const fn of this.listeners) fn(entry);
  }

  debug(category: LogCategory, message: string) { this.emit("debug", category, message); }
  info(category: LogCategory, message: string) { this.emit("info", category, message); }
  warn(category: LogCategory, message: string) { this.emit("warn", category, message); }
  error(category: LogCategory, message: string) { this.emit("error", category, message); }

  onEntry(fn: (entry: LogEntry) => void) { this.listeners.push(fn); }

  getFiltered(): LogEntry[] {
    const min = LOG_LEVELS[this.minLevel];
    return this.entries.filter(
      (e) => LOG_LEVELS[e.level] >= min && this.activeCategories.has(e.category)
    );
  }
}

export const log = new Logger();
export type { LogEntry };

