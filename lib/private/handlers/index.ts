import { AwsDestination } from '@aws-cdk/cloud-assembly-schema';
import { ContainerImageAssetHandler } from './container-images';
import { FileAssetHandler } from './files';
import {
  AssetManifest,
  DockerImageManifestEntry,
  FileManifestEntry,
  IManifestEntry,
} from '../../asset-manifest';
import type { ClientOptions } from '../../aws';
import { IAssetHandler, IHandlerHost, IHandlerOptions } from '../asset-handler';

export function makeAssetHandler(
  manifest: AssetManifest,
  asset: IManifestEntry,
  host: IHandlerHost,
  options: IHandlerOptions
): IAssetHandler {
  if (asset instanceof FileManifestEntry) {
    return new FileAssetHandler(manifest.directory, asset, host);
  }
  if (asset instanceof DockerImageManifestEntry) {
    return new ContainerImageAssetHandler(manifest.directory, asset, host, options);
  }

  throw new Error(`Unrecognized asset type: '${asset}'`);
}

export function destinationToClientOptions(destination: AwsDestination): ClientOptions {
  // Explicitly build ClientOptions from AwsDestination. The fact they are structurally compatible is coincidental.
  // This also enforces better type checking that cdk-assets depends on the appropriate version of
  // @aws-cdk/cloud-assembly-schema.
  return {
    assumeRoleArn: destination.assumeRoleArn,
    assumeRoleExternalId: destination.assumeRoleExternalId,
    assumeRoleAdditionalOptions: destination.assumeRoleAdditionalOptions,
    region: destination.region,
  };
}
