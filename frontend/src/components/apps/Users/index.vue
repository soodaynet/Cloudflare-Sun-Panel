<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { AcceptableValue } from 'reka-ui'
import { toast } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import EditUser from './EditUser/index.vue'
import { useAuthStore } from '@/store'
import {
  getPublicVisitUser,
  setPublicVisitUser,
  deleteUsers,
  getUserList,
} from '@/modules'

const authStore = useAuthStore()

const tableIsLoading = ref(false)
const editUserDialogShow = ref(false)
const editUserUserInfo = ref<User.Info>()
const publicVisitUserId = ref<number | null>(null)

const userList = ref<User.Info[]>([])

// 分页状态
const page = ref(1)
const pageSize = ref(5)
const total = ref(0)
const totalPages = computed(() =>
  total.value > 0 ? Math.ceil(total.value / pageSize.value) : 1,
)

// 删除确认对话框
const deleteDialogShow = ref(false)
const deleteTarget = ref<User.Info | null>(null)

function handleAdd() {
  editUserUserInfo.value = undefined
  editUserDialogShow.value = true
}

function handleEdit(row: User.Info) {
  editUserUserInfo.value = row
  editUserDialogShow.value = true
}

function confirmDelete(row: User.Info) {
  deleteTarget.value = row
  deleteDialogShow.value = true
}

async function handleDelete() {
  if (!deleteTarget.value) return
  const { code } = await deleteUsers([deleteTarget.value.id])
  if (code === 0) {
    toast.success('删除成功')
    deleteDialogShow.value = false
    deleteTarget.value = null
    loadList()
  }
}

async function handleTogglePublic(row: User.Info) {
  if (publicVisitUserId.value && publicVisitUserId.value === row.id) {
    const { code } = await setPublicVisitUser(null)
    if (code === 0) {
      publicVisitUserId.value = null
      toast.success('已取消公开访问')
    }
  } else {
    const { code } = await setPublicVisitUser(row.id)
    if (code === 0) {
      publicVisitUserId.value = row.id
      toast.success('已设置为公开访问用户')
    }
  }
}

function handleDone() {
  editUserDialogShow.value = false
  toast.success('保存成功')
  loadList()
}

function gotoPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  loadList()
}

function handlePageSizeChange(val: AcceptableValue) {
  pageSize.value = Number(val)
  page.value = 1
  loadList()
}

async function loadList() {
  tableIsLoading.value = true
  try {
    const { data } = await getUserList(page.value, pageSize.value)
    total.value = data?.total || 0
    userList.value = data?.list ?? []
  } catch (e) {
    console.error(e)
  } finally {
    tableIsLoading.value = false
  }
}

onMounted(async () => {
  // 获取当前公开访问用户
  try {
    const { data } = await getPublicVisitUser<User.Info | null>()
    if (data?.id) publicVisitUserId.value = data.id
    else publicVisitUserId.value = null
  } catch {
    /* ignore */
  }
  loadList()
})
</script>

<template>
  <div class="overflow-auto pt-2">

    <div class="my-3">
      <Button size="sm" @click="handleAdd">添加用户</Button>
    </div>

    <!-- 用户列表 -->
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>用户名</TableHead>
          <TableHead>昵称</TableHead>
          <TableHead>角色</TableHead>
          <TableHead class="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="tableIsLoading">
          <TableCell :colspan="4" class="text-center text-muted-foreground">
            加载中...
          </TableCell>
        </TableRow>
        <TableRow v-else-if="userList.length === 0">
          <TableCell :colspan="4" class="text-center text-muted-foreground">
            暂无数据
          </TableCell>
        </TableRow>
        <TableRow v-for="row in userList" :key="row.id">
          <TableCell>
            <span
              v-if="publicVisitUserId && publicVisitUserId === row.id"
              class="text-blue-600 dark:text-blue-400"
            >[公开]-</span>{{ row.username }}<span
              v-if="row.username === authStore.userInfo?.username"
              class="text-muted-foreground"
            >
              (当前用户)</span>
          </TableCell>
          <TableCell>{{ row.name }}</TableCell>
          <TableCell>
            <Badge :variant="row.role === 1 ? 'default' : 'secondary'">
              {{ row.role === 1 ? '管理员' : '普通用户' }}
            </Badge>
          </TableCell>
          <TableCell class="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="sm">...</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @select="handleEdit(row)">编辑</DropdownMenuItem>
                <DropdownMenuItem @select="handleTogglePublic(row)">
                  {{
                    publicVisitUserId && publicVisitUserId === row.id
                      ? '取消公开访问'
                      : '设置为公开访问'
                  }}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" @select="confirmDelete(row)">
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

    <!-- 分页 -->
    <div class="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground">每页</span>
        <Select
          :model-value="String(pageSize)"
          @update:model-value="handlePageSizeChange"
        >
          <SelectTrigger class="h-8 w-[80px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="30">30</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
        <span class="text-muted-foreground">条</span>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          :disabled="page <= 1"
          @click="gotoPage(page - 1)"
        >
          上一页
        </Button>
        <span class="text-muted-foreground">
          第 {{ page }} / {{ totalPages }} 页（共 {{ total }} 条）
        </span>
        <Button
          variant="outline"
          size="sm"
          :disabled="page >= totalPages"
          @click="gotoPage(page + 1)"
        >
          下一页
        </Button>
      </div>
    </div>

    <!-- 删除确认对话框 -->
    <Dialog :open="deleteDialogShow" @update:open="deleteDialogShow = $event">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>警告</DialogTitle>
          <DialogDescription>
            确定删除用户 "{{ deleteTarget?.name }}"（{{ deleteTarget?.username }}）吗？此操作不可恢复。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="deleteDialogShow = false">取消</Button>
          <Button variant="destructive" @click="handleDelete">确定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <EditUser
      :visible="editUserDialogShow"
      :user-info="editUserUserInfo"
      @update:visible="editUserDialogShow = $event"
      @done="handleDone"
    />
  </div>
</template>
