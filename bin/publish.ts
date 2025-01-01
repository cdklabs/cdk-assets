import { log, LogLevel } from './logging';
import {
  AssetManifest,
  AssetPublishing,
  DefaultAwsClient,
  DestinationPattern,
  EventType,
  IPublishProgress,
  IPublishProgressListener,
  globalOutputHandler,
} from '../lib';

export async function publish(args: { path: string; assets?: string[]; profile?: string }) {
  let manifest = AssetManifest.fromPath(args.path);

  // AssetPublishing will assign the global output handler
  const pub = new AssetPublishing(manifest, {
    aws: new DefaultAwsClient(args.profile),
    progressListener: new ConsoleProgress(),
    throwOnError: false,
  });

  globalOutputHandler.verbose(
    `Loaded manifest from ${args.path}: ${manifest.entries.length} assets found`
  );

  if (args.assets && args.assets.length > 0) {
    const selection = args.assets.map((a) => DestinationPattern.parse(a));
    manifest = manifest.select(selection);
    globalOutputHandler.verbose(`Applied selection: ${manifest.entries.length} assets selected.`);
  }

  await pub.publish();

  if (pub.hasFailures) {
    for (const failure of pub.failures) {
      globalOutputHandler.error(`Failure: ${failure.error.stack}`);
    }

    process.exitCode = 1;
  }
}

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
};

class ConsoleProgress implements IPublishProgressListener {
  public onPublishEvent(type: EventType, event: IPublishProgress): void {
    log(EVENT_TO_LEVEL[type], `[${event.percentComplete}%] ${type}: ${event.message}`);
  }
}
