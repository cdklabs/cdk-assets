jest.mock('child_process');

import 'aws-sdk-client-mock-jest';

import { FileDestination, Manifest } from '@aws-cdk/cloud-assembly-schema';
import { GetBucketEncryptionCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { FakeListener } from './fake-listener';
import { MockAws, mockS3 } from './mock-aws';
import { mockSpawn } from './mock-child_process';
import mockfs from './mock-fs';
import { AssetPublishing, AssetManifest, IAws } from '../lib';

const ABS_PATH = '/simple/cdk.out/some_external_file';

const DEFAULT_DESTINATION: FileDestination = {
  region: 'us-north-50',
  assumeRoleArn: 'arn:aws:role',
  bucketName: 'some_bucket',
  objectKey: 'some_key',
};

let aws: IAws;
beforeEach(() => {
  jest.resetAllMocks();

  mockfs({
    '/simple/cdk.out/assets.json': JSON.stringify({
      version: Manifest.version(),
      files: {
        theAsset: {
          source: {
            path: 'some_file',
          },
          destinations: { theDestination: DEFAULT_DESTINATION },
        },
      },
    }),
    '/simple/cdk.out/some_file': 'FILE_CONTENTS',
    [ABS_PATH]: 'ZIP_FILE_THAT_IS_DEFINITELY_NOT_EMPTY',
    '/abs/cdk.out/assets.json': JSON.stringify({
      version: Manifest.version(),
      files: {
        theAsset: {
          source: {
            path: `${mockfs.path('/simple/cdk.out/some_file')}`,
          },
          destinations: {
            theDestination: { ...DEFAULT_DESTINATION, bucketName: 'some_other_bucket' },
          },
        },
      },
    }),
    '/external/cdk.out/assets.json': JSON.stringify({
      version: Manifest.version(),
      files: {
        externalAsset: {
          source: {
            executable: ['sometool'],
          },
          destinations: {
            theDestination: { ...DEFAULT_DESTINATION, bucketName: 'some_external_bucket' },
          },
        },
      },
    }),
    '/types/cdk.out/assets.json': JSON.stringify({
      version: Manifest.version(),
      files: {
        theTextAsset: {
          source: {
            path: 'plain_text.txt',
          },
          destinations: { theDestination: { ...DEFAULT_DESTINATION, objectKey: 'some_key.txt' } },
        },
        theImageAsset: {
          source: {
            path: 'image.png',
          },
          destinations: { theDestination: { ...DEFAULT_DESTINATION, objectKey: 'some_key.png' } },
        },
      },
    }),
    '/types/cdk.out/plain_text.txt': 'FILE_CONTENTS',
    '/types/cdk.out/image.png': 'FILE_CONTENTS',
    '/emptyzip/cdk.out/assets.json': JSON.stringify({
      version: Manifest.version(),
      files: {
        theTextAsset: {
          source: {
            path: 'empty_dir',
            packaging: 'zip',
          },
          destinations: { theDestination: DEFAULT_DESTINATION },
        },
      },
    }),
    '/emptyzip/cdk.out/empty_dir': {}, // Empty directory
  });

  aws = new MockAws();
});

afterEach(() => {
  mockfs.restore();
});

// This test must come first. These mocks track the number of calls cumulatively
test('will only read bucketEncryption once even for multiple assets', async () => {
  mockS3.on(ListObjectsV2Command).resolves({ Contents: [{ Key: 'some_key.but_not_the_one' }] });
  const upload = jest.spyOn(aws, 'upload');

  const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/types/cdk.out')), { aws });
  await pub.publish();

  expect(upload).toHaveBeenCalledTimes(2);
  expect(mockS3).toReceiveCommandTimes(GetBucketEncryptionCommand, 1);
});

test('Do nothing if file already exists', async () => {
  const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/simple/cdk.out')), { aws });
  mockS3.on(ListObjectsV2Command).resolves({ Contents: [{ Key: 'some_key' }] });
  const upload = jest.spyOn(aws, 'upload');

  await pub.publish();

  expect(mockS3).toHaveReceivedCommandWith(ListObjectsV2Command, {
    Bucket: 'some_bucket',
    Prefix: 'some_key',
    MaxKeys: 1,
  });

  expect(upload).not.toHaveBeenCalled();
});

test('tiny file does not count as cache hit', async () => {
  const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/simple/cdk.out')), { aws });
  mockS3.on(ListObjectsV2Command).resolves({ Contents: [{ Key: 'some_key', Size: 5 }] });
  const upload = jest.spyOn(aws, 'upload');

  await pub.publish();

  expect(upload).toHaveBeenCalled();
});

test('upload file if new (list returns other key)', async () => {
  mockS3.on(ListObjectsV2Command).resolves({ Contents: [{ Key: 'some_key.but_not_the_one' }] });
  const upload = jest.spyOn(aws, 'upload');

  const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/simple/cdk.out')), { aws });
  await pub.publish();

  expect(upload).toHaveBeenCalled();
});

test('upload with server side encryption AES256 header', async () => {
  mockS3.on(GetBucketEncryptionCommand).resolves({
    ServerSideEncryptionConfiguration: {
      Rules: [
        {
          ApplyServerSideEncryptionByDefault: {
            SSEAlgorithm: 'AES256',
          },
          BucketKeyEnabled: false,
        },
      ],
    },
  });
  mockS3.on(ListObjectsV2Command).resolves({ Contents: [{ Key: 'some_key.but_not_the_one' }] });
  const upload = jest.spyOn(aws, 'upload');

  const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/simple/cdk.out')), { aws });
  await pub.publish();

  expect(upload).toHaveBeenCalledWith(
    expect.objectContaining({
      Bucket: 'some_bucket',
      Key: 'some_key',
      ContentType: 'application/octet-stream',
      ServerSideEncryption: 'AES256',
    })
  );

  // We'll just have to assume the contents are correct
});

test('upload with server side encryption aws:kms header and key id', async () => {
  mockS3.on(GetBucketEncryptionCommand).resolves({
    ServerSideEncryptionConfiguration: {
      Rules: [
        {
          ApplyServerSideEncryptionByDefault: {
            SSEAlgorithm: 'aws:kms',
            KMSMasterKeyID: 'the-key-id',
          },
          BucketKeyEnabled: false,
        },
      ],
    },
  });
  mockS3.on(ListObjectsV2Command).resolves({ Contents: [{ Key: 'some_key.but_not_the_one' }] });
  const upload = jest.spyOn(aws, 'upload');

  const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/simple/cdk.out')), { aws });
  await pub.publish();

  expect(upload).toHaveBeenCalledWith(
    expect.objectContaining({
      Bucket: 'some_bucket',
      Key: 'some_key',
      ContentType: 'application/octet-stream',
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: 'the-key-id',
    })
  );

  // We'll just have to assume the contents are correct
});

test('no server side encryption header if access denied for bucket encryption', async () => {
  const err = new Error('Access Denied');
  err.name = 'AccessDenied';
  mockS3.on(GetBucketEncryptionCommand).rejects(err);
  mockS3.on(ListObjectsV2Command).resolves({ Contents: [{ Key: 'some_key.but_not_the_one' }] });
  const upload = jest.spyOn(aws, 'upload');
  const progressListener = new FakeListener();
  const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/simple/cdk.out')), {
    aws,
    progressListener,
  });

  await pub.publish();

  expect(upload).toHaveBeenCalledWith(
    expect.not.objectContaining({
      ServerSideEncryption: 'aws:kms',
    })
  );

  expect(upload).toHaveBeenCalledWith(
    expect.not.objectContaining({
      ServerSideEncryption: 'AES256',
    })
  );
});

test('correctly looks up content type', async () => {
  const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/types/cdk.out')), { aws });

  mockS3.on(ListObjectsV2Command).resolves({ Contents: [{ Key: 'some_key.but_not_the_one' }] });
  const upload = jest.spyOn(aws, 'upload');

  await pub.publish();

  expect(upload).toHaveBeenCalledWith(
    expect.objectContaining({
      Bucket: 'some_bucket',
      Key: 'some_key.txt',
      ContentType: 'text/plain',
    })
  );

  expect(upload).toHaveBeenCalledWith(
    expect.objectContaining({
      Bucket: 'some_bucket',
      Key: 'some_key.png',
      ContentType: 'image/png',
    })
  );

  // We'll just have to assume the contents are correct
});

test('upload file if new (list returns no key)', async () => {
  mockS3.on(ListObjectsV2Command).resolves({ Contents: undefined });
  const upload = jest.spyOn(aws, 'upload');

  const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/simple/cdk.out')), { aws });
  await pub.publish();

  expect(upload).toHaveBeenCalledWith(
    expect.objectContaining({
      Bucket: 'some_bucket',
      Key: 'some_key',
    })
  );

  // We'll just have to assume the contents are correct
});

test('successful run does not need to query account ID', async () => {
  const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/simple/cdk.out')), { aws });

  mockS3.on(ListObjectsV2Command).resolves({ Contents: undefined });
  const discoverCurrentAccount = jest.spyOn(aws, 'discoverCurrentAccount');
  const discoverTargetAccount = jest.spyOn(aws, 'discoverTargetAccount');

  await pub.publish();

  expect(discoverCurrentAccount).not.toHaveBeenCalled();
  expect(discoverTargetAccount).not.toHaveBeenCalled();
});

test('correctly identify asset path if path is absolute', async () => {
  const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/abs/cdk.out')), { aws });

  mockS3.on(ListObjectsV2Command).resolves({ Contents: undefined });

  await pub.publish();

  expect(true).toBeTruthy(); // No exception, satisfy linter
});

describe('external assets', () => {
  let pub: AssetPublishing;
  beforeEach(() => {
    pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/external/cdk.out')), { aws });
  });

  test('do nothing if file exists already', async () => {
    mockS3.on(ListObjectsV2Command).resolves({ Contents: [{ Key: 'some_key' }] });

    await pub.publish();

    expect(mockS3).toReceiveCommandWith(ListObjectsV2Command, {
      Bucket: 'some_external_bucket',
      Prefix: 'some_key',
      MaxKeys: 1,
    });
  });

  test('upload external asset correctly', async () => {
    mockS3.on(ListObjectsV2Command).resolves({ Contents: undefined });
    const upload = jest.spyOn(aws, 'upload');
    const expectAllSpawns = mockSpawn({
      commandLine: ['sometool'],
      stdout: `${mockfs.path(ABS_PATH)}`,
    });

    await pub.publish();

    expect(upload).toHaveBeenCalled();

    expectAllSpawns();
  });
});
