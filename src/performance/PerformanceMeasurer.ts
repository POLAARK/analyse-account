export class PerformanceMeasurer {
  private startTimes: Map<string, number>;
  private elapsedTimes: Map<string, number>;

  constructor() {
    this.startTimes = new Map();
    this.elapsedTimes = new Map();
  }

  start(key: string): void {
    this.startTimes.set(key, performance.now());
  }

  stop(key: string): number {
    const startTime = this.startTimes.get(key);
    if (startTime === undefined) {
      throw new Error(`No timer started for key '${key}'`);
    }

    const endTime = performance.now();
    const elapsed = endTime - startTime;
    this.elapsedTimes.set(key, elapsed);
    console.log(`Execution time of '${key}' ${this.getElapsedTime(key)} ms`);
    return elapsed;
  }

  getElapsedTime(key: string): number {
    const elapsed = this.elapsedTimes.get(key);
    if (elapsed === undefined) {
      throw new Error(`No elapsed time recorded for key '${key}'`);
    }
    return elapsed;
  }

  printTimes(): void {
    this.elapsedTimes.forEach((time, key) => {
      console.log(`${key}: ${time.toFixed(3)} ms`);
    });
  }
}
