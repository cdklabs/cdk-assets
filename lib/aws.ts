import * as os from 'os';
import { ECRClient } from '@aws-sdk/client-ecr';
import { CompleteMultipartUploadCommandOutput, PutObjectCommandInput, S3Client } from '@aws-sdk/client-s3';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { GetCallerIdentityCommand, STSClient, STSClientConfig } from '@aws-sdk/client-sts';
import { fromNodeProviderChain, fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import { Upload } from '@aws-sdk/lib-storage';
import { NODE_REGION_CONFIG_FILE_OPTIONS, NODE_REGION_CONFIG_OPTIONS } from '@smithy/config-resolver';
import { loadConfig } from '@smithy/node-config-provider';
import { AwsCredentialIdentityProvider } from '@smithy/types';

/**
 * AWS SDK operations required by Asset Publishing
 */
export interface IAws {
  discoverPartition(): Promise<string>;
  discoverDefaultRegion(): Promise<string>;
  discoverCurrentAccount(): Promise<Account>;

  discoverTargetAccount(options: ClientOptions): Promise<Account>;
  s3Client(options: ClientOptions): Promise<S3Client>;
  ecrClient(options: ClientOptions): Promise<ECRClient>;
  secretsManagerClient(options: ClientOptions): Promise<SecretsManagerClient>;
  upload(params: PutObjectCommandInput, options?: ClientOptions): Promise<CompleteMultipartUploadCommandOutput>;
}

export interface ClientOptions {
  region?: string;
  assumeRoleArn?: string;
  assumeRoleExternalId?: string;
  quiet?: boolean;
}

const USER_AGENT = 'cdk-assets';

interface Configuration {
  clientConfig: STSClientConfig;
  region?: string;
  credentials: AwsCredentialIdentityProvider;
}

/**
 * An AWS account
 *
 * An AWS account always exists in only one partition. Usually we don't care about
 * the partition, but when we need to form ARNs we do.
 */
export interface Account {
  /**
   * The account number
   */
  readonly accountId: string;

  /**
   * The partition ('aws' or 'aws-cn' or otherwise)
   */
  readonly partition: string;
}

/**
 * AWS client using the AWS SDK for JS with no special configuration
 */
export class DefaultAwsClient implements IAws {
  private account?: Account;
  private config: Configuration;

  constructor(private readonly profile?: string) {
    process.env.AWS_PROFILE = profile;
    const clientConfig: STSClientConfig = {
      customUserAgent: USER_AGENT,
    }
    this.config = {
      clientConfig,
      credentials: fromNodeProviderChain({
        profile: this.profile,
        clientConfig,
      }),
    };
  }

  public async s3Client(options: ClientOptions): Promise<S3Client> {
    return new S3Client(await this.awsOptions(options));
  }

  public async upload(params: PutObjectCommandInput, options: ClientOptions = {}): Promise<CompleteMultipartUploadCommandOutput> {
    try {
      const upload = new Upload({
        client: await this.s3Client(options),
        params,
      });

      return upload.done();
    } catch (e) {
      // TODO: add something more useful here
      console.log(e);
      throw e;
    } 
  }

  public async ecrClient(options: ClientOptions): Promise<ECRClient> {
    return new ECRClient(await this.awsOptions(options));
  }

  public async secretsManagerClient(options: ClientOptions): Promise<SecretsManagerClient> {
    return new SecretsManagerClient(await this.awsOptions(options));
  }

  public async discoverPartition(): Promise<string> {
    return (await this.discoverCurrentAccount()).partition;
  }

  public async discoverDefaultRegion(): Promise<string> {
    return loadConfig(NODE_REGION_CONFIG_OPTIONS, NODE_REGION_CONFIG_FILE_OPTIONS)() || 'us-east-1';
  }

  public async discoverCurrentAccount(): Promise<Account> {
    if (this.account === undefined) {
      this.account = await this.getAccount();
    }
    return this.account;
  }

  public async discoverTargetAccount(options: ClientOptions): Promise<Account> {
    return this.getAccount(await this.awsOptions(options));
  }

  private async getAccount(options?: ClientOptions): Promise<Account> {
    this.config.clientConfig = options ?? this.config.clientConfig;
    const stsClient = new STSClient(await this.awsOptions(options));

    const command = new GetCallerIdentityCommand();
    const response = await stsClient.send(command);
    if (!response.Account || !response.Arn) {
      throw new Error(`Unrecognized response from STS: '${JSON.stringify(response)}'`);
    }
    return {
      accountId: response.Account!,
      partition: response.Arn!.split(':')[1],
    };
  }

  private async awsOptions(options?: ClientOptions) {
    const config = this.config;
    config.region = options?.region;
    if (options) {
      config.region = options.region;
      if (options.assumeRoleArn) {
        config.credentials = fromTemporaryCredentials({
          params: {
            RoleArn: options.assumeRoleArn,
            ExternalId: options.assumeRoleExternalId,
            RoleSessionName: `${USER_AGENT}-${safeUsername()}`,
          },
          clientConfig: this.config.clientConfig,
        });
      }
    }
    return config;
  }
}

/**
 * Return the username with characters invalid for a RoleSessionName removed
 *
 * @see https://docs.aws.amazon.com/STS/latest/APIReference/API_AssumeRole.html#API_AssumeRole_RequestParameters
 */
function safeUsername() {
  try {
    return os.userInfo().username.replace(/[^\w+=,.@-]/g, '@');
  } catch {
    return 'noname';
  }
}
