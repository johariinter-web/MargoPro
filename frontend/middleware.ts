import { NextResponse, type NextRequest } from 'next/server';

// Auth enforcement désactivé pendant la phase bêta.
// Le middleware est prêt — réactiver quand les comptes utilisateurs seront lancés.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
};
