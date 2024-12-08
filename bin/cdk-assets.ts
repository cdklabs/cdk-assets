import * as yargs from 'yargs';
import { list } from './list';
import { log, setGlobalProgressListener, setLogThreshold, VERSION } from './logging';
import { publish } from './publish';
import { AssetManifest, EventType, IPublishProgress, IPublishProgressListener } from '../lib';

class DefaultProgressListener implements IPublishProgressListener {
  public onPublishEvent(type: EventType, event: IPublishProgress): void {
    switch (type) {
      case EventType.FAIL:
        log('error', event.message);
        break;
      case EventType.DEBUG:
        log('verbose', event.message);
        break;
      default:
        log('info', event.message);
    }
  }
}

async function main() {
  const defaultListener = new DefaultProgressListener();
  setGlobalProgressListener(defaultListener);

  const argv = yargs
    .usage('$0 <cmd> [args]')
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      desc: 'Increase logging verbosity',
      count: true,
      default: 0,
    })
    .option('path', {
      alias: 'p',
      type: 'string',
      desc:
        'The path (file or directory) to load the assets from. If a directory, ' +
        `the file '${AssetManifest.DEFAULT_FILENAME}' will be loaded from it.`,
      default: '.',
      requiresArg: true,
    })
    .command(
      'ls',
      'List assets from the given manifest',
      (command) => command,
      wrapHandler(async (args) => {
        await list(args);
      })
    )
    .command(
      'publish [ASSET..]',
      'Publish assets in the given manifest',
      (command) =>
        command
          .option('profile', {
            type: 'string',
            describe: 'Profile to use from AWS Credentials file',
          })
          .positional('ASSET', {
            type: 'string',
            array: true,
            describe: 'Assets to publish (format: "ASSET[:DEST]"), default all',
          }),
      wrapHandler(async (args) => {
        await publish({
          path: args.path,
          assets: args.ASSET,
          profile: args.profile,
        });
      })
    )
    .demandCommand()
    .help()
    .strict() // Error on wrong command
    .version(VERSION)
    .showHelpOnFail(false).argv;

  // Evaluating .argv triggers the parsing but the command gets implicitly executed,
  // so we don't need the output.
  Array.isArray(argv);
}

/**
 * Wrap a command's handler with standard pre- and post-work
 */
function wrapHandler<A extends { verbose?: number }, R>(handler: (x: A) => Promise<R>) {
  return async (argv: A) => {
    if (argv.verbose) {
      setLogThreshold('verbose');
    }
    await handler(argv);
  };
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e.stack);
  process.exitCode = 1;
});
