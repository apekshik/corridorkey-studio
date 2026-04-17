import { authkitProxy } from "@workos-inc/authkit-nextjs";

export default authkitProxy();

// Explicitly include api routes — kubrik-ai-2's pattern. Next.js's negative
// lookahead alone wasn't reliably hydrating `withAuth()` on /api/* routes.
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
