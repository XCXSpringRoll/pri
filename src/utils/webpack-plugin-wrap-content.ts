import * as webpack from 'webpack';
import * as ConcatSource from 'webpack-sources';
import * as path from 'path';
import * as _ from 'lodash';
import { pri } from '../node';

export class WrapContent {
  private header = '';

  private footer = '';

  public constructor(header = '', footer = '') {
    this.header = header;
    this.footer = footer;
  }

  public apply(compiler: webpack.Compiler): void {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    compiler.hooks.compilation.tap('WrapContent', (compilation: webpack.compilation.Compilation) => {
      compilation.hooks.optimizeChunkAssets.tapAsync(
        'WrapContent',
        (chunks: Array<webpack.compilation.Chunk>, done: () => void) => {
          chunks.forEach((chunk: webpack.compilation.Chunk) => {
            chunk.files.forEach((fileName: string) => {
              // Ignore workers
              if (fileName.indexOf('worker.js') > -1) {
                return;
              }

              if (
                chunk.name === 'main' ||
                chunk.name === path.basename(pri.sourceConfig.outFileName, '.js') ||
                _.has(pri.sourceConfig.entries, chunk.name)
              ) {
                compilation.assets[fileName] = new ConcatSource.ConcatSource(
                  this.header,
                  compilation.assets[fileName],
                  this.footer,
                );
              }
            });
          });
          done();
        },
      );
    });
  }
}
