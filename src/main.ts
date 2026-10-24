import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { iniciarApp } from './lib/app'
import './estilos.css'

createApp(App).use(createPinia()).use(router).mount('#app')
void iniciarApp(router)
