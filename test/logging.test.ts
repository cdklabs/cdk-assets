jest.mock('child_process');

import { GetBucketLocationCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { FakeListener } from './fake-listener';
import { mockSpawn } from './mock-child_process';
import {
  log,
  LOG_LEVELS,
  setLogThreshold,
  ShellOutputHandler,
  setGlobalProgressListener,
  VERSION,
} from '../bin/logging';
import { AssetManifest, AssetPublishing } from '../lib';
import { MockAws, mockS3 } from './mock-aws';
import mockfs from './mock-fs';
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
    expect(progressListener.messages).toEqual(['stdout test string\n']);

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
    expect(progressListener.messages).toEqual(['error test string\n']);

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
    expect(progressListener.messages).toEqual(['stdout test string\n', 'error test string\n']);

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
    expect(progressListener.messages).toEqual(['Line 1\nLine 2\nLine 3\n', 'Error 1\nError 2\n']);

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

describe('logging functionality', () => {
  let originalConsoleError: typeof console.error;
  let mockConsoleError: jest.Mock;

  beforeEach(() => {
    // Store original console.error and replace with mock
    originalConsoleError = console.error;
    mockConsoleError = jest.fn();
    console.error = mockConsoleError;
  });

  afterEach(() => {
    // Restore original console.error
    console.error = originalConsoleError;
  });

  describe('log levels', () => {
    test('logs respect threshold level - verbose', () => {
      setLogThreshold('verbose');
      log('verbose', 'verbose message');
      log('info', 'info message');
      log('error', 'error message');

      expect(mockConsoleError).toHaveBeenCalledTimes(3);
      expect(mockConsoleError).toHaveBeenCalledWith('verbose: verbose message');
      expect(mockConsoleError).toHaveBeenCalledWith('info   : info message');
      expect(mockConsoleError).toHaveBeenCalledWith('error  : error message');
    });

    test('logs respect threshold level - info', () => {
      setLogThreshold('info');
      log('verbose', 'verbose message');
      log('info', 'info message');
      log('error', 'error message');

      expect(mockConsoleError).toHaveBeenCalledTimes(2);
      expect(mockConsoleError).not.toHaveBeenCalledWith('verbose: verbose message');
      expect(mockConsoleError).toHaveBeenCalledWith('info   : info message');
      expect(mockConsoleError).toHaveBeenCalledWith('error  : error message');
    });

    test('logs respect threshold level - error', () => {
      setLogThreshold('error');
      log('verbose', 'verbose message');
      log('info', 'info message');
      log('error', 'error message');

      expect(mockConsoleError).toHaveBeenCalledTimes(1);
      expect(mockConsoleError).not.toHaveBeenCalledWith('verbose: verbose message');
      expect(mockConsoleError).not.toHaveBeenCalledWith('info   : info message');
      expect(mockConsoleError).toHaveBeenCalledWith('error  : error message');
    });

    test('log levels are properly ordered', () => {
      expect(LOG_LEVELS.verbose).toBeLessThan(LOG_LEVELS.info);
      expect(LOG_LEVELS.info).toBeLessThan(LOG_LEVELS.error);
    });
  });

  describe('ShellOutputHandler', () => {
    test('handles empty chunks appropriately', () => {
      const mockProgressListener = {
        onPublishEvent: jest.fn(),
      };
      const handler = new ShellOutputHandler(mockProgressListener);

      handler.handleOutput('');
      handler.handleOutput('', true);

      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledTimes(2);
      expect(mockProgressListener.onPublishEvent).toHaveBeenNthCalledWith(
        1,
        EventType.DEBUG,
        expect.objectContaining({ message: '' })
      );
      expect(mockProgressListener.onPublishEvent).toHaveBeenNthCalledWith(
        2,
        EventType.FAIL,
        expect.objectContaining({ message: '' })
      );
    });

    test('emits correct event types for stdout and stderr', () => {
      const mockProgressListener = {
        onPublishEvent: jest.fn(),
      };
      const handler = new ShellOutputHandler(mockProgressListener);

      handler.handleOutput('stdout message');
      handler.handleOutput('stderr message', true);

      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledTimes(2);
      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledWith(
        EventType.DEBUG,
        expect.objectContaining({ message: 'stdout message' })
      );
      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledWith(
        EventType.FAIL,
        expect.objectContaining({ message: 'stderr message' })
      );
    });

    test('preserves original output when no progress listener is provided', () => {
      const handler = new ShellOutputHandler();
      const originalStdout = process.stdout.write;
      const originalStderr = process.stderr.write;
      const mockStdout = jest.fn();
      const mockStderr = jest.fn();
      process.stdout.write = mockStdout;
      process.stderr.write = mockStderr;

      try {
        handler.handleOutput('stdout message');
        handler.handleOutput('stderr message', true);

        expect(mockStdout).toHaveBeenCalledWith('stdout message');
        expect(mockStderr).toHaveBeenCalledWith('stderr message');
      } finally {
        process.stdout.write = originalStdout;
        process.stderr.write = originalStderr;
      }
    });

    test('handles different chunk types properly', () => {
      const mockProgressListener = {
        onPublishEvent: jest.fn(),
      };
      const handler = new ShellOutputHandler(mockProgressListener);

      // Test Buffer input
      handler.handleOutput(Buffer.from('buffer message'));
      // Test object with toString
      handler.handleOutput({ toString: () => 'object message' });

      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledWith(
        EventType.DEBUG,
        expect.objectContaining({ message: 'buffer message' })
      );
      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledWith(
        EventType.DEBUG,
        expect.objectContaining({ message: 'object message' })
      );
    });
  });

  describe('log message formatting', () => {
    test('correctly pads log level strings', () => {
      setLogThreshold('verbose');

      const testMessage = 'test message';
      log('verbose', testMessage);
      log('info', testMessage);
      log('error', testMessage);

      expect(mockConsoleError).toHaveBeenCalledWith('verbose: test message');
      expect(mockConsoleError).toHaveBeenCalledWith('info   : test message');
      expect(mockConsoleError).toHaveBeenCalledWith('error  : test message');
    });

    test('handles messages with percentage complete', () => {
      setLogThreshold('info');

      log('info', 'Progress message', 50);

      expect(mockConsoleError).toHaveBeenCalledWith('info   : Progress message');
    });
  });

  describe('version logging', () => {
    test('VERSION is properly defined', () => {
      expect(VERSION).toBeDefined();
      expect(typeof VERSION).toBe('string');
    });
  });
});

describe('logging event routing', () => {
  let mockProgressListener: { onPublishEvent: jest.Mock };
  let originalConsoleError: typeof console.error;
  let originalStdoutWrite: typeof process.stdout.write;
  let originalStderrWrite: typeof process.stderr.write;

  beforeEach(() => {
    mockProgressListener = { onPublishEvent: jest.fn() };
    setGlobalProgressListener(null as any);

    // Store originals
    originalConsoleError = console.error;
    originalStdoutWrite = process.stdout.write;
    originalStderrWrite = process.stderr.write;

    // Mock console and streams
    console.error = jest.fn();
    process.stdout.write = jest.fn();
    process.stderr.write = jest.fn();

    // Reset log threshold
    setLogThreshold('verbose');
  });

  afterEach(() => {
    setGlobalProgressListener(null as any);
    mockfs.restore();
    // Restore originals
    console.error = originalConsoleError;
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  });

  describe('direct logging via log()', () => {
    test('routes all log levels through progress listener', () => {
      setGlobalProgressListener(mockProgressListener);

      // Test each log level
      log('verbose', 'verbose message');
      log('info', 'info message');
      log('error', 'error message');

      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledTimes(3);

      // Check verbose maps to DEBUG
      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledWith(
        EventType.DEBUG,
        expect.objectContaining({ message: 'verbose message' })
      );

      // Check info maps to DEBUG
      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledWith(
        EventType.DEBUG,
        expect.objectContaining({ message: 'info message' })
      );

      // Check error maps to FAIL
      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledWith(
        EventType.FAIL,
        expect.objectContaining({ message: 'error message' })
      );
    });

    test('respects log threshold when routing to progress listener', () => {
      setGlobalProgressListener(mockProgressListener);
      setLogThreshold('error');

      log('verbose', 'verbose message');
      log('info', 'info message');
      log('error', 'error message');

      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledTimes(1);
      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledWith(
        EventType.FAIL,
        expect.objectContaining({ message: 'error message' })
      );
    });
  });

  describe('shell output handling', () => {
    test('routes all shell output through progress listener', () => {
      const handler = new ShellOutputHandler(mockProgressListener);

      handler.handleOutput('stdout message');
      handler.handleOutput('stderr message', true);

      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledTimes(2);

      // Check stdout routes to DEBUG
      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledWith(
        EventType.DEBUG,
        expect.objectContaining({ message: 'stdout message' })
      );

      // Check stderr routes to FAIL
      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledWith(
        EventType.FAIL,
        expect.objectContaining({ message: 'stderr message' })
      );
    });

    test('routes multi-line output through progress listener', () => {
      const handler = new ShellOutputHandler(mockProgressListener);
      const multilineOutput = 'line1\nline2\nline3';

      handler.handleOutput(multilineOutput);

      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledTimes(1);
      expect(mockProgressListener.onPublishEvent).toHaveBeenCalledWith(
        EventType.DEBUG,
        expect.objectContaining({ message: multilineOutput })
      );
    });
  });

  describe('asset publishing progress events', () => {
    beforeEach(() => {
      mockS3.reset();
      // Mock successful bucket location check
      mockS3.on(GetBucketLocationCommand).resolves({});
      // Mock successful list objects check
      mockS3.on(ListObjectsV2Command).resolves({ Contents: [] });
      mockfs({
        '/simple/cdk.out/assets.json': JSON.stringify({
          version: '1.0.0',
          files: {
            asset1: {
              source: {
                path: 'some_file',
              },
              destinations: {
                dest1: {
                  region: 'us-north-50',
                  assumeRoleArn: 'arn:aws:role',
                  bucketName: 'some_bucket',
                  objectKey: 'some_key',
                },
              },
            },
          },
        }),
        '/simple/cdk.out/some_file': 'FILE_CONTENTS',
      });
    });

    test('routes all publishing events through progress listener', async () => {
      const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/simple/cdk.out')), {
        aws: new MockAws(),
        progressListener: mockProgressListener,
      });

      await pub.publish();

      // Verify we get events for start, check, and either found or upload
      const eventTypes = mockProgressListener.onPublishEvent.mock.calls.map((call) => call[0]);

      expect(eventTypes).toContain(EventType.START);
      expect(eventTypes).toContain(EventType.CHECK);
      expect(eventTypes.some((t) => t === EventType.FOUND || t === EventType.UPLOAD)).toBe(true);
    });

    test('routes failure events through progress listener', async () => {
      // Make S3 operations fail
      mockS3.reset();
      mockS3.on(GetBucketLocationCommand).rejects(new Error('Simulated failure'));

      const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/simple/cdk.out')), {
        aws: new MockAws(),
        progressListener: mockProgressListener,
      });

      await pub.publish().catch(() => {}); // Ignore the error

      const eventTypes = mockProgressListener.onPublishEvent.mock.calls.map((call) => call[0]);
      expect(eventTypes).toContain(EventType.FAIL);
    });
  });
});
