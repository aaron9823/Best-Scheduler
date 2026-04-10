"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase"

export default function LoginPage() {
  const router = useRouter()
  const [employeeCode, setEmployeeCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()
    const code = employeeCode.trim().toUpperCase()

    try {
      // users 테이블에서 직원 코드 조회
      const { data: user, error: dbError } = await supabase
        .from("users")
        .select("id, name, employee_code")
        .eq("employee_code", code)
        .maybeSingle()

      if (dbError) {
        setError("서버 오류가 발생했습니다. 다시 시도해 주세요.")
        return
      }

      if (!user) {
        setError("존재하지 않는 직원 코드입니다.")
        return
      }

      alert(`✅ 로그인 성공!\n\n이름: ${user.name}\n직원 코드: ${user.employee_code}`)
      sessionStorage.setItem("loggedInUser", JSON.stringify(user))
      router.push("/dashboard")
    } catch {
      setError("알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">
            SyncTeam
          </CardTitle>
          <CardDescription>
            부여받은 직원 코드를 입력하고 시작하세요.
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="employee-code">직원 코드</Label>
              <Input
                id="employee-code"
                placeholder="예: EMP-001"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                required
                disabled={isLoading}
                className="text-center text-lg uppercase"
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full text-lg h-12" disabled={isLoading}>
              {isLoading ? "처리 중..." : "로그인 / 시작하기"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}