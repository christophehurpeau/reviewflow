import {
  ErrorMessage,
  HStack,
  Paragraph,
  Switch,
  Text,
  VStack,
} from "alouette";
import type { ReactNode } from "react";
import { useOperation } from "react-liwi";
import type { OrgTeamSummary } from "reviewflow-modules";
import { useReviewflowServices } from "#/services/ReviewflowServicesProvider.tsx";

interface TeamSilenceListProps {
  orgId: number;
  teams: OrgTeamSummary[];
  silentTeamIds: number[];
}

export function TeamSilenceList({
  orgId,
  teams,
  silentTeamIds,
}: TeamSilenceListProps): ReactNode {
  const { orgsService } = useReviewflowServices();
  const [setTeamSilenced, { error }] = useOperation(
    orgsService.operations.setTeamSilenced,
  );

  if (teams.length === 0) return null;

  return (
    <VStack className="gap-xs">
      {error ? <ErrorMessage>{error.message}</ErrorMessage> : null}
      <Paragraph className="font-body text-sm text-muted">
        Untick to disable notifications for teams you belong to.
      </Paragraph>
      {teams.map((team) => {
        const labelId = `team-${team.id}`;
        return (
          <HStack key={team.id} className="items-center gap-m">
            <Switch
              checked={!silentTeamIds.includes(team.id)}
              aria-labelledby={labelId}
              onValueChange={(value) => {
                setTeamSilenced({
                  orgId,
                  teamId: team.id,
                  silenced: !value,
                }).catch(console.error);
              }}
            />
            <Text nativeID={labelId} className="flex-1 font-body">
              {team.name}
            </Text>
          </HStack>
        );
      })}
    </VStack>
  );
}
