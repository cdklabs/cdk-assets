import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'verbose' | 'info' | 'error';
export let logThreshold: LogLevel = 'info';

export const VERSION = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), { encoding: 'utf-8' })
).version;

export const LOG_LEVELS: Record<LogLevel, number> = {
  verbose: 1,
  info: 2,
  error: 3,
};

export function setLogThreshold(threshold: LogLevel) {
  logThreshold = threshold;
}

export function log(level: LogLevel, message: string, forceStdOut = false) {
  if (LOG_LEVELS[level] >= LOG_LEVELS[logThreshold]) {
    if (forceStdOut) {
      console.log(`${level.padEnd(7, ' ')}: ${message}`);
    } else {
      console.error(`${level.padEnd(7, ' ')}: ${message}`);
    }
  }
}
