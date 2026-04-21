import { withAuth } from "@workos-inc/authkit-nextjs";
import SignInScreen from "./components/SignInScreen";
import ProjectsPane from "./components/ProjectsPane";

/**
 * Root route = the projects pane. Replaces the old splash-then-redirect
 * flow — users always land here and explicitly pick or create a project
 * to enter the studio.
 */
export default async function Home() {
  const { user } = await withAuth();
  if (!user) return <SignInScreen />;

  return (
    <ProjectsPane
      workosUser={{
        email: user.email,
        name: user.firstName ?? undefined,
        profileImageUrl: user.profilePictureUrl ?? undefined,
      }}
    />
  );
}
