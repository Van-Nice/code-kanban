export class Logger {
  private enableDebug: boolean;

  constructor(options: { debug: boolean }) {
    this.enableDebug = options.debug;
  }

  log(message: string, data?: any): void {
    console.log(message, data);
  }

  debug(message: string, data?: any): void {
    if (this.enableDebug) {
      console.log(`[DEBUG] ${message}`, data);
    }
  }

  error(message: string, error?: any): void {
    console.error(`[ERROR] ${message}`, error);
  }

  info(message: string, data?: any): void {
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data) : "");
  }
}
