// eslint-disable-next-line import/no-extraneous-dependencies
import * as express from 'express';
import * as normalizePath from 'normalize-path';
import * as open from 'open';
import * as path from 'path';
import * as urlJoin from 'url-join';
import * as yargs from 'yargs';
import * as webpack from 'webpack';
import * as WebpackBar from 'webpackbar';
import * as CircularDependencyPlugin from 'circular-dependency-plugin';
import * as _ from 'lodash';
import * as WebpackDevServer from 'webpack-dev-server';
import * as SpeedMeasurePlugin from 'speed-measure-webpack-plugin';
import * as ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import { globalState } from './global-state';
import { plugin } from './plugins';
import { tempPath, srcPath, packagesPath } from './structor-config';
import { logInfo } from './log';
import { getWebpackConfig, IOptions } from './webpack-config';

const smp = new SpeedMeasurePlugin();

interface IExtraOptions {
  pipeConfig?: (config?: webpack.Configuration) => Promise<webpack.Configuration>;
  devServerPort: number;
  publicPath: string;
  jsOnly?: boolean;
  hot?: boolean;
  devUrl?: string;
  autoOpenBrowser?: boolean;
  https?: boolean;
  contentBase?: string;
}

const stats = {
  warnings: true,
  assets: false,
  version: false,
  modules: false,
  entrypoints: false,
  hash: false,
  colors: true,
  children: false,
};

export const runWebpackDevServer = async (
  opts: IOptions<IExtraOptions>,
  configWrapper?: (webpackConfig: webpack.Configuration) => webpack.Configuration,
) => {
  let webpackConfig = await getWebpackConfig(opts);

  if (opts.pipeConfig) {
    webpackConfig = await opts.pipeConfig(webpackConfig);
  }

  webpackConfig.plugins.push(new WebpackBar());

  // If set open in project config, perform a circular dependency check
  if (globalState.projectConfig.circularDetect?.enable) {
    const exclude = globalState.projectConfig.circularDetect?.exclude;
    webpackConfig.plugins.push(
      new CircularDependencyPlugin({
        exclude: exclude ? new RegExp(exclude) : /node_modules/,
        cwd: process.cwd(),
      }),
    );
  }

  if (
    globalState.sourceConfig.devChecker?.typescript?.enabled !== false ||
    globalState.sourceConfig.devChecker?.eslint?.enabled
  ) {
    webpackConfig.plugins.push(
      new ForkTsCheckerWebpackPlugin({
        async: globalState.sourceConfig.devChecker?.async,
        typescript: {
          enabled: true,
          memoryLimit: 8192,
          mode: 'write-references',
          ...globalState.sourceConfig.devChecker?.typescript,
        },
        issue: globalState.sourceConfig.devChecker?.issue,
      }),
    );
  }

  const defaultWebpackDevServerConfig: WebpackDevServer.Configuration = {
    host: globalState.sourceConfig.host,
    hot: opts.hot,
    static: {
      publicPath: opts.publicPath,
    },
    compress: true,
    ...(!opts.jsOnly && {
      historyApiFallback: { rewrites: [{ from: '/', to: normalizePath(path.join(opts.publicPath, 'index.html')) }] },
    }),
    server: {
      type: 'https',
    },
    client: {
      overlay: { warnings: false, errors: true },
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization, x-csrf-token',
    },
    allowedHosts: 'all',
    port: opts.devServerPort,
  } as any;

  const webpackDevServerConfig = (await plugin.devServerConfigPipes.reduce(async (newConfig, fn) => {
    return fn(await newConfig);
  }, Promise.resolve(defaultWebpackDevServerConfig))) as any;

  if (yargs.argv.measureSpeed) {
    // @ts-expect-error
    webpackConfig = smp.wrap(webpackConfig);
  }

  if (configWrapper) {
    webpackConfig = configWrapper(webpackConfig);
  }

  const compiler = webpack(webpackConfig);

  const devServer = new WebpackDevServer(webpackDevServerConfig, compiler);
  const { port, host, https } = webpackDevServerConfig;

  devServer
    .start()
    .then(() => {
      let devUrl: string = null;
      const localSuggestUrl = urlJoin(
        `${https ? 'https' : 'http'}://${host}:${port}`,
        globalState.sourceConfig.baseHref,
      );

      if (opts.devUrl === host) {
        devUrl = localSuggestUrl;
      } else if (opts.devUrl !== undefined) {
        ({ devUrl } = opts);
      } else if (globalState.sourceConfig.devUrl !== undefined && globalState.sourceConfig.devUrl !== null) {
        ({ devUrl } = globalState.sourceConfig);
      } else {
        devUrl = localSuggestUrl;
      }

      logInfo(`Serve on ${devUrl}`);

      if (opts.autoOpenBrowser && devUrl) {
        open(devUrl);
      }
    })
    .catch(err => {
      console.error(`Failed to start dev server`, err);
    });
};
