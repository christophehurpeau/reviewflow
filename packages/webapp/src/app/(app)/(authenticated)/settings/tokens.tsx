import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { useResource } from "react-liwi";
import { ApiTokensScreen } from "#/sections/settings/ApiTokensScreen.tsx";
import { useAuthenticatedUser } from "#/services/AuthenticatedUserProvider.tsx";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

export default function ApiTokensPage(): ReactNode {
  const router = useRouter();
  const user = useAuthenticatedUser();
  const { orgsService, personalTokensService, usersService } =
    useReviewflowServices();

  const me = useResource(usersService.queries.queryMe, { subscribe: true }, []);
  const personalTokens = useResource(
    personalTokensService.queries.queryMyPersonalTokens,
    { subscribe: true },
    [],
  );
  const orgs = useResource(
    orgsService.queries.queryMyOrgs,
    { subscribe: true },
    [],
  );

  return (
    <ApiTokensScreen
      userLogin={user.login}
      me={me}
      personalTokens={personalTokens}
      orgs={orgs}
      onBack={() => {
        router.navigate("/settings");
      }}
      onCreate={(name) =>
        personalTokensService.operations.createPersonalToken({ name })
      }
      onRegenerate={(tokenId) =>
        personalTokensService.operations.regeneratePersonalToken({ tokenId })
      }
      onRevoke={(tokenId) =>
        personalTokensService.operations.revokePersonalToken({ tokenId })
      }
    />
  );
}
