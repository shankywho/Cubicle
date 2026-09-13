import fs from "node:fs";
import path from "node:path";
import type { OrgEvent } from "./types.js";

export type EventListener = (event: OrgEvent) => void;

export class EventBus {
  private logFilePath: string;
  private listeners: EventListener[] = [];

  constructor(logFilePath: string = path.resolve(process.cwd(), "event_log.jsonl")) {
    this.logFilePath = logFilePath;
  }

  /**
   * Subscribe to live events emitted through the bus.
   */
  public subscribe(listener: EventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Emit an OrgEvent. Appends serialized JSON to event_log.jsonl and notifies listeners.
   */
  public emit(event: OrgEvent): void {
    const line = JSON.stringify(event) + "\n";
    fs.appendFileSync(this.logFilePath, line, "utf-8");

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("Error in event listener:", err);
      }
    }
  }

  /**
   * Helper to reset the log file before a fresh run.
   */
  public clearLog(): void {
    if (fs.existsSync(this.logFilePath)) {
      fs.unlinkSync(this.logFilePath);
    }
  }

  public getLogPath(): string {
    return this.logFilePath;
  }
}
