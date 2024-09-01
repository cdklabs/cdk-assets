import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import { DefaultAwsClient } from '../lib';

// putting this either inside the test or in a beforeEach function
// breaks mocking. not sure why.
jest.mock('@aws-sdk/credential-providers', () => ({
  fromTemporaryCredentials: jest.fn(),
  fromNodeProviderChain: jest.fn(),
}));

afterEach(() => {
  jest.resetAllMocks();
});

test('additional options are passed to STS when assuming roles', async () => {
  const aws = new DefaultAwsClient();
  await aws.ecrClient({
    assumeRoleArn: 'some-role',
    assumeRoleAdditionalOptions: {
      Tags: [
        { Key: 'Departement1', Value: 'Engineering' },
        { Key: 'Departement2', Value: 'Engineering2' },
      ],
      TransitiveTagKeys: ['Departement1'],
      DurationSeconds: 3600,
      RoleSessionName: 'some-session',
    },
  });

  expect(fromTemporaryCredentials).toHaveBeenCalledWith({
    params: {
      RoleArn: 'some-role',
      DurationSeconds: 3600,
      RoleSessionName: 'some-session',
      Tags: [
        { Key: 'Departement1', Value: 'Engineering' },
        { Key: 'Departement2', Value: 'Engineering2' },
      ],
      TransitiveTagKeys: ['Departement1'],
    },
    clientConfig: {
      customUserAgent: 'cdk-assets',
    },
  });
});

test('TransitiveTagKeys defaults to all Tag keys when assuming roles', async () => {
  const aws = new DefaultAwsClient();
  await aws.ecrClient({
    assumeRoleArn: 'some-role',
    assumeRoleAdditionalOptions: {
      DurationSeconds: 3600,
      RoleSessionName: 'some-session',
      Tags: [
        { Key: 'Departement1', Value: 'Engineering' },
        { Key: 'Departement2', Value: 'Engineering2' },
      ],
    },
  });

  expect(fromTemporaryCredentials).toHaveBeenCalledWith({
    params: {
      RoleArn: 'some-role',
      DurationSeconds: 3600,
      RoleSessionName: 'some-session',
      Tags: [
        { Key: 'Departement1', Value: 'Engineering' },
        { Key: 'Departement2', Value: 'Engineering2' },
      ],
      TransitiveTagKeys: ['Departement1', 'Departement2'],
    },
    clientConfig: {
      customUserAgent: 'cdk-assets',
    },
  });
});
