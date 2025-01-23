import { github, typescript } from 'projen';
const project = new typescript.TypeScriptProject({
  name: 'cdk-assets',
  projenrcTs: true,
  defaultReleaseBranch: 'main',
  majorVersion: 3,
  prerelease: 'rc',
  releaseBranches: {
    'v2-main': {
      majorVersion: 2,
      npmDistTag: 'latest',
    },
  },
  releaseToNpm: true,
  npmDistTag: 'v3-latest',
  autoApproveUpgrades: true,
  autoApproveOptions: {
    allowedUsernames: ['aws-cdk-automation'],
    secret: 'GITHUB_TOKEN',
  },
  repository: 'https://github.com/cdklabs/cdk-assets.git',
  keywords: ['aws', 'cdk'],
  homepage: 'https://github.com/aws/aws-cdk',
  bin: {
    'cdk-assets': 'bin/cdk-assets',
    'docker-credential-cdk-assets': 'bin/docker-credential-cdk-assets',
  },
  deps: [
    '@aws-cdk/cloud-assembly-schema',
    '@aws-cdk/cx-api',
    'archiver',
    '@aws-sdk/client-ecr',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-secrets-manager',
    '@aws-sdk/client-sts',
    '@aws-sdk/credential-providers',
    '@aws-sdk/lib-storage',
    '@smithy/config-resolver',
    '@smithy/node-config-provider',
    'glob',
    'mime',
    'yargs',
  ],
  description: 'CDK Asset Publishing Tool',
  devDeps: [
    '@smithy/types@^4',
    '@types/archiver',
    '@types/glob',
    '@types/mime',
    '@types/yargs',
    'aws-sdk-client-mock',
    'aws-sdk-client-mock-jest',
    'fs-extra',
    'graceful-fs',
    'jszip',
  ],
  packageName: 'cdk-assets',
  eslintOptions: {
    prettier: true,
    dirs: ['lib', 'test', 'bin'],
  },
  jestOptions: {
    jestConfig: {
      verbose: true,
      maxWorkers: '50%',
      randomize: true,
    },
    configFilePath: 'jest.config.json',
  },
  tsJestOptions: {
    transformOptions: {
      isolatedModules: true,
    },
  },
  tsconfigDev: {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      lib: ['es2020', 'dom'],
      incremental: true,
      esModuleInterop: false,
    },
    include: ['bin/**/*.ts'],
  },
  tsconfig: {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      lib: ['es2020', 'dom'],
      incremental: true,
      esModuleInterop: false,
      rootDir: undefined,
      outDir: undefined,
    },
    include: ['bin/**/*.ts'],
  },
  srcdir: 'lib',
  gitignore: ['**/*.d.ts', '**/*.js', '**/.DS_Store', 'npm-shrinkwrap.json'],
  releaseWorkflowSetupSteps: [
    {
      name: 'Shrinkwrap',
      run: 'npx projen shrinkwrap',
    },
  ],
  githubOptions: {
    mergify: false,
    mergeQueue: true,
  },
});

project.addPackageIgnore('*.ts');
project.addPackageIgnore('!*.d.ts');

project.eslint?.addRules({
  'prettier/prettier': [
    'error',
    { singleQuote: true, semi: true, trailingComma: 'es5', printWidth: 100 },
  ],
});

project.addTask('shrinkwrap', {
  steps: [
    {
      spawn: 'bump',
    },
    {
      exec: 'npm shrinkwrap',
    },
    {
      spawn: 'unbump',
    },
    {
      exec: 'git checkout HEAD -- yarn.lock',
    },
  ],
});

project.addDevDeps('@cdklabs/eslint-plugin');
project.eslint?.addPlugins('@cdklabs');
project.eslint?.addRules({
  '@cdklabs/promiseall-no-unbounded-parallelism': ['error'],
});

// Allow PR backports to all releasable branches
new github.PullRequestBackport(project);

project.addDevDeps('madge');
project.postCompileTask.exec('madge lib/index.js --circular');

project.synth();
