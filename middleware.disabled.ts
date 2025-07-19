// middleware.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const SECRET = process.env.NEXTAUTH_SECRET!

export async function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname

  // PUBLIC (login, register, marketing, etc) → always allowed
  // PROTECTED DASHBOARD → must have token
  if (p.startsWith("/dashboard")) {
    const token = await getToken({ req, secret: SECRET, salt: SECRET })
    if (!token) return NextResponse.redirect("/login")
  }

  // ADMIN → must be token + role
  if (p.startsWith("/admin")) {
    const token = await getToken({ req, secret: SECRET, salt: SECRET })
    if (!token)             return NextResponse.redirect("/login")
    if (token.role !== "ADMIN") 
                            return NextResponse.redirect("/dashboard")
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
}
