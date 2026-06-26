<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createUser, updateUser } from '@/modules'
import type { UserFormData } from '@/modules'

interface Props {
  visible: boolean
  userInfo?: User.Info
}

interface Emit {
  (e: 'update:visible', visible: boolean): void
  (e: 'done'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emit>()

const formInitValue = {
  username: '',
  name: '',
  role: 2,
  password: '',
}

const model = ref({ ...formInitValue })

const show = computed({
  get: () => props.visible,
  set: (visible: boolean) => emit('update:visible', visible),
})

const isEdit = computed(() => !!props.userInfo?.id)

watch(
  () => props.visible,
  (val) => {
    if (val) {
      if (props.userInfo?.id) {
        model.value = { ...props.userInfo, password: '' }
      } else {
        model.value = { ...formInitValue }
      }
    }
  },
)

// 简单手动校验：用户名必填，角色默认有值
function validate(): boolean {
  if (!model.value.username.trim()) {
    toast.warning('请输入用户名')
    return false
  }
  return true
}

async function handleSave() {
  if (!validate()) return

  const req: UserFormData = {
    username: model.value.username,
    name: model.value.name || model.value.username,
    role: model.value.role,
    status: 1,
  }

  if (isEdit.value) {
    req.id = props.userInfo?.id
    if (model.value.password) req.password = model.value.password
  } else {
    req.password = model.value.password
  }

  const res = isEdit.value ? await updateUser(req) : await createUser(req)
  if (res.code === 0) {
    toast.success('保存成功')
    emit('done')
  }
  // 非 0 错误码已由请求层 toast 提示
}
</script>

<template>
  <Dialog v-model:open="show">
    <DialogContent class="sm:max-w-[400px]">
      <DialogHeader>
        <DialogTitle>{{ isEdit ? '编辑用户' : '添加用户' }}</DialogTitle>
        <DialogDescription>
          {{ isEdit ? '修改用户信息，密码留空表示不修改。' : '创建一个新的用户账号。' }}
        </DialogDescription>
      </DialogHeader>

      <Form @submit.prevent="handleSave">
        <FormField name="username">
          <FormItem>
            <FormLabel>用户名</FormLabel>
            <FormControl>
              <Input v-model="model.username" placeholder="请输入用户名" />
            </FormControl>
          </FormItem>
        </FormField>

        <FormField name="name" class="mt-4">
          <FormItem>
            <FormLabel>昵称</FormLabel>
            <FormControl>
              <Input v-model="model.name" placeholder="请输入昵称" />
            </FormControl>
          </FormItem>
        </FormField>

        <FormField name="role" class="mt-4">
          <FormItem>
            <FormLabel>角色</FormLabel>
            <Select
              :model-value="String(model.role)"
              @update:model-value="model.role = Number($event)"
            >
              <FormControl>
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="请选择角色" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="2">普通用户</SelectItem>
                <SelectItem value="1">管理员</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        </FormField>

        <FormField name="password" class="mt-4">
          <FormItem>
            <FormLabel>密码</FormLabel>
            <FormControl>
              <Input
                v-model="model.password"
                type="password"
                :placeholder="isEdit ? '留空则不修改密码' : '可留空，后续可设置'"
              />
            </FormControl>
          </FormItem>
        </FormField>

        <DialogFooter class="mt-6">
          <Button variant="outline" type="button" @click="emit('update:visible', false)">
            取消
          </Button>
          <Button type="submit">保存</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>
