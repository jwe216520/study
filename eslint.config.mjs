import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
export default defineConfig([
  globalIgnores(['.next/**','.next-ui/**','.cloudflare/**','.vinext/**','.wrangler/**','.open-next/**','dist/**','node_modules/**','public/pdf.worker.min.mjs','test-results/**','playwright-report/**']),
  js.configs.recommended,
  { files:['**/*.{js,mjs}'],languageOptions:{globals:{...globals.browser,...globals.node},parserOptions:{ecmaFeatures:{jsx:true}}},
    plugins:{react,'react-hooks':hooks}, settings:{react:{version:'detect'}},
    rules:{'react/jsx-uses-vars':'error','react/no-unescaped-entities':'error','react-hooks/rules-of-hooks':'error','react-hooks/exhaustive-deps':'warn','no-unused-vars':['warn',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}}
]);
