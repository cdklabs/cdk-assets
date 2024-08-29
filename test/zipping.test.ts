import { Manifest } from '@aws-cdk/cloud-assembly-schema';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { MockAws, mockS3 } from './mock-aws';
import mockfs from './mock-fs';
import { AssetManifest, AssetPublishing, IAws } from '../lib';

let aws: IAws;
beforeEach(() => {
  mockfs({
    '/simple/cdk.out/assets.json': JSON.stringify({
      version: Manifest.version(),
      files: {
        theAsset: {
          source: {
            path: 'some_dir',
            packaging: 'zip',
          },
          destinations: {
            theDestination: {
              region: 'us-north-50',
              assumeRoleArn: 'arn:aws:role',
              bucketName: 'some_bucket',
              objectKey: 'some_key',
            },
          },
        },
      },
    }),
    '/simple/cdk.out/some_dir/some_file': 'FILE_CONTENTS',
  });

  aws = new MockAws();

  // Accept all S3 uploads as new
  mockS3.on(ListObjectsV2Command).resolves({ Contents: undefined });
});

afterEach(() => {
  mockfs.restore();
});

test('Take a zipped upload', async () => {
  const pub = new AssetPublishing(AssetManifest.fromPath(mockfs.path('/simple/cdk.out')), { aws });
  const upload = jest.spyOn(aws, 'upload');

  await pub.publish();

  expect(upload).toHaveBeenCalled();
});
