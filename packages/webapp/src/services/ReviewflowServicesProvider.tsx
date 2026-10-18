import { createResourceClientService } from "liwi-resources-client";
import type { ReactNode } from "react";
import { createContext, use, useState } from "react";
import { TransportClientContext } from "react-liwi";
import type {
  AdminService,
  OrgsService,
  PersonalTokensService,
  PrsService,
  RepositoriesService,
  UsersService,
} from "reviewflow-modules";

const createUsersServiceClient = createResourceClientService<UsersService>(
  "users",
  {
    queries: { queryMe: null },
    operations: { getAuthenticatedUser: null, forceSync: null },
  },
);

const createOrgsServiceClient = createResourceClientService<OrgsService>(
  "orgs",
  {
    queries: {
      queryMyOrgs: null,
      queryOrgSettings: null,
      queryMyDmSettings: null,
      queryOrgPersonalTokensPolicy: null,
    },
    operations: {
      setDmSetting: null,
      setTeamSilenced: null,
      forceSync: null,
      setAllowPersonalTokens: null,
    },
  },
);

const createRepositoriesServiceClient =
  createResourceClientService<RepositoriesService>("repositories", {
    queries: { queryAccountRepositories: null, queryRepository: null },
    operations: { syncRepository: null },
  });

const createPrsServiceClient = createResourceClientService<PrsService>("prs", {
  queries: { queryMyPrs: null },
  operations: { startReview: null },
});

const createPersonalTokensServiceClient =
  createResourceClientService<PersonalTokensService>("personalTokens", {
    queries: { queryMyPersonalTokens: null },
    operations: {
      createPersonalToken: null,
      regeneratePersonalToken: null,
      revokePersonalToken: null,
    },
  });

const createAdminServiceClient = createResourceClientService<AdminService>(
  "admin",
  {
    queries: { queryAdminOrgs: null, queryAdminUsers: null },
    operations: { setAccountPaidEnabled: null },
  },
);

interface ReviewflowServices {
  adminService: AdminService;
  usersService: UsersService;
  orgsService: OrgsService;
  repositoriesService: RepositoriesService;
  prsService: PrsService;
  personalTokensService: PersonalTokensService;
}

const ReviewflowServicesContext = createContext<ReviewflowServices | undefined>(
  undefined,
);

export const useReviewflowServices = (): ReviewflowServices => {
  const services = use(ReviewflowServicesContext);
  if (!services) {
    throw new Error("Missing ReviewflowServicesProvider");
  }
  return services;
};

interface ReviewflowServicesProviderProps {
  children: ReactNode;
}

export function ReviewflowServicesProvider({
  children,
}: ReviewflowServicesProviderProps): ReactNode {
  const transportClient = use(TransportClientContext);
  // oxlint-disable-next-line react/hook-use-state -- created once, never replaced
  const [services] = useState<ReviewflowServices>(() => ({
    adminService: createAdminServiceClient(transportClient),
    usersService: createUsersServiceClient(transportClient),
    orgsService: createOrgsServiceClient(transportClient),
    repositoriesService: createRepositoriesServiceClient(transportClient),
    prsService: createPrsServiceClient(transportClient),
    personalTokensService: createPersonalTokensServiceClient(transportClient),
  }));

  return (
    <ReviewflowServicesContext value={services}>
      {children}
    </ReviewflowServicesContext>
  );
}
