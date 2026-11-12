import {quasar, transformAssetUrls} from '@quasar/vite-plugin'
import {fileURLToPath, URL} from 'node:url'

import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        vue({
            template: {
                transformAssetUrls,
            },
        }),
        quasar({
          sassVariables: fileURLToPath(
              new URL('./src/assets/quasar.variables.scss', import.meta.url),
          ),
        }),
        vueDevTools(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
})
