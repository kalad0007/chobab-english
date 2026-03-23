import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET() {
  const cookieStore = await cookies()
  const all = cookieStore.getAll()
  const authCookies = all.filter(c => c.name.includes('auth') || c.name.includes('sb-'))
  return NextResponse.json({
    count: authCookies.length,
    cookies: authCookies.map(c => ({
      name: c.name,
      valueStart: c.value.slice(0, 80),
      length: c.value.length,
    }))
  })
}
