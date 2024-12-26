jest.mock('child_process');

import { Manifest } from '@aws-cdk/cloud-assembly-schema';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { DescribeImagesCommand, DescribeRepositoriesCommand, GetAuthorizationTokenCommand } from '@aws-sdk/client-ecr';
import { MockAws, mockS3, mockEcr } from './mock-aws';
import { mockSpawn } from './mock-child_process';
import mockfs from './mock-fs';
import { AssetManifest, AssetPublishing, EventType } from '../lib';

describe('Console Logging', () => {
  // Store original console methods
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  const originalConsoleInfo = console.info;
  const originalConsoleDebug = console.debug;

  // Create spies for console methods
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleInfoSpy: jest.SpyInstance;
  let consoleDebugSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock filesystem with test assets
    mockfs({
      '/test/cdk.out/assets.json': JSON.stringify({
        version: Manifest.version(),
        files: {
          asset1: {
            source: {
              path: 'some_file',
            },
            destinations: {
              dest1: {
                bucketName: 'test-bucket',
                objectKey: 'test-key',
                region: 'us-east-1',
              },
            },
          },
        },
      }),
      '/test/cdk.out/some_file': 'test content',
    });

    // Set up spies for all console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    // Mock S3 client to prevent actual AWS calls
    mockS3.on(ListObjectsV2Command).resolves({
      Contents: [],
    });
  });

  afterEach(() => {
    mockfs.restore();

    // Restore all console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    console.info = originalConsoleInfo;
    console.debug = originalConsoleDebug;

    // Clear all mocks
    jest.clearAllMocks();
  });

  test('no console output during successful asset publishing while still publishing assets', async () => {
    const aws = new MockAws();
    const publishedAssets: string[] = [];
    const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/test/cdk.out')), {
      aws,
      progressListener: {
        onPublishEvent: (type, event) => {
          if (type === 'success') {
            publishedAssets.push(event.message);
          }
        },
      },
    });

    await pub.publish();

    // Verify no console output occurred
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleDebugSpy).not.toHaveBeenCalled();

    // Verify asset was actually published
    expect(publishedAssets.length).toBeGreaterThan(0);
    expect(publishedAssets[0]).toContain('Published asset1:dest1');
  });

  test('no console output when checking if asset is published while still checking status', async () => {
    const aws = new MockAws();
    const checkEvents: string[] = [];
    const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/test/cdk.out')), {
      aws,
      progressListener: {
        onPublishEvent: (type, event) => {
          if (type === 'check') {
            checkEvents.push(event.message);
          }
        },
      },
    });

    const manifest = AssetManifest.fromPath(mockfs.path('/test/cdk.out'));
    await pub.isEntryPublished(manifest.entries[0]);

    // Verify no console output occurred
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleDebugSpy).not.toHaveBeenCalled();

    // Verify check was actually performed
    expect(checkEvents.length).toBeGreaterThan(0);
    expect(checkEvents[0]).toContain('Check');
  });

  test('no console output when building asset', async () => {
    const aws = new MockAws();
    const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/test/cdk.out')), { aws });

    const manifest = AssetManifest.fromPath(mockfs.path('/test/cdk.out'));
    await pub.buildEntry(manifest.entries[0]);

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleDebugSpy).not.toHaveBeenCalled();
  });

  test('no console output during parallel publishing while still publishing assets', async () => {
    const aws = new MockAws();
    const publishEvents: string[] = [];
    const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/test/cdk.out')), {
      aws,
      publishInParallel: true,
      progressListener: {
        onPublishEvent: (type, event) => {
          if (type === 'start' || type === 'success') {
            publishEvents.push(event.message);
          }
        },
      },
    });

    await pub.publish();

    // Verify no console output occurred
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleDebugSpy).not.toHaveBeenCalled();

    // Verify publishing actually occurred
    expect(publishEvents.length).toBeGreaterThan(0);
    expect(publishEvents).toContainEqual(expect.stringContaining('Publishing asset1:dest1'));
    expect(publishEvents).toContainEqual(expect.stringContaining('Published asset1:dest1'));
  });

  test('no console output when publishing fails while still handling errors properly', async () => {
    const aws = new MockAws();
    const failureEvents: string[] = [];
    const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/test/cdk.out')), {
      aws,
      throwOnError: false, // Prevent the test from failing due to the error
      progressListener: {
        onPublishEvent: (type, event) => {
          if (type === 'fail') {
            failureEvents.push(event.message);
          }
        },
      },
    });

    // Force a failure by making S3 throw an error
    const errorMessage = 'Simulated S3 error';
    mockS3.on(ListObjectsV2Command).rejects(new Error(errorMessage));

    await pub.publish();

    // Verify no console output occurred
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleDebugSpy).not.toHaveBeenCalled();

    // Verify error was properly handled
    expect(failureEvents.length).toBeGreaterThan(0);
    expect(failureEvents[0]).toContain(errorMessage);
    expect(pub.hasFailures).toBe(true);
    expect(pub.failures.length).toBe(1);
    expect(pub.failures[0].error.message).toContain(errorMessage);
  });

  test('progress listener receives messages without console output', async () => {
    const aws = new MockAws();
    const messages: string[] = [];
    const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/test/cdk.out')), {
      aws,
      progressListener: {
        onPublishEvent: (type, event) => {
          messages.push(event.message);
        },
      },
    });

    await pub.publish();

    // Verify that the progress listener received messages
    expect(messages.length).toBeGreaterThan(0);

    // But verify no console output occurred
    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(consoleDebugSpy).not.toHaveBeenCalled();
  });
});

describe('Shell Command Logging', () => {
    // Store original console methods
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleInfo = console.info;
    const originalConsoleDebug = console.debug;
  
    // Create spies for console methods
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;
    let consoleInfoSpy: jest.SpyInstance;
    let consoleDebugSpy: jest.SpyInstance;
  
    beforeEach(() => {
      // Mock filesystem with a docker asset that will trigger shell commands
      mockfs({
        '/test/cdk.out/assets.json': JSON.stringify({
          version: Manifest.version(),
          dockerImages: {
            'asset1': {
              source: {
                directory: 'docker-dir',
              },
              destinations: {
                dest1: {
                  repositoryName: 'test-repo',
                  imageTag: 'test-tag',
                  region: 'us-east-1',
                },
              },
            },
          },
        }),
        '/test/cdk.out/docker-dir/Dockerfile': 'FROM node:14',
      });
  
      // Set up spies for all console methods
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
      consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  
      // Reset and setup ECR mocks
      mockEcr.reset();
      mockEcr.on(GetAuthorizationTokenCommand).resolves({
        authorizationData: [
          { authorizationToken: Buffer.from('user:pass').toString('base64'), proxyEndpoint: 'https://12345.dkr.ecr.region.amazonaws.com' }
        ]
      });
      mockEcr.on(DescribeRepositoriesCommand).resolves({
        repositories: [{ repositoryUri: '12345.dkr.ecr.region.amazonaws.com/test-repo' }]
      });
      mockEcr.on(DescribeImagesCommand).rejects({ name: 'ImageNotFoundException' });
  
      // Reset and setup S3 mocks
      mockS3.reset();
      mockS3.on(ListObjectsV2Command).resolves({
        Contents: [],
      });
    });
  
    afterEach(() => {
      mockfs.restore();
      
      // Restore all console methods
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      console.info = originalConsoleInfo;
      console.debug = originalConsoleDebug;
      
      jest.clearAllMocks();
    });
  
    test('captures stdout from shell commands through progress listener', async () => {
      const debugMessages: string[] = [];
      const aws = new MockAws();
  
      const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/test/cdk.out')), { 
        aws,
        progressListener: {
          onPublishEvent: (type, event) => {
            if (type === EventType.DEBUG) {
              debugMessages.push(event.message);
            }
          },
        }
      });
  
      // Mock successful shell commands with stdout
      const expectAllSpawns = mockSpawn(
        {
          commandLine: ['docker', 'login', '--username', 'user', '--password-stdin', 'https://12345.dkr.ecr.region.amazonaws.com'],
          stdout: 'Login Succeeded\n',
        },
        {
          commandLine: ['docker', 'inspect', 'cdkasset-asset1'],
          exitCode: 1
        },
        {
          commandLine: ['docker', 'build', '--tag', 'cdkasset-asset1', '.'],
          stdout: 'Building image...\nBuild completed\n',
        },
        {
          commandLine: ['docker', 'tag', 'cdkasset-asset1', '12345.dkr.ecr.region.amazonaws.com/test-repo:test-tag'],
        },
        {
          commandLine: ['docker', 'push', '12345.dkr.ecr.region.amazonaws.com/test-repo:test-tag'],
        }
      );
  
      await pub.publish();
  
      // Verify no direct console output
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
  
      // Verify shell output was captured in progress listener
      expect(debugMessages).toEqual(expect.arrayContaining([
        'Login Succeeded',
        'Building image...',
        'Build completed',
      ]));
  
      expectAllSpawns();
    });
  
    test('captures stderr from shell commands through progress listener', async () => {
      const debugMessages: string[] = [];
      const aws = new MockAws();
  
      const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/test/cdk.out')), { 
        aws,
        progressListener: {
          onPublishEvent: (type, event) => {
            if (type === EventType.DEBUG) {
              debugMessages.push(event.message);
            }
          },
        }
      });
  
      // Mock shell commands with stderr output
      const expectAllSpawns = mockSpawn(
        {
          commandLine: ['docker', 'login', '--username', 'user', '--password-stdin', 'https://12345.dkr.ecr.region.amazonaws.com'],
          stderr: 'Warning: using default credentials\n',
        },
        {
          commandLine: ['docker', 'inspect', 'cdkasset-asset1'],
          exitCode: 1
        },
        {
          commandLine: ['docker', 'build', '--tag', 'cdkasset-asset1', '.'],
          stderr: 'Warning: cache not found\n',
        },
        {
          commandLine: ['docker', 'tag', 'cdkasset-asset1', '12345.dkr.ecr.region.amazonaws.com/test-repo:test-tag'],
        },
        {
          commandLine: ['docker', 'push', '12345.dkr.ecr.region.amazonaws.com/test-repo:test-tag'],
        }
      );
  
      await pub.publish();
  
      // Verify no direct console output
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
  
      // Verify shell errors were captured in progress listener
      expect(debugMessages).toEqual(expect.arrayContaining([
        'Warning: using default credentials',
        'Warning: cache not found',
      ]));
  
      expectAllSpawns();
    });
  
    test('captures both stdout and stderr from shell commands', async () => {
      const debugMessages: string[] = [];
      const aws = new MockAws();
  
      const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/test/cdk.out')), { 
        aws,
        progressListener: {
          onPublishEvent: (type, event) => {
            if (type === EventType.DEBUG) {
              debugMessages.push(event.message);
            }
          },
        }
      });
  
      // Mock shell commands with both stdout and stderr
      const expectAllSpawns = mockSpawn(
        {
          commandLine: ['docker', 'login', '--username', 'user', '--password-stdin', 'https://12345.dkr.ecr.region.amazonaws.com'],
          stdout: 'Login Succeeded\n',
          stderr: 'Warning: using default credentials\n',
        },
        {
          commandLine: ['docker', 'inspect', 'cdkasset-asset1'],
          exitCode: 1
        },
        {
          commandLine: ['docker', 'build', '--tag', 'cdkasset-asset1', '.'],
        },
        {
          commandLine: ['docker', 'tag', 'cdkasset-asset1', '12345.dkr.ecr.region.amazonaws.com/test-repo:test-tag'],
        },
        {
          commandLine: ['docker', 'push', '12345.dkr.ecr.region.amazonaws.com/test-repo:test-tag'],
        }
      );
  
      await pub.publish();
  
      // Verify no direct console output
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
  
      // Verify both stdout and stderr were captured
      expect(debugMessages).toEqual(expect.arrayContaining([
        'Login Succeeded',
        'Warning: using default credentials',
      ]));
  
      expectAllSpawns();
    });
  
    test('captures shell command output in quiet mode', async () => {
      const debugMessages: string[] = [];
      const aws = new MockAws();
  
      const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/test/cdk.out')), { 
        aws,
        quiet: true,
        progressListener: {
          onPublishEvent: (type, event) => {
            if (type === EventType.DEBUG) {
              debugMessages.push(event.message);
            }
          },
        }
      });
  
      // Mock shell commands with output
      const expectAllSpawns = mockSpawn(
        {
          commandLine: ['docker', 'login', '--username', 'user', '--password-stdin', 'https://12345.dkr.ecr.region.amazonaws.com'],
          stdout: 'Login Succeeded\n',
          stderr: 'Warning message\n',
        },
        {
          commandLine: ['docker', 'inspect', 'cdkasset-asset1'],
          exitCode: 1
        },
        {
          commandLine: ['docker', 'build', '--tag', 'cdkasset-asset1', '.'],
        },
        {
          commandLine: ['docker', 'tag', 'cdkasset-asset1', '12345.dkr.ecr.region.amazonaws.com/test-repo:test-tag'],
        },
        {
          commandLine: ['docker', 'push', '12345.dkr.ecr.region.amazonaws.com/test-repo:test-tag'],
        }
      );
  
      await pub.publish();
  
      // Verify no direct console output
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
  
      // In quiet mode, output should still be captured but not displayed
      expect(debugMessages.length).toBe(0);
  
      expectAllSpawns();
    });
  
    test('shell output is captured when command fails', async () => {
      const debugMessages: string[] = [];
      const failMessages: string[] = [];
      const aws = new MockAws();
  
      const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/test/cdk.out')), { 
        aws,
        throwOnError: false,
        progressListener: {
          onPublishEvent: (type, event) => {
            if (type === EventType.DEBUG) {
              debugMessages.push(event.message);
            } else if (type === EventType.FAIL) {
              failMessages.push(event.message);
            }
          },
        }
      });
  
      // Mock failing shell command for initial docker login
      const expectAllSpawns = mockSpawn(
        {
          commandLine: ['docker', 'login', '--username', 'user', '--password-stdin', 'https://12345.dkr.ecr.region.amazonaws.com'],
          stderr: 'Authentication failed\n',
          exitCode: 1,
        }
      );
  
      await pub.publish();
  
      // Verify no direct console output
      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleDebugSpy).not.toHaveBeenCalled();
  
      // Verify error output was captured
      expect(debugMessages).toContain('Authentication failed');
      expect(failMessages.length).toBeGreaterThan(0);
      expect(pub.hasFailures).toBe(true);
  
      expectAllSpawns();
    });
  });
