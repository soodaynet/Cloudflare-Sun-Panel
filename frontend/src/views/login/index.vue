<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/sonner'
import { login } from '@/modules/auth/api'
import { useAuthStore, VisitMode } from '@/store/modules/auth'
import { TOKEN_KEY } from '@/utils/storageKeys'
import { useLoginPage } from './composables/useLoginPage'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)

const { hasPublicMode, siteTitle, pageLoading, loginPageStyle, loginCardStyle, loginButtonStyle, bgImageReady, initLoginPage, prefetchInitForUser } = useLoginPage()

onMounted(() => {
  initLoginPage()
})

async function handleLogin() {
  if (!username.value || !password.value) {
    toast.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    const res = await login<{ token: string; userInfo: User.Info }>(username.value, password.value)
    if (res.code === 0) {
      authStore.loginSuccess(res.data.token, res.data.userInfo)
      toast.success('登录成功')
      // FE-5: 跳转前 fire-and-forget 预取 /init，写入 init:<userId> 缓存，首页 loadInitData 命中即复用
      prefetchInitForUser(res.data.userInfo.id)
      router.push('/')
    } else {
      toast.error(res.msg || '登录失败')
    }
  } catch {
    toast.error('网络错误，请稍后重试')
  } finally {
    loading.value = false
  }
}

function handleSkipLogin() {
  authStore.token = null
  localStorage.removeItem(TOKEN_KEY)
  authStore.setVisitMode(VisitMode.VISIT_MODE_PUBLIC)
  router.push('/')
}
</script>

<template>
  <div
    class="login-page-container flex items-center justify-center min-h-screen"
    :class="{ 'bg-ready': bgImageReady }"
    :style="loginPageStyle"
  >
    <!-- 加载动画 -->
    <Transition name="loader-fade">
      <div v-if="pageLoading" class="loader-overlay fixed inset-0 z-50">
        <div class="loader-ring">
          <div class="loader-ring-inner" />
        </div>
        <p class="loader-text">加载中...</p>
      </div>
    </Transition>
    <Transition name="card-in">
      <Card
        v-if="!pageLoading"
        class="login-card w-[92vw] sm:w-full max-w-sm shadow-xl mx-4"
        :style="loginCardStyle"
      >
        <CardHeader class="text-center">
          <CardTitle class="text-xl text-gray-700 dark:text-gray-200">
            {{ siteTitle }}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <form class="flex flex-col gap-4" @submit.prevent="handleLogin">
            <div class="flex flex-col gap-2">
              <Label for="username">用户名</Label>
              <Input
                id="username"
                v-model="username"
                placeholder="请输入用户名"
                :disabled="loading"
                autocomplete="username"
              />
            </div>
            <div class="flex flex-col gap-2">
              <Label for="password">密码</Label>
              <Input
                id="password"
                v-model="password"
                type="password"
                placeholder="请输入密码"
                :disabled="loading"
                autocomplete="current-password"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              class="login-btn w-full touch-manipulation text-white shadow-lg shadow-[#4a90d9]/30 transition-all hover:brightness-110"
              :style="loginButtonStyle"
              :disabled="loading"
            >
              <span v-if="loading" class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              登录
            </Button>
          </form>
        </CardContent>

        <CardFooter v-if="hasPublicMode" class="flex-col items-stretch gap-4">
          <div class="h-px bg-border" />
          <Button variant="secondary" size="lg" class="w-full touch-manipulation" @click="handleSkipLogin">
            以访客身份浏览
          </Button>
        </CardFooter>
      </Card>
    </Transition>
  </div>
</template>

<style scoped>
/* 登录页壁纸淡入动画，与访客页面 HomeWallpaper 效果一致 */
.login-page-container {
  opacity: 0;
  transition: opacity 0.5s ease-in-out;
}
.login-page-container.bg-ready {
  opacity: 1;
}

/* 登录卡片淡入+上浮动画，与背景图淡入协调 */
.card-in-enter-active {
  transition: opacity 0.4s ease-out, transform 0.4s ease-out;
}
.card-in-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.login-card {
  background-color: var(--glass-bg-hover) !important;
  -webkit-backdrop-filter: blur(var(--glass-blur));
  backdrop-filter: blur(var(--glass-blur));
  border-radius: var(--radius-xl) !important;
  border: 1px solid var(--glass-border) !important;
  box-shadow: 0 0 30px rgba(74, 144, 217, 0.15), 0 8px 32px rgba(0, 0, 0, 0.2);
  transition: box-shadow 0.3s ease;
}

.login-card :deep(.login-btn) {
  background-color: var(--btn-bg, rgba(74, 144, 217, 0.82)) !important;
  backdrop-filter: blur(var(--btn-blur, 14.4px));
  -webkit-backdrop-filter: blur(var(--btn-blur, 14.4px));
}
.login-card :deep(.login-btn):disabled {
  opacity: 0.7;
}
</style>
