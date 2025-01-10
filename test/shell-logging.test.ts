import { mockSpawn } from './mock-child_process';
import mockfs from './mock-fs';
import { MockProgressListener } from './mock-progress-listener';
import { setLogThreshold } from '../bin/logging';
import { EventType, MessageOrigin } from '../lib';
import { shell } from '../lib/private/shell';

jest.mock('child_process');

describe('shell', () => {
  let progressListener: MockProgressListener;
  let eventPublisher: (type: EventType, message: string, messageOrigin?: MessageOrigin) => void;

  beforeEach(() => {
    progressListener = new MockProgressListener();
    eventPublisher = (type, message, messageOrigin?) =>
      progressListener.onPublishEvent(
        type,
        {
          message,
          percentComplete: 0,
          abort: () => {},
        },
        messageOrigin ?? 'cdk_assets'
      );
    mockfs({
      '/path/package.json': JSON.stringify({ version: '1.2.3' }),
    });
  });

  afterEach(() => {
    mockfs.restore();
  });

  test('docker stdout is captured during builds', async () => {
    // GIVEN
    setLogThreshold('verbose');

    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '.'],
      stdout: 'Step 1/3 : FROM node:14\nStep 2/3 : WORKDIR /app\nStep 3/3 : COPY . .',
    });

    // WHEN
    await shell(['docker', 'build', '.'], {
      eventPublisher,
      quiet: true,
      subprocessOutputDestination: 'publish',
    });

    // THEN
    expectAllSpawns();

    const dockerOutputMessages = progressListener.messages.filter(
      (msg) =>
        msg.message.includes('Step 1/3') ||
        msg.message.includes('Step 2/3') ||
        msg.message.includes('Step 3/3')
    );

    expect(dockerOutputMessages.length).toBeGreaterThan(0);
  });

  test('stderr is captured', async () => {
    // GIVEN
    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '.'],
      stderr: 'Warning: Something went wrong',
    });

    // WHEN
    await shell(['docker', 'build', '.'], {
      eventPublisher,
      quiet: true,
      subprocessOutputDestination: 'publish',
    });

    // THEN
    expectAllSpawns();

    const errorMessages = progressListener.messages.filter((msg) =>
      msg.message.includes('Warning: Something went wrong')
    );

    expect(errorMessages.length).toBeGreaterThan(0);
  });

  test('handles input option correctly', async () => {
    // GIVEN
    const expectedInput = 'some input';

    const expectAllSpawns = mockSpawn({
      commandLine: ['cat'],
      stdout: expectedInput,
    });

    // WHEN
    await shell(['cat'], {
      input: expectedInput,
      eventPublisher,
      quiet: true,
      subprocessOutputDestination: 'publish',
    });

    // THEN
    expectAllSpawns();

    const inputMessages = progressListener.messages.filter((msg) =>
      msg.message.includes(expectedInput)
    );

    expect(inputMessages.length).toBeGreaterThan(0);
  });

  test('throws error on non-zero exit code', async () => {
    // GIVEN
    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '.'],
      exitCode: 1,
      stderr: 'Command failed',
    });

    // WHEN/THEN
    await expect(
      shell(['docker', 'build', '.'], {
        eventPublisher,
        quiet: true,
        subprocessOutputDestination: 'publish',
      })
    ).rejects.toThrow('Command failed');

    expectAllSpawns();

    const errorMessages = progressListener.messages.filter((msg) =>
      msg.message.includes('Command failed')
    );

    expect(errorMessages.length).toBeGreaterThan(0);
  });
});
