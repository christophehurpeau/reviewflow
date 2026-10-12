import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { UserScreen } from "#/sections/user/UserScreen.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

export default function UserPage(): ReactNode {
  const { usersService, personalTokensService } = useReviewflowServices();
  const me = useResource(usersService.queries.queryMe, { subscribe: true }, []);
  const personalTokens = useResource(
    personalTokensService.queries.queryMyPersonalTokens,
    { subscribe: true },
    [],
  );

  return (
    <UserScreen
      me={me}
      personalTokens={personalTokens}
      onForceSync={() => usersService.operations.forceSync()}
      onCreatePersonalToken={(name) =>
        personalTokensService.operations.createPersonalToken({ name })
      }
      onRegeneratePersonalToken={(tokenId) =>
        personalTokensService.operations.regeneratePersonalToken({ tokenId })
      }
      onRevokePersonalToken={(tokenId) =>
        personalTokensService.operations.revokePersonalToken({ tokenId })
      }
    />
  );
}
