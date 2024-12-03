// test/docker-logging.test.ts
jest.mock('child_process');

import { FakeListener } from './fake-listener';
import { mockSpawn } from './mock-child_process';
import { Docker } from '../lib/private/docker';

describe('Docker logging', () => {
  test('captures stdout and stderr in progress listener', async () => {
    const progressListener = new FakeListener();
    const docker = new Docker({
      progressListener: progressListener,
    });

    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '--tag', 'test-image', '.'],
      stdout: 'stdout test string\n',
      stderr: 'stderr test string\n',
    });

    // Use the internal execute method directly for testing
    await (docker as any).execute(['build', '--tag', 'test-image', '.']);

    // Verify both stdout and stderr were captured
    expect(progressListener.messages).toEqual([
      '[docker stdout] stdout test string\n',
      '[docker stderr] stderr test string\n',
    ]);

    expectAllSpawns(progressListener.messages[0]);

    expectAllSpawns();
  });
});

function fakeLog(message: string): void {
  // do nothing
}
