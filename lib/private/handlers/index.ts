import { ContainerImageAssetHandler } from './container-images';
import { FileAssetHandler } from './files';
import {
  type AssetManifest,
  DockerImageManifestEntry,
  FileManifestEntry,
  type IManifestEntry,
} from '../../asset-manifest';
import type { IAssetHandler, IHandlerHost } from '../asset-handler';

export function makeAssetHandler(
  manifest: AssetManifest,
  asset: IManifestEntry,
  host: IHandlerHost
): IAssetHandler {
  if (asset instanceof FileManifestEntry) {
    return new FileAssetHandler(manifest.directory, asset, host);
  }
  if (asset instanceof DockerImageManifestEntry) {
    return new ContainerImageAssetHandler(manifest.directory, asset, host);
  }

  throw new Error(`Unrecognized asset type: '${asset}'`);
}
