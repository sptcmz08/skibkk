export type SlotRangeInput = {
    startTime: string
    endTime: string
}

const parseHour = (time: string) => {
    const hour = Number(time.split(':')[0])
    return Number.isFinite(hour) ? hour : null
}

export function getSlotHourRange(slot: SlotRangeInput) {
    const startHour = parseHour(slot.startTime)
    const rawEndHour = parseHour(slot.endTime)
    if (startHour === null || rawEndHour === null) return null

    let endHour = rawEndHour
    if (endHour === 0 && startHour > 0) endHour = 24
    if (endHour <= startHour) endHour += 24

    return { startHour, endHour }
}

export function expandSlotStartTimes(slot: SlotRangeInput) {
    const range = getSlotHourRange(slot)
    if (!range) return [slot.startTime]

    const times: string[] = []
    for (let hour = range.startHour; hour < range.endHour; hour++) {
        times.push(`${String(hour % 24).padStart(2, '0')}:00`)
    }
    return times.length > 0 ? times : [slot.startTime]
}

export function slotRangesOverlap(left: SlotRangeInput, right: SlotRangeInput) {
    const leftRange = getSlotHourRange(left)
    const rightRange = getSlotHourRange(right)
    if (!leftRange || !rightRange) return left.startTime === right.startTime

    return leftRange.startHour < rightRange.endHour && rightRange.startHour < leftRange.endHour
}

export function normalizeDateOnly(value: Date | string) {
    if (value instanceof Date) return value.toISOString().split('T')[0]
    return value.split('T')[0]
}
