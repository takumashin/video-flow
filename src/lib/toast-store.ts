import { create } from 'zustand'

export type ToastType = 'error' | 'success' | 'info'

export type Toast = {
  id: string
  type: ToastType
  message: string
}

type ToastStore = {
  toasts: Toast[]
  addToast: (type: ToastType, message: string) => void
  removeToast: (id: string) => void
}

let counter = 0

export const useToastStore = create<ToastStore>()((set, get) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = `toast-${++counter}-${Date.now()}`
    set(state => ({ toasts: [...state.toasts, { id, type, message }] }))
    window.setTimeout(() => {
      get().removeToast(id)
    }, 4000)
  },
  removeToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
  },
}))

export const toast = {
  error: (message: string) => useToastStore.getState().addToast('error', message),
  success: (message: string) => useToastStore.getState().addToast('success', message),
  info: (message: string) => useToastStore.getState().addToast('info', message),
}
