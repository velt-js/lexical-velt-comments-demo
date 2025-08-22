import {mergeConfig} from 'vite';

import lexicalMonorepoPlugin from '../../packages/shared/lexicalMonorepoPlugin';
import config from './vite.config';

export default mergeConfig(config, {
  plugins: [lexicalMonorepoPlugin()],
});
