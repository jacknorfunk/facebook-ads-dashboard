import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    // Allow access to public paths
    if (req.nextUrl.pathname.startsWith('/api/auth') || 
        req.nextUrl.pathname === '/login' ||
        req.nextUrl.pathname.startsWith('/_next') ||
        req.nextUrl.pathname.startsWith('/favicon')) {
      return NextResponse.next()
    }

    // Check if user is authenticated
    if (!req.nextauth.token) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to login and API auth routes
        if (req.nextUrl.pathname === '/login' || 
            req.nextUrl.pathname.startsWith('/api/auth')) {
          return true
        }
        // For all other routes, require authentication
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth.js API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|public).*)',
  ],
}