import * as child_process from 'child_process';
import * as events from 'events';

if (!(child_process as any).spawn.mockImplementationOnce) {
  throw new Error('Call "jest.mock(\'child_process\');" at the top of the test file!');
}

export interface Invocation {
  commandLine: string[];
  cwd?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  prefix?: boolean;
}

export function mockSpawn(...invocations: Invocation[]): () => void {
  let mock = child_process.spawn as any;
  for (const _invocation of invocations) {
    const invocation = _invocation;
    mock = mock.mockImplementationOnce(
      (binary: string, args: string[], options: child_process.SpawnOptions) => {
        if (invocation.prefix) {
          expect([binary, ...args].slice(0, invocation.commandLine.length)).toEqual(
            invocation.commandLine
          );
        } else {
          expect([binary, ...args]).toEqual(invocation.commandLine);
        }

        if (invocation.cwd != null) {
          expect(invocation.cwd).toEqual((options.cwd as string).slice(-invocation.cwd.length));
        }

        const child: any = new events.EventEmitter();
        child.stdin = new events.EventEmitter();
        child.stdin.write = jest.fn();
        child.stdin.end = jest.fn();
        child.stdout = new events.EventEmitter();
        child.stderr = new events.EventEmitter();

        if (invocation.stdout) {
          mockEmit(child.stdout, 'data', Buffer.from(invocation.stdout));
        }
        if (invocation.stderr) {
          // Send stderr data after stdout
          setTimeout(() => {
            if (invocation.stderr) {
              mockEmit(child.stderr, 'data', Buffer.from(invocation.stderr));
            }
          }, 10);
        }
        setTimeout(() => {
          mockEmit(child, 'close', invocation.exitCode ?? 0);
        }, 20);

        return child;
      }
    );
  }

  mock.mockImplementation((binary: string, args: string[], _options: any) => {
    throw new Error(`Did not expect call of ${JSON.stringify([binary, ...args])}`);
  });

  return () => {
    expect(mock).toHaveBeenCalledTimes(invocations.length);
  };
}

/**
 * Must do this on the next tick, as emitter.emit() expects all listeners to have been attached already
 */
function mockEmit(emitter: events.EventEmitter, event: string, data: any) {
  setImmediate(() => {
    emitter.emit(event, data);
  });
}
