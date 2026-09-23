import { describe, test, expect } from 'vitest'
import { calculateAssignableCapacity } from '@premium-share/domain'

describe('가족 정원 계산', () => {
  test('기본: admin + 가입 + 초대 + 내부예약 합산 후 배정가능', () => {
    const r = calculateAssignableCapacity({
      capacityTotal: 6,
      adminSeats: 1,
      joinedMembers: 2,
      pendingInvites: 1,
      internalReservations: 1,
      removalPending: 0,
      unmanagedMembers: 0,
    })
    // occupied = 1+2+1+1 = 5, assignable = 1
    expect(r.assignable).toBe(1)
    expect(r.contradictory).toBe(false)
  })

  test('정원 초과 모순 시 assignable=0', () => {
    const r = calculateAssignableCapacity({
      capacityTotal: 4,
      adminSeats: 1,
      joinedMembers: 3,
      pendingInvites: 1,
      internalReservations: 1,
      removalPending: 0,
      unmanagedMembers: 0,
    })
    expect(r.contradictory).toBe(true)
    expect(r.assignable).toBe(0)
    expect(r.reasons.some((x) => x.includes('초과'))).toBe(true)
  })

  test('정원 정보 없으면 보류', () => {
    const r = calculateAssignableCapacity({
      capacityTotal: null,
      joinedMembers: 0,
      pendingInvites: 0,
      internalReservations: 0,
      removalPending: 0,
      unmanagedMembers: 0,
    })
    expect(r.contradictory).toBe(true)
    expect(r.assignable).toBe(0)
  })

  test('제거 대기도 점유로 합산', () => {
    const r = calculateAssignableCapacity({
      capacityTotal: 5,
      adminSeats: 1,
      joinedMembers: 1,
      pendingInvites: 0,
      internalReservations: 0,
      removalPending: 2,
      unmanagedMembers: 0,
    })
    // 1+1+2 = 4, assignable = 1
    expect(r.assignable).toBe(1)
  })

  test('unknownOccupancy 있으면 빈 슬롯으로 간주하지 않음', () => {
    const r = calculateAssignableCapacity({
      capacityTotal: 6,
      adminSeats: 1,
      joinedMembers: 0,
      pendingInvites: 0,
      internalReservations: 0,
      removalPending: 0,
      unmanagedMembers: 0,
      unknownOccupancy: 1,
    })
    expect(r.assignable).toBe(4) // 6 - (1+1) = 4
    expect(r.reasons.some((x) => x.includes('불명'))).toBe(true)
  })

  test('unmanaged 멤버도 점유', () => {
    const r = calculateAssignableCapacity({
      capacityTotal: 6,
      adminSeats: 1,
      joinedMembers: 0,
      pendingInvites: 0,
      internalReservations: 0,
      removalPending: 0,
      unmanagedMembers: 3,
    })
    expect(r.assignable).toBe(2)
  })
})
