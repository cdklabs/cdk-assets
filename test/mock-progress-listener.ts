import { LogLevel, logThreshold, LOG_LEVELS } from '../bin/logging';
import { EVENT_TO_LEVEL } from '../bin/publish';
import { EventType } from '../lib';
import { IPublishProgress, IPublishProgressListener } from '../lib/progress';

/**
 * Represents a logged message with additional metadata purely for testing purposes.
 */
export interface LoggedMessage {
    /**
     * the {@link EventType} of the logged message
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

  /**
   * Whether this message would have been logged if cdk-assets was run from the CLI
   */
  readonly wouldHaveBeenLogged: boolean;
}

/**
 * Mock implementation of IPublishProgressListener that captures events for testing purposes.
 */
export class MockProgressListener implements IPublishProgressListener {
  public messages: LoggedMessage[] = [];

  onPublishEvent(type: EventType, event: IPublishProgress, forceStdOut?: boolean): void {
    const level = EVENT_TO_LEVEL[type];
    this.messages.push({
      type,
      message: event.message,
      stream: forceStdOut ? 'stdout' : 'stderr',
      level,
      wouldHaveBeenLogged: LOG_LEVELS[level] >= LOG_LEVELS[logThreshold],
    });
  }

  /**
   * Clear captured messages
   */
  clear(): void {
    this.messages = [];
  }
}
