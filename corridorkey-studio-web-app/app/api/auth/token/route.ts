import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

/**
 * Returns the current WorkOS access token (or null) for the Convex React
 * client's `fetchAccessToken` bridge. The token lives in an HTTP-only cookie,
 * so the client can't read it directly.
 */
export async function GET() {
  const { accessToken } = await withAuth();
  return NextResponse.json({ token: accessToken ?? null });
}
