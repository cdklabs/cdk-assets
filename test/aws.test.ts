import * as os from 'os';
import { DefaultAwsClient } from '../lib';

beforeEach(() => {
  jest.requireActual('aws-sdk');
});

test('assumeRole passes the right parameters to STS', async () => {
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
  await withMocked(os, 'userInfo', async (userInfo) => {
    userInfo.mockReturnValue({
      username: 'foo',
      uid: 1,
      gid: 1,
      homedir: '/here',
      shell: '/bin/sh',
    });
    await aws.discoverTargetAccount({
      region: 'us-east-1',
      assumeRoleArn: 'arn:aws:iam::123456789012:role/my-role',
      assumeRoleExternalId: 'external-id',
      assumeRoleAdditionalOptions: {
        DurationSeconds: 3600,
      },
    });
    expect(AWS.ChainableTemporaryCredentials).toHaveBeenCalledWith({
      params: {
        ExternalId: 'external-id',
        RoleArn: 'arn:aws:iam::123456789012:role/my-role',
        DurationSeconds: 3600,
        RoleSessionName: `cdk-assets-foo`,
      },
      stsConfig: {
        customUserAgent: 'cdk-assets',
        region: 'us-east-1',
      },
    });
  });
});

test('assumeRole defaults session tags to all', async () => {
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
  await withMocked(os, 'userInfo', async (userInfo) => {
    userInfo.mockReturnValue({
      username: 'foo',
      uid: 1,
      gid: 1,
      homedir: '/here',
      shell: '/bin/sh',
    });
    await aws.discoverTargetAccount({
      region: 'us-east-1',
      assumeRoleArn: 'arn:aws:iam::123456789012:role/my-role',
      assumeRoleExternalId: 'external-id',
      assumeRoleAdditionalOptions: {
        Tags: [{ Key: 'Departement', Value: 'Engineering' }],
      },
    });
    expect(AWS.ChainableTemporaryCredentials).toHaveBeenCalledWith({
      params: {
        ExternalId: 'external-id',
        RoleArn: 'arn:aws:iam::123456789012:role/my-role',
        Tags: [{ Key: 'Departement', Value: 'Engineering' }],
        TransitiveTagKeys: ['Departement'],
        RoleSessionName: `cdk-assets-foo`,
      },
      stsConfig: {
        customUserAgent: 'cdk-assets',
        region: 'us-east-1',
      },
    });
  });
});

export function withMocked<A extends object, K extends keyof A, B>(
  obj: A,
  key: K,
  block: (fn: jest.Mocked<A>[K]) => B
): B {
  const original = obj[key];
  const mockFn = jest.fn();
  (obj as any)[key] = mockFn;

  let asyncFinally: boolean = false;
  try {
    const ret = block(mockFn as any);
    if (!isPromise(ret)) {
      return ret;
    }

    asyncFinally = true;
    return ret.finally(() => {
      obj[key] = original;
    }) as any;
  } finally {
    if (!asyncFinally) {
      obj[key] = original;
    }
  }
}

function isPromise<A>(object: any): object is Promise<A> {
  return Promise.resolve(object) === object;
}
