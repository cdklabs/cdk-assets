import { typescript } from 'projen';
const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: 'main',
  name: 'cdk-assets',
  projenrcTs: true,
  release: false,
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
    'aws-sdk',
    'glob',
    'mime',
    'yargs',
  ],
  description: 'CDK Asset Publishing Tool',
  devDeps: [
    '@types/archiver',
    '@types/glob',
    '@types/mime',
    '@types/yargs',
    'fs-extra',
    'graceful-fs',
    'jszip',
    'mock-fs',
  ],
  packageName: 'cdk-assets',
  eslintOptions: {
    prettier: true,
    dirs: ['src', 'test', 'bin'],
  },
  jestOptions: {
    jestConfig: {
      verbose: true,
      maxWorkers: '50%',
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
  },
  tsconfig: {
    compilerOptions: {
      target: 'ES2020',
      module: 'commonjs',
      lib: ['es2020', 'dom'],
      incremental: true,
      esModuleInterop: false,
    },
  },
});

project.eslint?.addRules({
  'prettier/prettier': [
    'error',
    { singleQuote: true, semi: true, trailingComma: 'es5', printWidth: 100 },
  ],
});

project.synth();
