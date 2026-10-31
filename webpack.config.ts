import type { Configuration } from 'webpack';
import { merge } from 'webpack-merge';
import grafanaConfig, { Env } from './.config/webpack/webpack.config';

const config = async (env: Env): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);
  return merge(baseConfig, {
    performance: {
      // Screenshots are shown by the plugin catalog, never loaded by the panel: only the code counts for its size.
      assetFilter: (asset: string) => !/\.(png|jpe?g|svg)$/.test(asset),
    },
  });
};

export default config;
