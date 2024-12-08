import * as fs from 'fs';
import * as path from 'path';
import { EventType, IPublishProgress, IPublishProgressListener } from '../lib/progress';

export const VERSION = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), { encoding: 'utf-8' })
).version;

export type LogLevel = 'verbose' | 'info' | 'error';
let logThreshold: LogLevel = 'info';

// Global default progress listener that will be set if using the cli
// If using the library, you should set your own listener
let globalProgressListener: IPublishProgressListener | undefined;

export const LOG_LEVELS: Record<LogLevel, number> = {
  verbose: 1,
  info: 2,
  error: 3,
};

export function setLogThreshold(threshold: LogLevel) {
  logThreshold = threshold;
}

export function setGlobalProgressListener(listener: IPublishProgressListener) {
  globalProgressListener = listener;
}

// Convert log level to event type
function logLevelToEventType(level: LogLevel): EventType {
  switch (level) {
    case 'error':
      return EventType.FAIL;
    case 'verbose':
      return EventType.DEBUG;
    default:
      return EventType.DEBUG;
  }
}

export function log(level: LogLevel, message: string, percentComplete?: number) {
  if (LOG_LEVELS[level] >= LOG_LEVELS[logThreshold]) {
    console.error(`${level.padEnd(7, ' ')}: ${message}`);

    // Write to progress listener if configured
    if (globalProgressListener) {
      const progressEvent: IPublishProgress = {
        message: `${message}`,
        percentComplete: percentComplete,
        abort: () => {},
      };
      globalProgressListener.onPublishEvent(logLevelToEventType(level), progressEvent);
    }
  }
}

export class ShellOutputHandler {
  constructor(private readonly progressListener?: IPublishProgressListener) {}

  public handleOutput(chunk: any, isError: boolean = false) {
    const text = chunk.toString();

    if (isError) {
      process.stderr.write(text);
    } else {
      process.stdout.write(text);
    }

    // Send to progress listener if configured
    if (this.progressListener) {
      const progressEvent: IPublishProgress = {
        message: text,
        abort: () => {},
      };
      this.progressListener.onPublishEvent(
        isError ? EventType.FAIL : EventType.DEBUG,
        progressEvent
      );
    }
  }
}
