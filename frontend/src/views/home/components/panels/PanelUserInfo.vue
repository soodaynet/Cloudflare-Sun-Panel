<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { toast } from '@/components/ui/sonner'
import { useAuthStore, useAppStore } from '@/store'
import { updateUserInfo, updatePassword } from '@/modules'

const router = useRouter()
const authStore = useAuthStore()
const appStore = useAppStore()

// ====== 名称修改 ======
const editingName = ref(false)
const nameValue = ref('')
const nameSaving = ref(false)

function startEditName() {
  nameValue.value = authStore.userInfo?.name || ''
  editingName.value = true
}

async function handleSaveName() {
  const trimmed = nameValue.value.trim()
  if (!trimmed) { toast.warning('名称不能为空'); return }
  if (trimmed === authStore.userInfo?.name) { editingName.value = false; return }
  nameSaving.value = true
  try {
    const res = await updateUserInfo<unknown>(trimmed)
    if (res.code === 0) {
      authStore.setUserInfo({ ...authStore.userInfo!, name: trimmed })
      toast.success('名称已更新')
      editingName.value = false
    } else {
      toast.error(res.msg || '更新失败')
    }
  } catch {
    toast.error('网络错误')
  } finally {
    nameSaving.value = false
  }
}

// ====== 密码修改 ======
const editingPassword = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordSaving = ref(false)

function startEditPassword() {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  editingPassword.value = true
}

async function handleSavePassword() {
  if (!oldPassword.value) { toast.warning('请输入当前密码'); return }
  if (!newPassword.value) { toast.warning('请输入新密码'); return }
  if (newPassword.value.length < 6) { toast.warning('新密码至少6位'); return }
  if (newPassword.value !== confirmPassword.value) { toast.warning('两次密码不一致'); return }
  passwordSaving.value = true
  try {
    const res = await updatePassword<unknown>(oldPassword.value, newPassword.value)
    if (res.code === 0) {
      toast.success('密码已修改，请重新登录')
      editingPassword.value = false
      setTimeout(() => { authStore.removeToken(); router.push('/login') }, 1500)
    } else {
      toast.error(res.msg || '修改失败')
    }
  } catch {
    toast.error('网络错误')
  } finally {
    passwordSaving.value = false
  }
}

function handleLogout() {
  authStore.removeToken()
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 用户信息 -->
    <Card>
      <CardHeader>
        <CardTitle>用户信息</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="flex items-center gap-2 sm:gap-3">
          <div class="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
            {{ authStore.userInfo?.name?.charAt(0) || '?' }}
          </div>
          <div>
            <div class="font-medium">{{ authStore.userInfo?.name }}</div>
            <div class="text-sm text-muted-foreground">{{ authStore.userInfo?.username }}</div>
            <div class="text-xs text-muted-foreground">角色: {{ authStore.userInfo?.role === 1 ? '管理员' : '普通用户' }}</div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 账户安全：名称 + 密码 -->
    <Card>
      <CardHeader>
        <CardTitle>账户安全</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <!-- 修改名称 -->
        <div>
          <label class="block text-sm mb-1 font-medium">账户名称</label>
          <div v-if="editingName" class="flex flex-col gap-2">
            <Input v-model="nameValue" placeholder="请输入新名称" />
            <div class="flex gap-2">
              <Button size="sm" :disabled="nameSaving" @click="handleSaveName">保存</Button>
              <Button size="sm" variant="outline" @click="editingName = false">取消</Button>
            </div>
          </div>
          <div v-else class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">{{ authStore.userInfo?.name }}</span>
            <Button size="sm" variant="link" class="h-auto p-0" @click="startEditName">修改</Button>
          </div>
        </div>

        <!-- 修改密码 -->
        <div>
          <label class="block text-sm mb-1 font-medium">账户密码</label>
          <div v-if="editingPassword" class="flex flex-col gap-2">
            <Input v-model="oldPassword" type="password" placeholder="当前密码" />
            <Input v-model="newPassword" type="password" placeholder="新密码（至少6位）" />
            <Input v-model="confirmPassword" type="password" placeholder="确认新密码" />
            <div class="flex gap-2">
              <Button size="sm" :disabled="passwordSaving" @click="handleSavePassword">保存</Button>
              <Button size="sm" variant="outline" @click="editingPassword = false">取消</Button>
            </div>
          </div>
          <div v-else class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">******</span>
            <Button size="sm" variant="link" class="h-auto p-0" @click="startEditPassword">修改</Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 偏好设置：主题 + 语言 -->
    <Card>
      <CardHeader>
        <CardTitle>偏好设置</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="grid grid-cols-1 @[600px]:grid-cols-2 gap-4">
          <!-- 主题 -->
          <div>
            <label class="block text-sm mb-1 font-medium">主题</label>
            <div class="flex gap-2">
              <Button
                size="sm"
                :variant="appStore.theme === 'dark' ? 'default' : 'outline'"
                @click="appStore.setTheme('dark')"
                >深色</Button
              >
              <Button
                size="sm"
                :variant="appStore.theme === 'light' ? 'default' : 'outline'"
                @click="appStore.setTheme('light')"
                >浅色</Button
              >
              <Button
                size="sm"
                :variant="appStore.theme === 'auto' ? 'default' : 'outline'"
                @click="appStore.setTheme('auto')"
                >跟随系统</Button
              >
            </div>
          </div>

          <!-- 语言 -->
          <div>
            <label class="block text-sm mb-1 font-medium">语言</label>
            <div class="flex gap-2">
              <Button
                size="sm"
                :variant="appStore.language === 'zh-CN' ? 'default' : 'outline'"
                @click="appStore.setLanguage('zh-CN')"
                >中文</Button
              >
              <Button
                size="sm"
                :variant="appStore.language === 'en-US' ? 'default' : 'outline'"
                @click="appStore.setLanguage('en-US')"
                >English</Button
              >
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 退出登录 -->
    <Button variant="destructive" class="w-full" @click="handleLogout">退出登录</Button>
  </div>
</template>
