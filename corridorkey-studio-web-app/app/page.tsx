import { withAuth } from "@workos-inc/authkit-nextjs";
import SignInScreen from "./components/SignInScreen";
import DefaultProjectRedirect from "./components/DefaultProjectRedirect";

/**
 * Root route. Server-gates on WorkOS; if signed in, hands off to the
 * client DefaultProjectRedirect which resolves the user's project and
 * replaces the URL with /projects/<id>.
 */
export default async function Home() {
  const { user } = await withAuth();
  if (!user) return <SignInScreen />;

  return (
    <DefaultProjectRedirect
      workosUser={{
        email: user.email,
        name: user.firstName ?? undefined,
        profileImageUrl: user.profilePictureUrl ?? undefined,
      }}
    />
  );
}
