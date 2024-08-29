import { ReadStream } from 'fs';
import { DescribeImagesCommand, DescribeRepositoriesCommand, ECRClient } from '@aws-sdk/client-ecr';
import {
  CompleteMultipartUploadCommandOutput,
  PutObjectCommand,
  PutObjectCommandInput,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Upload } from '@aws-sdk/lib-storage';
import { mockClient } from 'aws-sdk-client-mock';
import { Account, ClientOptions, IAws } from '../lib/aws';

export const mockEcr = mockClient(ECRClient);
mockEcr.on(DescribeRepositoriesCommand).resolves({
  repositories: [
    {
      repositoryName: 'repo',
      repositoryUri: '12345.amazonaws.com/repo',
    },
  ],
});
mockEcr.on(DescribeImagesCommand).resolves({});

export const mockS3 = mockClient(S3Client);
mockS3.on(UploadPartCommand).resolves({ ETag: '1' });
mockS3.on(PutObjectCommand).callsFake(async (input: PutObjectCommandInput) => {
  const stream = input.Body as ReadStream;
  await new Promise<void>((resolve) => stream.close(() => resolve()));
});

export const mockSecretsManager = mockClient(SecretsManagerClient);

export class MockAws implements IAws {
  discoverPartition(): Promise<string> {
    return Promise.resolve('swa');
  }

  discoverCurrentAccount(): Promise<Account> {
    return Promise.resolve({ accountId: 'current_account', partition: 'swa' });
  }

  discoverDefaultRegion(): Promise<string> {
    return Promise.resolve('current_region');
  }

  discoverTargetAccount(_options: ClientOptions): Promise<Account> {
    return Promise.resolve({ accountId: 'target_account', partition: 'swa' });
  }

  ecrClient(_options: ClientOptions): Promise<ECRClient> {
    return Promise.resolve(mockEcr as unknown as ECRClient);
  }

  s3Client(_options: ClientOptions): Promise<S3Client> {
    return Promise.resolve(mockS3 as unknown as S3Client);
  }

  secretsManagerClient(_options: ClientOptions): Promise<SecretsManagerClient> {
    return Promise.resolve(mockSecretsManager as unknown as SecretsManagerClient);
  }

  upload(
    params: PutObjectCommandInput,
    options: ClientOptions
  ): Promise<CompleteMultipartUploadCommandOutput> {
    return new Promise<CompleteMultipartUploadCommandOutput>((resolve, reject) => {
      const stream = params.Body as ReadStream;

      stream.on('data', () => {});
      stream.on('error', reject);
      stream.on('close', () => {
        resolve({ $metadata: {} });
      });
    });
  }
}
