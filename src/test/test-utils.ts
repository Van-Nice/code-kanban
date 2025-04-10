import { Logger } from "../handlers/logger";

export class TestLogger implements Logger {
  private enableDebug: boolean = true;

  debug(message: string, ...args: any[]): void {
    if (this.enableDebug) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    console.info(`[INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }

  log(message: string, data?: any): void {
    // No-op for tests
  }
}
