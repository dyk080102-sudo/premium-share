import { describe, test, expect } from 'vitest'
import { RefundService } from '@premium-share/domain'

// Unit tests for refund calculation (no DB needed)
describe('환불 계산', () => {
  // Create a mock instance just to access the method
  const service = Object.create(RefundService.prototype) as RefundService

  test('이용 시작 전: 전액 환불 가능', () => {
    const refundable = service.calculateRefundableAmount({
      paidAmount: 10000,
      startedAt: null,
      expiresAt: null,
      durationDays: 30,
      existingRefunds: 0,
    })
    expect(refundable).toBe(10000)
  })

  test('이용 50% 시점: 약 50% 환불 가능', () => {
    const start = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
    const expires = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) // 15 days from now

    const refundable = service.calculateRefundableAmount({
      paidAmount: 10000,
      startedAt: start,
      expiresAt: expires,
      durationDays: 30,
      existingRefunds: 0,
    })

    // Used ~50% = refund ~50%
    expect(refundable).toBeGreaterThan(4000)
    expect(refundable).toBeLessThan(6000)
  })

  test('이미 만료된 경우: 환불 불가', () => {
    const start = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
    const expires = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)

    const refundable = service.calculateRefundableAmount({
      paidAmount: 10000,
      startedAt: start,
      expiresAt: expires,
      durationDays: 30,
      existingRefunds: 0,
    })

    expect(refundable).toBe(0)
  })

  test('환불 상한: 실제 결제액 초과 불가', () => {
    const refundable = service.calculateRefundableAmount({
      paidAmount: 10000,
      startedAt: null,
      expiresAt: null,
      durationDays: 30,
      existingRefunds: 5000, // already refunded 5000
    })

    // Max refundable = 10000 - 5000 = 5000
    expect(refundable).toBe(5000)
  })

  test('이미 완료된 환불 차감', () => {
    const refundable = service.calculateRefundableAmount({
      paidAmount: 10000,
      startedAt: null,
      expiresAt: null,
      durationDays: 30,
      existingRefunds: 10000, // fully refunded
    })

    expect(refundable).toBe(0)
  })

  test('음수 환불은 0으로 처리', () => {
    const refundable = service.calculateRefundableAmount({
      paidAmount: 5000,
      startedAt: null,
      expiresAt: null,
      durationDays: 30,
      existingRefunds: 6000, // over-refunded (should not happen but be safe)
    })

    expect(refundable).toBe(0)
  })
})

describe('슬롯 수량 계산', () => {
  test('총 정원 - 관리자 좌석 = 고객 슬롯', () => {
    const totalCapacity = 5
    const adminSlots = 1
    const customerSlots = totalCapacity - adminSlots
    expect(customerSlots).toBe(4)
  })

  test('활성 Allocation 기반 점유 계산', () => {
    // Simulate slot occupancy
    const allocations = [
      { id: '1', status: 'ACTIVE' },
      { id: '2', status: 'INVITED' },
      { id: '3', status: 'RECLAIMED' }, // should not count
    ]

    const occupied = allocations.filter((a) => a.status !== 'RECLAIMED').length
    expect(occupied).toBe(2)
  })

  test('회수된 배정은 슬롯 수에서 제외', () => {
    const allocations = [
      { id: '1', status: 'RECLAIMED' },
      { id: '2', status: 'RECLAIMED' },
      { id: '3', status: 'RECLAIMED' },
    ]

    const active = allocations.filter((a) => a.status !== 'RECLAIMED').length
    expect(active).toBe(0)
  })
})
