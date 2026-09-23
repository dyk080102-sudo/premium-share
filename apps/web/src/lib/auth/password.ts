import argon2 from 'argon2'

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS)
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: '비밀번호는 최소 8자 이상이어야 합니다.' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '영문 대문자를 최소 1개 포함해야 합니다.' }
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '영문 소문자를 최소 1개 포함해야 합니다.' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '숫자를 최소 1개 포함해야 합니다.' }
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: '특수문자를 최소 1개 포함해야 합니다.' }
  }
  return { valid: true }
}
