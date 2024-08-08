import { typescript } from 'projen';
const project = new typescript.TypeScriptProject({
  name: 'cdk-assets',
  projenrcTs: true,
  defaultReleaseBranch: 'v2-main',
  majorVersion: 2,
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

project.synth();
