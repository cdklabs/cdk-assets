import * as fs from 'fs';
import * as path from 'path';
import { EventType, IPublishProgress, IPublishProgressListener } from '../lib/progress';

export const VERSION = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), { encoding: 'utf-8' })
).version;

export type LogLevel = 'verbose' | 'info' | 'error';
let logThreshold: LogLevel = 'info';

export const LOG_LEVELS: Record<LogLevel, number> = {
  verbose: 1,
  info: 2,
  error: 3,
};

export function setLogThreshold(threshold: LogLevel) {
  logThreshold = threshold;
}

export function log(level: LogLevel, message: string ) {
  // should be entirely irrelevant but just to verify that the globalProgressListener is set
    console.error(`${level.padEnd(7, ' ')}: ${message}`);
}

export class ShellOutputHandler {
  constructor(private readonly progressListener?: IPublishProgressListener) {}

  public handleOutput(chunk: any, isError: boolean = false) {
    const text = chunk.toString();

    // Send to progress listener if configured
    if (this.progressListener && text.length > 0) {
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