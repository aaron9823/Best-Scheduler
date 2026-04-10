"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { cn } from "@/lib/utils"

type LoggedInUser = {
  id: string
  name: string
  employee_code: string
}

type ScheduleItem = {
  id: string
  title: string
  start_time: string
  end_time: string
}

const APP_TIMEZONE = "America/New_York"
const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

function dateKeyInTimeZone(value: string | Date, timeZone: string) {
  const date = typeof value === "string" ? new Date(value) : value
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" })
}

function formatDayNumber(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    day: "2-digit",
    timeZone: APP_TIMEZONE,
  })
}

function formatWeekday(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: APP_TIMEZONE,
  })
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  })
}

function buildCalendarDays(baseDate: Date) {
  const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
  const lastDay = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0)

  const days: { date: Date; currentMonth: boolean }[] = []

  for (let i = firstDay.getDay(); i > 0; i -= 1) {
    days.push({
      date: new Date(baseDate.getFullYear(), baseDate.getMonth(), 1 - i),
      currentMonth: false,
    })
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push({ date: new Date(baseDate.getFullYear(), baseDate.getMonth(), day), currentMonth: true })
  }

  const trailing = (7 - (days.length % 7)) % 7
  for (let i = 1; i <= trailing; i += 1) {
    days.push({
      date: new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, i),
      currentMonth: false,
    })
  }

  return days
}

export default function CalendarPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [user, setUser] = useState<LoggedInUser | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allSchedules, setAllSchedules] = useState<ScheduleItem[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [monthCursor, setMonthCursor] = useState(new Date())
  const [monthAnimClass, setMonthAnimClass] = useState<string>("")
  const [listEndSpacerHeight, setListEndSpacerHeight] = useState(200)
  const [pendingScrollDateKey, setPendingScrollDateKey] = useState<string | null>(null)
  const hasInitialAutoScrolledRef = useRef(false)
  const listContainerRef = useRef<HTMLDivElement | null>(null)
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    const raw = window.sessionStorage.getItem("loggedInUser")

    if (!raw) {
      setUser(null)
      setIsReady(true)
      return
    }

    try {
      setUser(JSON.parse(raw) as LoggedInUser)
    } catch {
      setUser(null)
    } finally {
      setIsReady(true)
    }
  }, [])

  useEffect(() => {
    if (!isReady) {
      return
    }

    if (!user) {
      router.replace("/")
      return
    }

    const fetchSchedules = async () => {
      setLoading(true)
      setError(null)

      const { data, error: scheduleError } = await supabase
        .from("schedules")
        .select("id, title, start_time, end_time")
        .eq("creator_id", user.id)
        .order("start_time", { ascending: true })

      if (scheduleError) {
        setError("일정을 불러오지 못했습니다.")
        setLoading(false)
        return
      }

      setAllSchedules(data ?? [])
      setLoading(false)
    }

    fetchSchedules()
  }, [isReady, router, supabase, user])

  const selectedDateKey = useMemo(
    () => dateKeyInTimeZone(selectedDate, APP_TIMEZONE),
    [selectedDate],
  )

  const todayKey = useMemo(() => dateKeyInTimeZone(new Date(), APP_TIMEZONE), [])

  const groupedSchedules = useMemo(() => {
    const groups: Array<{ dateKey: string; items: ScheduleItem[] }> = []

    for (const schedule of allSchedules) {
      const key = dateKeyInTimeZone(schedule.start_time, APP_TIMEZONE)
      const lastGroup = groups[groups.length - 1]

      if (!lastGroup || lastGroup.dateKey !== key) {
        groups.push({ dateKey: key, items: [schedule] })
      } else {
        lastGroup.items.push(schedule)
      }
    }

    return groups
  }, [allSchedules])

  const scheduleDateKeys = useMemo(() => {
    return new Set(allSchedules.map((schedule) => dateKeyInTimeZone(schedule.start_time, APP_TIMEZONE)))
  }, [allSchedules])

  const days = useMemo(() => buildCalendarDays(monthCursor), [monthCursor])
  const calendarWeekCount = useMemo(() => Math.ceil(days.length / 7), [days])
  const calendarSectionHeight = useMemo(() => {
    const baseHeight = 92
    const rowHeight = 35
    return baseHeight + calendarWeekCount * rowHeight
  }, [calendarWeekCount])

  useEffect(() => {
    const container = listContainerRef.current
    if (!container) {
      return
    }

    const updateSpacer = () => {
      // Keep generous tail room so the last date-group can always align to top.
      const next = Math.max(520, Math.round(container.clientHeight * 1.6))
      setListEndSpacerHeight(next)
    }

    updateSpacer()

    const observer = new ResizeObserver(() => updateSpacer())
    observer.observe(container)

    return () => observer.disconnect()
  }, [groupedSchedules.length])

  const scrollToDateGroup = useCallback((dateKey: string) => {
    const target = groupRefs.current[dateKey]
    const container = listContainerRef.current

    if (!target || !container) {
      return
    }

    const containerRect = container.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const relativeTop = targetRect.top - containerRect.top
    const top = Math.max(0, container.scrollTop + relativeTop)
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight)
    const clampedTop = Math.min(top, maxTop)

    container.scrollTo({
      top: clampedTop,
      behavior: "smooth",
    })
  }, [])

  const applyMonthTransition = useCallback((nextMonthFirst: Date) => {
    const currentIndex = monthCursor.getFullYear() * 12 + monthCursor.getMonth()
    const nextIndex = nextMonthFirst.getFullYear() * 12 + nextMonthFirst.getMonth()

    if (nextIndex !== currentIndex) {
      setMonthAnimClass(nextIndex > currentIndex ? "calendar-month-enter-next" : "calendar-month-enter-prev")
    }

    setMonthCursor(nextMonthFirst)
  }, [monthCursor])

  const changeMonth = useCallback((offset: number) => {
    applyMonthTransition(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + offset, 1))
  }, [applyMonthTransition, monthCursor])

  useEffect(() => {
    if (!monthAnimClass) {
      return
    }

    const timer = window.setTimeout(() => {
      setMonthAnimClass("")
    }, 230)

    return () => window.clearTimeout(timer)
  }, [monthAnimClass])

  useEffect(() => {
    if (!pendingScrollDateKey || loading) {
      return
    }

    let raf1 = 0
    let raf2 = 0

    const run = () => {
      scrollToDateGroup(pendingScrollDateKey)
      setPendingScrollDateKey(null)
    }

    // Wait until layout settles (month change, dynamic height, list render).
    raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(run)
    })

    return () => {
      window.cancelAnimationFrame(raf1)
      window.cancelAnimationFrame(raf2)
    }
  }, [pendingScrollDateKey, loading, scrollToDateGroup, calendarSectionHeight, listEndSpacerHeight])

  useEffect(() => {
    if (loading || hasInitialAutoScrolledRef.current) {
      return
    }

    const hasTodayGroup = groupedSchedules.some((group) => group.dateKey === todayKey)
    hasInitialAutoScrolledRef.current = true

    if (!hasTodayGroup) {
      return
    }

    setSelectedDate(new Date())
    setPendingScrollDateKey(todayKey)
  }, [loading, groupedSchedules, todayKey])

  if (!isReady) {
    return (
      <div className="min-h-screen bg-zinc-50 px-0 pt-3 pb-24 text-zinc-900">
        <div className="px-3 py-6 text-sm text-zinc-500">로딩 중...</div>
        <MobileBottomNav />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="h-[100dvh] overflow-hidden bg-white px-0 pt-3 pb-24 text-zinc-900">
      <div className="mx-auto flex h-full max-w-3xl flex-col">
        <div className="flex items-center justify-between border-b border-zinc-200 px-3 pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
              aria-label="뒤로가기"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <p className="text-lg font-semibold tracking-tight">Calendar</p>
          </div>

          <button
            type="button"
            onClick={() => router.push(`/calendar/new?date=${selectedDateKey}`)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 text-zinc-700 hover:bg-zinc-100"
            aria-label="일정 추가"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <section
          className="shrink-0 overflow-hidden bg-white px-3 py-3"
          style={{ height: `${calendarSectionHeight}px` }}
        >
          <div className={cn("space-y-2.5", monthAnimClass)}>
            <div className="flex items-center justify-between">
              <Button
                size="icon"
                variant="ghost"
                className="text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <p className="text-lg font-semibold tracking-wide">{formatMonthYear(monthCursor)}</p>
              <Button
                size="icon"
                variant="ghost"
                className="text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                onClick={() => changeMonth(1)}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] text-zinc-500">
              {WEEKDAY_LABELS.map((day) => (
                <p key={day}>{day}</p>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1">
              {days.map(({ date, currentMonth }) => {
                const key = dateKeyInTimeZone(date, APP_TIMEZONE)
                const isSelected = key === selectedDateKey
                const hasSchedule = scheduleDateKeys.has(key)
                const isToday = key === todayKey

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setSelectedDate(date)
                      if (!currentMonth) {
                        applyMonthTransition(new Date(date.getFullYear(), date.getMonth(), 1))
                      }
                      setPendingScrollDateKey(key)
                    }}
                    className={cn(
                      "relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors",
                      currentMonth ? "text-zinc-900" : "text-zinc-400",
                      isToday && "ring-1 ring-blue-400/50",
                      isSelected && "bg-blue-500 text-white",
                    )}
                  >
                    <span>{date.getDate()}</span>
                    {hasSchedule && !isSelected && <span className="absolute mt-7 h-1 w-1 rounded-full bg-blue-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        <div className="border-y border-zinc-200 bg-zinc-100 px-3 py-px text-[11px] font-medium text-zinc-500">
          전체 일정
        </div>

        <section ref={listContainerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white px-3 pb-3">
          <div>
            {loading && <p className="text-sm text-zinc-500">일정을 불러오는 중...</p>}
            {!loading && error && <p className="text-sm text-red-400">{error}</p>}
            {!loading && !error && groupedSchedules.length === 0 && (
              <p className="text-sm text-zinc-500">등록된 일정이 없습니다.</p>
            )}
            {!loading && !error && groupedSchedules.map((group, groupIndex) => (
              <div
                key={group.dateKey}
                ref={(el) => {
                  groupRefs.current[group.dateKey] = el
                }}
                className={cn(groupIndex === 0 ? "pt-0 pb-2.5" : "pb-2.5")}
              >
                <div className="mb-2 w-[calc(100%+0.75rem)] border-t border-zinc-200" />
                <div className="flex gap-3">
                  <div className="w-10 shrink-0 text-center">
                    <p className="text-3xl font-medium leading-none text-zinc-700">
                      {formatDayNumber(group.items[0].start_time)}
                    </p>
                    <p className="mt-1 text-xs uppercase text-zinc-500">{formatWeekday(group.items[0].start_time)}</p>
                  </div>

                  <div className="min-w-0 flex-1 space-y-3 pt-1">
                    {group.items.map((schedule, itemIndex) => (
                      <div key={schedule.id} className="space-y-1">
                        {itemIndex > 0 && <div className="mb-2 w-[calc(100%+0.75rem)] border-t border-zinc-200" />}
                        <p className="text-[16px] font-medium leading-snug text-zinc-900">{schedule.title}</p>
                        <p className="text-xs text-zinc-600">{formatTime(schedule.start_time)}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {groupIndex === groupedSchedules.length - 1 && (
                  <div className="mt-2 w-[calc(100%+0.75rem)] border-t border-zinc-200" />
                )}
              </div>
            ))}

            {/* Extra tail room allows the last group to scroll up under the gray bar. */}
            {!loading && !error && groupedSchedules.length > 0 && <div style={{ height: `${listEndSpacerHeight}px` }} />}
          </div>
        </section>
      </div>
      <MobileBottomNav />
    </div>
  )
}
