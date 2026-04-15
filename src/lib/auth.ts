export const USER_KEY = 'pharo_sort_user'

export function getCurrentUser(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(USER_KEY)
}

export function setCurrentUser(name: string): void {
  localStorage.setItem(USER_KEY, name)
}

export function clearCurrentUser(): void {
  localStorage.removeItem(USER_KEY)
}
