import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has('auth_token');
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname);
  if (request.nextUrl.pathname.startsWith('/admin')) {
    loginUrl.searchParams.set('role', 'admin');
  }

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/client/:path*', '/admin/:path*'],
};
