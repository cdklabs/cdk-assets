import { mockSpawn } from './mock-child_process';
import mockfs from './mock-fs';
import { setLogThreshold } from '../bin/logging';
import { shell } from '../lib/private/shell';
jest.mock('child_process');

describe('logging', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockfs({
      '/path/package.json': JSON.stringify({ version: '1.2.3' }),
    });
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    mockfs.restore();
  });

  test('docker stdout is captured during builds', async () => {
    // GIVEN
    setLogThreshold('verbose');
    const processOut = new Array<string>();
    const mockStdout = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      processOut.push(Buffer.isBuffer(chunk) ? chunk.toString() : (chunk as string));
      return true;
    });

    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '.'],
      stdout: 'Step 1/3 : FROM node:14\nStep 2/3 : WORKDIR /app\nStep 3/3 : COPY . .',
    });

    // WHEN
    await shell(['docker', 'build', '.']);

    // THEN
    expectAllSpawns();
    await new Promise((resolve) => setImmediate(resolve));

    const hasDockerOutput = processOut.some(
      (chunk) =>
        chunk.includes('Step 1/3') && chunk.includes('Step 2/3') && chunk.includes('Step 3/3')
    );

    expect(hasDockerOutput).toBe(true);
    mockStdout.mockRestore();
  });

  test('stderr is captured and written to process.stderr', async () => {
    // GIVEN
    const processErr = new Array<string>();
    const mockStderr = jest.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      processErr.push(Buffer.isBuffer(chunk) ? chunk.toString() : (chunk as string));
      return true;
    });

    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '.'],
      stderr: 'Warning: Something went wrong',
    });

    // WHEN
    await shell(['docker', 'build', '.']);

    // THEN
    expectAllSpawns();
    await new Promise((resolve) => setImmediate(resolve));

    expect(processErr.some((chunk) => chunk.includes('Warning: Something went wrong'))).toBe(true);
    mockStderr.mockRestore();
  });

  test('quiet mode suppresses stdout and stderr', async () => {
    // GIVEN
    const processOut = new Array<string>();
    const processErr = new Array<string>();

    const mockStdout = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      processOut.push(Buffer.isBuffer(chunk) ? chunk.toString() : (chunk as string));
      return true;
    });

    const mockStderr = jest.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      processErr.push(Buffer.isBuffer(chunk) ? chunk.toString() : (chunk as string));
      return true;
    });

    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '.'],
      stdout: 'Normal output',
      stderr: 'Warning output',
    });

    // WHEN
    await shell(['docker', 'build', '.'], { quiet: true });

    // THEN
    expectAllSpawns();
    await new Promise((resolve) => setImmediate(resolve));

    expect(processOut.length).toBe(0);
    expect(processErr.length).toBe(0);

    mockStdout.mockRestore();
    mockStderr.mockRestore();
  });

  test('custom logger receives command line', async () => {
    // GIVEN
    const loggedMessages: string[] = [];
    const logger = (message: string) => loggedMessages.push(message);

    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '.'],
    });

    // WHEN
    await shell(['docker', 'build', '.'], { logger });

    // THEN
    expectAllSpawns();
    expect(loggedMessages.length).toBe(1);
    expect(loggedMessages[0]).toContain('docker build .');
  });

  test('handles input option correctly', async () => {
    // GIVEN
    const expectedInput = 'some input';
    const processOut = new Array<string>();

    const mockStdout = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      processOut.push(Buffer.isBuffer(chunk) ? chunk.toString() : (chunk as string));
      return true;
    });

    const expectAllSpawns = mockSpawn({
      commandLine: ['cat'],
      stdout: expectedInput, // Echo back the input
    });

    // WHEN
    await shell(['cat'], { input: expectedInput });

    // THEN
    expectAllSpawns();
    await new Promise((resolve) => setImmediate(resolve));

    expect(processOut.some((chunk) => chunk.includes(expectedInput))).toBe(true);
    mockStdout.mockRestore();
  });

  test('throws error on non-zero exit code', async () => {
    // GIVEN
    const expectAllSpawns = mockSpawn({
      commandLine: ['docker', 'build', '.'],
      exitCode: 1,
      stderr: 'Command failed',
    });

    // WHEN/THEN
    await expect(shell(['docker', 'build', '.'])).rejects.toThrow('Command failed');

    expectAllSpawns();
  });
});
