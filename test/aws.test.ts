import { DefaultAwsClient, safeUsername } from '../lib';

afterEach(() => {
  jest.requireActual('aws-sdk');
});

beforeEach(() => {
  jest.requireActual('aws-sdk');
});

describe('discoverTargetAccount', () => {
  test('assumes role if needed', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AWS = require('aws-sdk');

    jest.mock('aws-sdk', () => {
      return {
        STS: jest.fn().mockReturnValue({
          getCallerIdentity: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({
              Account: '123456789012',
              Arn: 'arn:aws:iam::123456789012:role/my-role',
            }),
          }),
        }),
        ChainableTemporaryCredentials: jest.fn(),
      };
    });

    const aws = new DefaultAwsClient();

    await aws.discoverTargetAccount({
      region: 'us-east-1',
      assumeRoleArn: 'arn:aws:iam::123456789012:role/my-role',
      assumeRoleExternalId: 'external-id',
    });

    expect(AWS.ChainableTemporaryCredentials).toHaveBeenCalledWith({
      params: {
        ExternalId: 'external-id',
        RoleArn: 'arn:aws:iam::123456789012:role/my-role',
        RoleSessionName: `cdk-assets-${safeUsername()}`,
      },
      stsConfig: {
        customUserAgent: 'cdk-assets',
        region: 'us-east-1',
      },
    });
  });

  test('returns account information', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AWS = require('aws-sdk');

    jest.mock('aws-sdk', () => {
      return {
        STS: jest.fn().mockReturnValue({
          getCallerIdentity: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue({
              Account: '123456789012',
              Arn: 'arn:aws:iam::123456789012:role/my-role',
            }),
          }),
        }),
        ChainableTemporaryCredentials: jest.fn(),
      };
    });

    const aws = new DefaultAwsClient();

    const account = await aws.discoverTargetAccount({});
    expect(account).toEqual({
      accountId: '123456789012',
      partition: 'aws',
    });
  });
});
