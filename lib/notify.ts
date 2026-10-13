'use client'

import type { Alert } from './types'

const LAST_KEY = 'moneyguard:lastNotifiedAlert'

export function canNotify() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notifyState(): NotificationPermission | 'unsupported' {
  if (!canNotify()) return 'unsupported'
  return Notification.permission
}

export async function askNotifyPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!canNotify()) return 'unsupported'
  return Notification.requestPermission()
}

/**
 * 앱이 열릴 때 가장 급한 경고 하나만 알린다.
 * 같은 경고를 두 번 띄우지 않는다 — 반복되는 알림은 그 순간부터 무시된다.
 */
export async function notifyTopAlert(alert: Alert | null) {
  if (!alert || !canNotify() || Notification.permission !== 'granted') return
  try {
    if (window.localStorage.getItem(LAST_KEY) === alert.id) return
    window.localStorage.setItem(LAST_KEY, alert.id)
  } catch {
    // 저장이 안 되면 중복 방지만 포기하고 알림은 띄운다.
  }
  const reg = await navigator.serviceWorker?.getRegistration()
  const options: NotificationOptions & { data?: unknown } = {
    body: alert.message,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: alert.id,
    data: { href: alert.action_href ?? '/alerts' },
  }
  if (reg) await reg.showNotification(alert.title, options)
  else new Notification(alert.title, options)
}
