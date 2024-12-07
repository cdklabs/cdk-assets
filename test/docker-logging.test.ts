// test/docker-logging.test.ts
jest.mock('child_process');

import { FakeListener } from './fake-listener';
import { mockSpawn } from './mock-child_process';
import { Docker } from '../lib/private/docker';
import { EventType } from '../lib/progress';

describe('Docker logging', () => {
  let progressListener: FakeListener;
  let docker: Docker;

  beforeEach(() => {
    progressListener = new FakeListener();
    docker = new Docker({
      progressListener: progressListener,
    });
  });

  test('captures stdout as DEBUG events', async () => {
    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '--tag', 'test-image', '.'],
      stdout: 'stdout test string\n',
    });

    await (docker as any).execute(['build', '--tag', 'test-image', '.']);

    expect(progressListener.types).toEqual([EventType.DEBUG]);
    expect(progressListener.messages).toEqual(['[docker stdout] stdout test string\n']);

    expectAllSpawns();
  });

  test('captures stderr as FAIL events', async () => {
    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '--tag', 'test-image', '.'],
      stderr: 'error test string\n',
    });

    await (docker as any).execute(['build', '--tag', 'test-image', '.']);
    // Give time for events to process
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(progressListener.types).toEqual([EventType.FAIL]);
    expect(progressListener.messages).toEqual(['[docker stderr] error test string\n']);

    expectAllSpawns();
  });

  test('captures both stdout and stderr with correct event types', async () => {
    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '--tag', 'test-image', '.'],
      stdout: 'stdout test string\n',
      stderr: 'error test string\n',
    });

    await (docker as any).execute(['build', '--tag', 'test-image', '.']);
    // Give time for events to process
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(progressListener.types).toEqual([EventType.DEBUG, EventType.FAIL]);
    expect(progressListener.messages).toEqual([
      '[docker stdout] stdout test string\n',
      '[docker stderr] error test string\n',
    ]);

    expectAllSpawns();
  });

  test('does not emit events when quiet option is true', async () => {
    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '--tag', 'test-image', '.'],
      stdout: 'stdout test string\n',
      stderr: 'error test string\n',
    });

    await (docker as any).execute(['build', '--tag', 'test-image', '.'], { quiet: true });

    expect(progressListener.types).toHaveLength(0);
    expect(progressListener.messages).toHaveLength(0);

    expectAllSpawns();
  });

  test('handles empty stdout/stderr without emitting events', async () => {
    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '--tag', 'test-image', '.'],
      stdout: '',
      stderr: '',
    });

    await (docker as any).execute(['build', '--tag', 'test-image', '.']);

    expect(progressListener.types).toHaveLength(0);
    expect(progressListener.messages).toHaveLength(0);

    expectAllSpawns();
  });

  test('preserves multiline output formatting', async () => {
    const multilineStdout = 'Line 1\nLine 2\nLine 3\n';
    const multilineStderr = 'Error 1\nError 2\n';

    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '--tag', 'test-image', '.'],
      stdout: multilineStdout,
      stderr: multilineStderr,
    });

    await (docker as any).execute(['build', '--tag', 'test-image', '.']);

    expect(progressListener.types).toEqual([EventType.DEBUG, EventType.FAIL]);
    expect(progressListener.messages).toEqual([
      '[docker stdout] Line 1\nLine 2\nLine 3\n',
      '[docker stderr] Error 1\nError 2\n',
    ]);

    expectAllSpawns();
  });

  test('works without a progress listener', async () => {
    const dockerNoListener = new Docker({});

    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '--tag', 'test-image', '.'],
      stdout: 'stdout test string\n',
      stderr: 'error test string\n',
    });

    await (dockerNoListener as any).execute(['build', '--tag', 'test-image', '.']);

    expectAllSpawns();
  });
});
