import * as fs from 'fs';
import * as path from 'path';
import * as webpack from 'webpack';
import * as _ from 'lodash';
import * as util from 'util';
import * as WebpackBar from 'webpackbar';
import * as SpeedMeasurePlugin from 'speed-measure-webpack-plugin';
import * as yargs from 'yargs';
import { getWebpackConfig, IOptions } from './webpack-config';
import { getWebpackDllConfig, IDllOptions } from './webpack-dll-config';
import { hasNodeModules, hasNodeModulesModified, hasExtraVendorsChanged, hasPackageChanged } from './project-helper';
import { globalState } from './global-state';
import { logWarn } from './log';

interface IExtraOptions {
  pipeConfig?: (config?: webpack.Configuration) => Promise<webpack.Configuration>;
}

const smp = new SpeedMeasurePlugin();

const stats = {
  warnings: false,
  version: false,
  modules: false,
  entrypoints: false,
  hash: false,
  colors: true,
  children: false,
};

export const runWebpack = async (opts: IOptions<IExtraOptions>): Promise<any> => {
  let webpackConfig = await getWebpackConfig(opts);

  if (opts.pipeConfig) {
    webpackConfig = await opts.pipeConfig(webpackConfig);
  }

  console.log('webpackConfig?.output', JSON.stringify(webpackConfig?.output));
  if (_.get(webpackConfig?.output, 'jsonpFunction')) {
    // @ts-expect-error
    webpackConfig?.output.chunkLoadingGlobal = _.get(webpackConfig?.output, 'jsonpFunction');
    // @ts-expect-error
    delete webpackConfig.output.jsonpFunction;
  }
  // webpack5 清楚构建缓存
  // webpackConfig.output?.clean = true;

  // const writeFileAsync = util.promisify(fs.writeFile);
  // await writeFileAsync(
  //   `${globalState.projectRootPath}/.temp/webpack.config.json`,
  //   JSON.stringify(webpackConfig, null, 2),
  //   'utf8',
  // );

  webpackConfig.plugins.push(new WebpackBar());

  if (yargs.argv.measureSpeed) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    webpackConfig = smp.wrap(webpackConfig);
  }

  const compiler = webpack(webpackConfig);

  return runCompiler(compiler);
};

export const watchWebpack = async (opts: IOptions<IExtraOptions>): Promise<any> => {
  let webpackConfig = await getWebpackConfig(opts);

  if (opts.pipeConfig) {
    webpackConfig = await opts.pipeConfig(webpackConfig);
  }

  webpackConfig.plugins.push(new WebpackBar());

  const compiler = webpack(webpackConfig);

  compiler.watch({}, (err, status) => {
    if (!err && !status.hasErrors()) {
      process.stdout.write(`${status.toString(stats)}\n\n`);
    } else if (err && err.message) {
      logWarn(err.message);
    } else {
      logWarn(status.toString());
    }
  });
};

export const runWebpackDll = async (opts: IDllOptions): Promise<any> => {
  let webpackConfig = getWebpackDllConfig(opts);

  if (opts.pipeConfig) {
    webpackConfig = await opts.pipeConfig(webpackConfig);
  }

  const compiler = webpack(webpackConfig);
  return runCompiler(compiler);
};

/**
 * Bundle dlls when node_modules changed, dlls not exist, extraVendors changed, or package to dev changed;
 */
export const bundleDlls = async (opts: IDllOptions): Promise<any> => {
  if (
    hasPackageChanged() ||
    hasExtraVendorsChanged() ||
    (hasNodeModules() && hasNodeModulesModified()) ||
    !fs.existsSync(path.join(opts.dllOutPath, opts.dllFileName))
  ) {
    await runWebpackDll(opts);
  }
};

function runCompiler(compiler: webpack.Compiler) {
  return new Promise((resolve, reject) => {
    compiler.run((err, status) => {
      if (!err && !status.hasErrors()) {
        process.stdout.write(`${status.toString(stats)}\n\n`);

        resolve(status.toJson());
      } else if (err && err.message) {
        reject(err.message);
      } else {
        reject(status.toString());
      }
    });
  });
}
