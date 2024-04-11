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

  public apply(compiler: webpack.Compiler) {
    // @ts-ignore
    compiler.hooks.compilation.tap('WrapContent', compilation => {
      compilation.hooks.processAssets.tapAsync(
        {
          name: 'WrapContent',
          // @ts-ignore
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE,
        },
        (assets: any, done: any) => {
          Object.keys(assets).forEach(fileName => {
            // Ignore workers
            if (fileName.indexOf('worker.js') > -1) {
              return;
            }
            const chunkName = [...compilation.chunkGroups]
              .flatMap(chunkGroup => chunkGroup.chunks)
              .find(chunk => chunk.files.has(fileName))?.name;
          });
          done();
        },
      );
    });
  }
}
