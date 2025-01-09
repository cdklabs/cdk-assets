import { DockerFactory } from './docker';
import { IAws } from '../aws';
import { EventType } from '../progress';

/**
 * Options for publishing an asset.
 */
export interface PublishOptions {
  /**
   * Whether or not to allow cross account publishing. That is,
   * publish to a bucket belonging to a different account than the target account.
   *
   * @default true
   */
  readonly allowCrossAccount?: boolean;
}

/**
 * Handler for asset building and publishing.
 */
export interface IAssetHandler {
  /**
   * Build the asset.
   */
  build(): Promise<void>;

  /**
   * Publish the asset.
   */
  publish(options?: PublishOptions): Promise<void>;

  /**
   * Return whether the asset already exists
   */
  isPublished(): Promise<boolean>;
}

export interface IHandlerHost {
  readonly aws: IAws;
  readonly aborted: boolean;
  readonly dockerFactory: DockerFactory;

  emitMessage(type: EventType, m: string): void;
}
