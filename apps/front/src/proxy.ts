import { NextResponse } from 'next/server';

// middleware
export default function proxy(request: NextResponse<Response>) {
  // Proxy logic
  console.log('request', request);

  return NextResponse.next();
}
// export const config = {
//   // matcher: ['/about/:path*', '/dashboard/:path*'],
// };
