import { LogLevel } from '../bin/logging';
import { EventType } from '../lib';
import { IPublishProgress, IPublishProgressListener } from '../lib/progress';

let logThreshold = 'info';

const LOG_LEVELS: Record<LogLevel, number> = {
  verbose: 1,
  info: 2,
  error: 3,
};

const EVENT_TO_LEVEL: Record<EventType, LogLevel> = {
  build: 'verbose',
  cached: 'verbose',
  check: 'verbose',
  debug: 'verbose',
  fail: 'error',
  found: 'verbose',
  start: 'info',
  success: 'info',
  upload: 'verbose',
  shell_open: 'verbose',
  shell_data: 'verbose',
  shell_close: 'verbose',
};

/**
 * Represents a logged message with additional metadata purely for testing purposes.
 */
export interface LoggedMessage {
  /**
   * The {@link EventType} of the logged message
   */
  readonly type: EventType;

  /**
   * The message text
   */
  readonly message: string;

  /**
   * The stream this message would have been logged to, if cdk-assets was run from the CLI
   */
  readonly stream: 'stdout' | 'stderr';

  /**
   * The {@link LogLevel} of this message
   */
  readonly level: LogLevel;
}

/**
 * Mock implementation of IPublishProgressListener that captures events for testing purposes.
 */
export class MockProgressListener implements IPublishProgressListener {
  public messages: LoggedMessage[] = [];

  onPublishEvent(type: EventType, event: IPublishProgress): void {
    const level = EVENT_TO_LEVEL[type];
    this.messages.push({
      type,
      message: event.message,
      stream: ['open', 'data_stdout', 'close'].includes(type) ? 'stdout' : 'stderr',
      level,
    });
  }

  /**
   * Clear captured messages
   */
  clear(): void {
    this.messages = [];
  }
}
