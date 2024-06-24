// A not-so-fake filesystem mock similar to mock-fs
//
// mock-fs is super convenient but we can't always use it:
// - When you use console.log() jest wants to load things from the filesystem (which fails).
// - When you make AWS calls the SDK wants to load things from the filesystem (which fails).
//
// Therefore, something similar which uses tempdirs on your actual disk.
//
// The big downside compared to mockfs is that you need to use mockfs.path() to translate
// fake paths to real paths.
import * as os from 'os';
import * as path_ from 'path';
import * as fs from 'fs-extra';

const mockFsRoot = fs.realpathSync(fs.mkdtempSync(path_.join(os.tmpdir(), 'mockfs')));
let oldCwd: string | undefined;

function mockfs(files: Record<string, string | Object>) {
  oldCwd = process.cwd();
  for (const [fileName, contents] of Object.entries(files)) {
    mockfs.write(fileName, contents);
  }
}

namespace mockfs {
  /**
   * Write contents to a fake file
   */
  export function write(fakeFilename: string, contents: string | Object) {
    const fullPath = path(fakeFilename);
    fs.mkdirSync(path_.dirname(fullPath), { recursive: true });
    if (typeof contents === 'string') {
      fs.writeFileSync(fullPath, contents, { encoding: 'utf-8' });
    }
  }

  /**
   * Turn a fake path into a real path
   */
  export function path(fakePath: string) {
    if (fakePath.startsWith('/')) {
      fakePath = fakePath.slice(1);
    } // Force path to be non-absolute
    return path_.join(mockFsRoot, fakePath);
  }

  /**
   * Change to a fake directory
   *
   * @returns A template literal function to turn a fake path into a real path. Relative paths are assumed to be in the working dir.
   */
  export function workingDirectory(fakePath: string): (parts: TemplateStringsArray) => string {
    process.chdir(path(fakePath));

    return function (elements: TemplateStringsArray) {
      const fullPath = elements.join('');
      if (!fullPath.startsWith('/')) {
        return path(path_.join(fakePath, fullPath));
      }

      return path(fullPath);
    };
  }

  export function readFileSync(fakePath: string) {
    return fs.readFileSync(mockfs.path(fakePath));
  }

  export function executable(...fakePaths: string[]) {
    for (const fakepath of fakePaths) {
      fs.chmodSync(path(fakepath), '755');
    }
  }

  /**
   * Remove all files and restore working directory
   */
  export function restore() {
    if (oldCwd) {
      process.chdir(oldCwd);
    }
    fs.removeSync(mockFsRoot);
  }
}

export default mockfs;
