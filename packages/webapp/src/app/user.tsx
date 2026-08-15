import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { UserScreen } from "#/sections/user/UserScreen.tsx";
import { useAuthenticatedUser } from "#/services/AuthenticatedUserProvider.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

export default function UserPage(): ReactNode {
  const router = useRouter();
  const user = useAuthenticatedUser();
  const { usersService } = useReviewflowServices();
  const me = useResource(usersService.queries.queryMe, { subscribe: true }, []);

  return (
    <UserScreen
      userLogin={user.login}
      me={me}
      onBack={() => {
        router.navigate("/settings");
      }}
      onForceSync={() => usersService.operations.forceSync()}
    />
  );
}
