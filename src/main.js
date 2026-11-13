import { createApp } from 'vue'
import { Quasar } from 'quasar'
import { createPinia } from 'pinia'
import router from './router'

import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'

import App from './App.vue'

createApp(App)
    .use(Quasar, {
        plugins: {},
    })
    .use(createPinia())
    .use(router)
    .mount('#app')
