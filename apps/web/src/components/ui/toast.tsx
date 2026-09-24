'use client'

import * as React from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { cn } from '@/lib/utils'

type ToastVariant = 'default' | 'success' | 'error'

type ToastItem = {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

type ToastContextValue = {
  toast: (input: { title: string; description?: string; variant?: ToastVariant }) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return ctx
}

/** Safe hook that no-ops outside provider (for optional usage). */
export function useToastOptional(): ToastContextValue {
  const ctx = React.useContext(ToastContext)
  if (ctx) return ctx
  const noop = () => {}
  return {
    toast: noop,
    success: noop,
    error: noop,
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([])

  const push = React.useCallback(
    (input: { title: string; description?: string; variant?: ToastVariant }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setItems((prev) => [
        ...prev,
        {
          id,
          title: input.title,
          description: input.description,
          variant: input.variant ?? 'default',
        },
      ])
    },
    [],
  )

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast: push,
      success: (title, description) => push({ title, description, variant: 'success' }),
      error: (title, description) => push({ title, description, variant: 'error' }),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4500}>
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            open
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((t) => t.id !== item.id))
            }}
            className={cn(
              'fixed bottom-4 right-4 z-[100] w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border bg-white p-4 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out',
              item.variant === 'success' && 'border-green-200 bg-green-50',
              item.variant === 'error' && 'border-red-200 bg-red-50',
            )}
          >
            <ToastPrimitive.Title
              className={cn(
                'text-sm font-semibold',
                item.variant === 'success' && 'text-green-800',
                item.variant === 'error' && 'text-red-800',
              )}
            >
              {item.title}
            </ToastPrimitive.Title>
            {item.description && (
              <ToastPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {item.description}
              </ToastPrimitive.Description>
            )}
            <ToastPrimitive.Close className="absolute right-2 top-2 text-xs text-muted-foreground hover:text-foreground">
              닫기
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}

/** Parse JSON API error bodies into a user-facing message. */
export async function readApiError(res: Response, fallback = '요청 처리 중 오류가 발생했습니다.'): Promise<string> {
  try {
    const data = await res.json()
    if (typeof data?.error === 'string') return data.error
    if (typeof data?.message === 'string') return data.message
  } catch {
    /* ignore */
  }
  return fallback
}
