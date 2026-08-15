import { createResourceClientService } from "liwi-resources-client";
import type { ReactNode } from "react";
import { createContext, use, useState } from "react";
import { TransportClientContext } from "react-liwi";
import type {
  OrgsService,
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
    },
    operations: { setDmSetting: null, setTeamSilenced: null, forceSync: null },
  },
);

const createRepositoriesServiceClient =
  createResourceClientService<RepositoriesService>("repositories", {
    queries: { queryAccountRepositories: null, queryRepository: null },
    operations: { syncRepository: null },
  });

const createPrsServiceClient = createResourceClientService<PrsService>("prs", {
  queries: { queryMyPrs: null },
  operations: {},
});

interface ReviewflowServices {
  usersService: UsersService;
  orgsService: OrgsService;
  repositoriesService: RepositoriesService;
  prsService: PrsService;
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
  const [services] = useState<ReviewflowServices>(() => ({
    usersService: createUsersServiceClient(transportClient),
    orgsService: createOrgsServiceClient(transportClient),
    repositoriesService: createRepositoriesServiceClient(transportClient),
    prsService: createPrsServiceClient(transportClient),
  }));

  return (
    <ReviewflowServicesContext value={services}>
      {children}
    </ReviewflowServicesContext>
  );
}
