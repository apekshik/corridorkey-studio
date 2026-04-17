import { withAuth } from "@workos-inc/authkit-nextjs";
import StudioShell from "./StudioShell";
import SignInScreen from "./components/SignInScreen";

export default async function Home() {
  const { user } = await withAuth();

  if (!user) {
    return <SignInScreen />;
  }

  return (
    <StudioShell
      workosUser={{
        email: user.email,
        name: user.firstName ?? undefined,
        profileImageUrl: user.profilePictureUrl ?? undefined,
      }}
    />
  );
}
