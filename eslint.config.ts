import { defineConfig, globalIgnores } from 'eslint/config';
import universeNodeConfig from 'eslint-config-universe/flat/node';

export default defineConfig([globalIgnores(['build', 'coverage']), universeNodeConfig]);
