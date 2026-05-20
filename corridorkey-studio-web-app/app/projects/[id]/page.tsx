import { withAuth } from "@workos-inc/authkit-nextjs";
import SignInScreen from "../../components/SignInScreen";
import StudioShell from "../../StudioShell";
import { Id } from "../../../convex/_generated/dataModel";

/**
 * Studio page scoped to a project. Server-gated on the WorkOS session;
 * the projectId in the URL is authoritative and gets passed down to the
 * StudioShell (which re-verifies ownership via Convex).
 */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await withAuth();
  if (!user) return <SignInScreen />;

  const { id } = await params;

  return (
    <StudioShell
      projectId={id as Id<"projects">}
      workosUser={{
        email: user.email,
        name: user.firstName ?? undefined,
        profileImageUrl: user.profilePictureUrl ?? undefined,
      }}
    />
  );
}
