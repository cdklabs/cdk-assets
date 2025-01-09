import * as child_process from 'child_process';
import { EventType } from '../progress';

export type EventPublisher = (event: EventType, message: string, forceStdOut?: boolean) => void;

export interface ShellOptions extends child_process.SpawnOptions {
  readonly quiet?: boolean;
  readonly eventPublisher: EventPublisher;
  readonly input?: string;
}

/**
 * OS helpers
 *
 * Shell function which both prints to stdout and collects the output into a
 * string.
 */
export async function shell(command: string[], options: ShellOptions): Promise<string> {
  options.eventPublisher(EventType.DEBUG, renderCommandLine(command));
  const child = child_process.spawn(command[0], command.slice(1), {
    ...options,
    stdio: [options.input ? 'pipe' : 'ignore', 'pipe', 'pipe'],
  });

  return new Promise<string>((resolve, reject) => {
    if (options.input) {
      child.stdin!.write(options.input);
      child.stdin!.end();
    }

    const stdout = new Array<any>();
    const stderr = new Array<any>();

    // Both log to debug and collect
    child.stdout!.on('data', (chunk) => {
      if (!options.quiet) {
        const message = Buffer.isBuffer(chunk) ? chunk.toString() : chunk;
        // Emit events on stdout since we received the output on stdout
        options.eventPublisher(EventType.DEBUG, message, true);
      }
      stdout.push(chunk);
    });

    child.stderr!.on('data', (chunk) => {
      if (!options.quiet) {
        const message = Buffer.isBuffer(chunk) ? chunk.toString() : chunk;
        options.eventPublisher(EventType.DEBUG, message);
      }
      stderr.push(chunk);
    });

    child.once('error', reject);

    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString('utf-8'));
      } else {
        const out = Buffer.concat(stderr).toString('utf-8').trim();
        reject(
          new ProcessFailed(
            code,
            signal,
            `${renderCommandLine(command)} exited with ${code != null ? 'error code' : 'signal'} ${code ?? signal}: ${out}`
          )
        );
      }
    });
  });
}

export type ProcessFailedError = ProcessFailed;

class ProcessFailed extends Error {
  public readonly code = 'PROCESS_FAILED';

  constructor(
    public readonly exitCode: number | null,
    public readonly signal: NodeJS.Signals | null,
    message: string
  ) {
    super(message);
  }
}

/**
 * Render the given command line as a string
 *
 * Probably missing some cases but giving it a good effort.
 */
function renderCommandLine(cmd: string[]) {
  if (process.platform !== 'win32') {
    return doRender(cmd, hasAnyChars(' ', '\\', '!', '"', "'", '&', '$'), posixEscape);
  } else {
    return doRender(cmd, hasAnyChars(' ', '"', '&', '^', '%'), windowsEscape);
  }
}

/**
 * Render a UNIX command line
 */
function doRender(
  cmd: string[],
  needsEscaping: (x: string) => boolean,
  doEscape: (x: string) => string
): string {
  return cmd.map((x) => (needsEscaping(x) ? doEscape(x) : x)).join(' ');
}

/**
 * Return a predicate that checks if a string has any of the indicated chars in it
 */
function hasAnyChars(...chars: string[]): (x: string) => boolean {
  return (str: string) => {
    return chars.some((c) => str.indexOf(c) !== -1);
  };
}

/**
 * Escape a shell argument for POSIX shells
 *
 * Wrapping in single quotes and escaping single quotes inside will do it for us.
 */
function posixEscape(x: string) {
  // Turn ' -> '"'"'
  x = x.replace(/'/g, "'\"'\"'");
  return `'${x}'`;
}

/**
 * Escape a shell argument for cmd.exe
 *
 * This is how to do it right, but I'm not following everything:
 *
 * https://blogs.msdn.microsoft.com/twistylittlepassagesallalike/2011/04/23/everyone-quotes-command-line-arguments-the-wrong-way/
 */
function windowsEscape(x: string): string {
  // First surround by double quotes, ignore the part about backslashes
  x = `"${x}"`;
  // Now escape all special characters
  const shellMeta = new Set<string>(['"', '&', '^', '%']);
  return x
    .split('')
    .map((c) => (shellMeta.has(x) ? '^' + c : c))
    .join('');
}
