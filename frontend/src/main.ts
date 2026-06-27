import { createApp } from 'vue'
import App from './App.vue'
import { setupI18n } from './locales'
import { setupStore } from './store'
import { setupRouter } from './router'
import './styles/global.css'

async function bootstrap() {
  const app = createApp(App)
  setupStore(app)
  setupI18n(app)
  
  // 立即挂载，不等待路由就绪，消除首屏白屏等待
  setupRouter(app)
  app.mount('#app')
}

bootstrap()
