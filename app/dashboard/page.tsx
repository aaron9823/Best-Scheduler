"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { createClient } from "@/lib/supabase"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"

type LoggedInUser = {
  id: string
  name: string
  employee_code: string
}

type TodaySchedule = {
  id: string
  title: string
  start_time: string
  end_time: string
}

const APP_TIMEZONE = "America/New_York"

function dateKeyInTimeZone(value: string | Date, timeZone: string) {
  const date = typeof value === "string" ? new Date(value) : value
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  return formatter.format(date)
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  })
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

function isSameLocalDate(dateText: string, targetDate: Date) {
  return dateKeyInTimeZone(dateText, APP_TIMEZONE) === dateKeyInTimeZone(targetDate, APP_TIMEZONE)
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [user, setUser] = useState<LoggedInUser | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [schedules, setSchedules] = useState<TodaySchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
        timeZone: APP_TIMEZONE,
      }).format(new Date()),
    [],
  )

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

    const fetchTodaySchedules = async () => {
      setLoading(true)
      setError(null)

      const { data, error: scheduleError } = await supabase
        .from("schedules")
        .select("id, title, start_time, end_time")
        .eq("creator_id", user.id)
        .order("start_time", { ascending: true })

      if (scheduleError) {
        setError("오늘 일정을 불러오지 못했습니다.")
        setLoading(false)
        return
      }

      const today = new Date()
      const todaySchedules = (data ?? []).filter((schedule) => isSameLocalDate(schedule.start_time, today))
      setSchedules(todaySchedules)
      setLoading(false)
    }

    fetchTodaySchedules()
  }, [isReady, router, supabase, user])

  if (!isReady) {
    return (
      <div className="min-h-screen bg-zinc-50 p-4 pb-28 text-zinc-900 md:p-8 md:pb-28">
        <div className="mx-auto max-w-3xl space-y-4">
          <Card className="border-zinc-200 bg-white shadow-sm">
            <CardContent className="py-6 text-sm text-zinc-500">로딩 중...</CardContent>
          </Card>
        </div>
        <button
          type="button"
          className="fixed bottom-24 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/40"
          aria-label="새 일정 추가"
        >
          <Plus className="h-6 w-6" />
        </button>
        <MobileBottomNav />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-4 pb-28 text-zinc-900 md:p-8 md:pb-28">
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="border-zinc-200 bg-white shadow-sm">
          <CardContent className="p-2.5">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Today</p>
                <h1 className="mt-0.5 text-lg font-semibold tracking-tight">오늘의 스케줄</h1>
                <p className="text-[11px] text-zinc-500">{todayLabel}</p>
              </div>

              <div className="ml-auto flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-semibold text-white">
                  {(user.name?.trim().charAt(0) || "U").toUpperCase()}
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium text-zinc-900">{user.name}</p>
                  <p className="text-[11px] text-zinc-500">{user.employee_code}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 bg-white shadow-sm">
          <CardContent className="space-y-3 pt-6">
            {loading && <p className="text-sm text-zinc-500">일정을 불러오는 중...</p>}
            {!loading && error && <p className="text-sm text-red-400">{error}</p>}
            {!loading && !error && schedules.length === 0 && (
              <p className="text-sm text-zinc-500">오늘 등록된 일정이 없습니다.</p>
            )}
            {!loading && !error && schedules.map((schedule) => (
              <div key={schedule.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex w-12 shrink-0 flex-col items-center text-zinc-700">
                    <span className="text-3xl font-semibold leading-none">{formatDayNumber(schedule.start_time)}</span>
                    <span className="mt-1 text-xs uppercase text-zinc-500">{formatWeekday(schedule.start_time)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug text-zinc-900">{schedule.title}</p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <button
        type="button"
        className="fixed bottom-24 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg shadow-blue-500/40"
        aria-label="새 일정 추가"
      >
        <Plus className="h-6 w-6" />
      </button>
      <MobileBottomNav />
    </div>
  )
}
