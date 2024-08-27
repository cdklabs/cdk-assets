import * as os from 'os';
import { DefaultAwsClient } from '../lib';

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
      });
      expect(AWS.ChainableTemporaryCredentials).toHaveBeenCalledWith({
        params: {
          ExternalId: 'external-id',
          RoleArn: 'arn:aws:iam::123456789012:role/my-role',
          RoleSessionName: `cdk-assets-foo`,
        },
        stsConfig: {
          customUserAgent: 'cdk-assets',
          region: 'us-east-1',
        },
      });
    });
  });

  test('returns account information', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('aws-sdk');

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
