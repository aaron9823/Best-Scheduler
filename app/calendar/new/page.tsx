"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase"

type LoggedInUser = {
  id: string
  name: string
  employee_code: string
}

const APP_TIMEZONE = "America/New_York"

function toDateTimeInTimeZone(dateText: string, timeText: string) {
  const [year, month, day] = dateText.split("-").map(Number)
  const [hour, minute] = timeText.split(":").map(Number)

  // Build local wall time first then convert to an ISO instant.
  const local = new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0)

  // Convert local date parts into target timezone parts and back to Date for stable UTC storage.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  const parts = Object.fromEntries(formatter.formatToParts(local).map((p) => [p.type, p.value]))

  return new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  ).toISOString()
}

function formatSelectedDate(dateText: string) {
  const date = new Date(`${dateText}T00:00:00`)
  return date.toLocaleDateString("ko-KR", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  })
}

function NewSchedulePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const selectedDate = useMemo(() => {
    const value = searchParams.get("date")
    if (!value) {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, "0")
      const d = String(now.getDate()).padStart(2, "0")
      return `${y}-${m}-${d}`
    }

    return value
  }, [searchParams])

  const [title, setTitle] = useState("")
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("10:00")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const raw = window.sessionStorage.getItem("loggedInUser")
    if (!raw) {
      router.replace("/")
      return
    }

    let user: LoggedInUser | null = null
    try {
      user = JSON.parse(raw) as LoggedInUser
    } catch {
      user = null
    }

    if (!user) {
      router.replace("/")
      return
    }

    if (!title.trim()) {
      setError("일정 제목을 입력해 주세요.")
      return
    }

    if (startTime >= endTime) {
      setError("종료 시간은 시작 시간보다 늦어야 합니다.")
      return
    }

    setIsSaving(true)

    const supabase = createClient()
    const startISO = toDateTimeInTimeZone(selectedDate, startTime)
    const endISO = toDateTimeInTimeZone(selectedDate, endTime)

    const { error: insertError } = await supabase.from("schedules").insert({
      title: title.trim(),
      start_time: startISO,
      end_time: endISO,
      creator_id: user.id,
    })

    setIsSaving(false)

    if (insertError) {
      setError("일정 저장에 실패했습니다. 다시 시도해 주세요.")
      return
    }

    router.replace("/calendar")
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-3 pt-3 pb-24 text-zinc-900">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-700 hover:bg-zinc-100"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <p className="text-lg font-semibold tracking-tight">스케줄 추가</p>
        </div>

        <Card className="rounded-none border-0 bg-white shadow-none">
          <CardHeader className="px-0 pb-2">
            <CardTitle className="text-base">선택한 날짜</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              {formatSelectedDate(selectedDate)}
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleCreate} className="space-y-4">
          <Card className="rounded-none border-0 bg-white shadow-none">
            <CardContent className="space-y-4 px-0 pt-0">
              <div className="space-y-2">
                <Label htmlFor="title">일정 제목</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 설치 일정"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="start-time">시작 시간</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-time">종료 시간</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
            </CardContent>
          </Card>

          <Button type="submit" className="h-11 w-full" disabled={isSaving}>
            {isSaving ? "저장 중..." : "스케줄 저장"}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function NewSchedulePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <NewSchedulePageContent />
    </Suspense>
  )
}
