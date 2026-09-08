import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { UserScreen } from "#/sections/user/UserScreen.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

export default function UserPage(): ReactNode {
  const { usersService } = useReviewflowServices();
  const me = useResource(usersService.queries.queryMe, { subscribe: true }, []);

  return (
    <UserScreen
      me={me}
      onForceSync={() => usersService.operations.forceSync()}
    />
  );
}
