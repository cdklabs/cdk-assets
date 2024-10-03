import type { AwsDestination } from '@aws-cdk/cloud-assembly-schema';
import { ContainerImageAssetHandler } from './container-images';
import { FileAssetHandler } from './files';
import {
  type AssetManifest,
  DockerImageManifestEntry,
  FileManifestEntry,
  type IManifestEntry,
} from '../../asset-manifest';
import type { ClientOptions } from '../../aws';
import type { IAssetHandler, IHandlerHost, IHandlerOptions } from '../asset-handler';

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
  return {
    assumeRoleArn: destination.assumeRoleArn,
    assumeRoleExternalId: destination.assumeRoleExternalId,
    assumeRoleAdditionalOptions: destination.assumeRoleAdditionalOptions,
    region: destination.region,
  };
}
