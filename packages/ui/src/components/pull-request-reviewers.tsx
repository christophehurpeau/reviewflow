import type {
  PullRequestCandidatesResponse,
  PullRequestDetail,
  PullRequestEdit,
  PullRequestReviewState,
} from "@reviewflow/sdk";
import type { Accent } from "alouette";
import {
  Badge,
  Checkbox,
  CheckboxGroup,
  ErrorMessage,
  FormEditableSection,
  FormField,
  IconButton,
  Tab,
  Tabs,
  Text,
  View,
} from "alouette";
import { ArrowClockwiseRegularIcon } from "alouette-icons/phosphor-icons/ArrowClockwise";
import type { ReactNode } from "react";
import { useState } from "react";
import { errorToMessage } from "../services/errorToMessage.ts";
import type { PullRequestActionProps } from "./pull-request-actions-review.tsx";
import { PersonAvatar } from "./pull-request-conversation-person.tsx";
import { ReadOnlySection } from "./pull-request-read-only-section.tsx";
import { CenteredBadge } from "./pull-request-status-line.tsx";

const reviewStateLabel = (state: PullRequestReviewState): string => {
  switch (state) {
    case "approved":
      return "approved";
    case "changesRequested":
      return "changes requested";
    case "commented":
      return "commented";
    case "dismissed":
      return "dismissed";
    case "pending":
      return "pending";
    default: {
      const unlabelled: never = state;
      return unlabelled;
    }
  }
};

const reviewStateAccent = (state: PullRequestReviewState): Accent => {
  if (state === "approved") return "success";
  if (state === "changesRequested") return "danger";
  return "info";
};

const userValue = (login: string): string => `user:${login}`;
const teamValue = (slug: string): string => `team:${slug}`;

const requestedValues = (pullRequest: PullRequestDetail): string[] =>
  pullRequest.requestedReviewers.map((reviewer) =>
    reviewer.kind === "user"
      ? userValue(reviewer.login)
      : teamValue(reviewer.slug),
  );

/** What the selection changed, in the request's terms. */
const reviewersEdit = (
  pullRequest: PullRequestDetail,
  selected: string[],
): PullRequestEdit => {
  const before = new Set(requestedValues(pullRequest));
  const after = new Set(selected);
  const added = selected.filter((value) => !before.has(value));
  const removed = [...before].filter((value) => !after.has(value));
  const names = (values: string[], prefix: string): string[] =>
    values
      .filter((value) => value.startsWith(prefix))
      .map((value) => value.slice(prefix.length));

  return {
    kind: "reviewers",
    add: names(added, "user:"),
    remove: names(removed, "user:"),
    addTeams: names(added, "team:"),
    removeTeams: names(removed, "team:"),
  };
};

interface ReviewerLineProps {
  name: string;
  avatarUrl: string | null;
  /** null: asked, not answered yet — or asked again since */
  state: PullRequestReviewState | null;
  /** asks the reviewer again; absent where the gesture is not offered */
  onRerequest?: () => Promise<void>;
}

function RerequestButton({
  name,
  onRerequest,
}: {
  name: string;
  onRerequest: () => Promise<void>;
}): ReactNode {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <>
      <IconButton
        icon={<ArrowClockwiseRegularIcon />}
        aria-label={`Re-request a review from ${name}`}
        variant="soft"
        size="sm"
        disabled={pending}
        onPress={() => {
          setPending(true);
          setError(null);
          onRerequest()
            .catch((error_: unknown) => {
              setError(errorToMessage(error_));
            })
            .finally(() => {
              setPending(false);
            });
        }}
      />
      {error === null ? null : (
        <View className="basis-full">
          <ErrorMessage>{error}</ErrorMessage>
        </View>
      )}
    </>
  );
}

function ReviewerLine({
  name,
  avatarUrl,
  state,
  onRerequest,
}: ReviewerLineProps): ReactNode {
  return (
    <View className="flex-row flex-wrap items-center gap-xs">
      <PersonAvatar person={{ login: name, avatarUrl }} />
      <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>
        {name}
      </Text>
      <CenteredBadge>
        {state === null ? (
          <Badge accent="warning" size="sm">
            awaiting
          </Badge>
        ) : (
          <Badge accent={reviewStateAccent(state)} size="sm">
            {reviewStateLabel(state)}
          </Badge>
        )}
      </CenteredBadge>
      {onRerequest === undefined ? null : (
        <RerequestButton name={name} onRerequest={onRerequest} />
      )}
    </View>
  );
}

interface ReviewersProps extends PullRequestActionProps {
  /** what the editor offers; null until GitHub answered, the list read-only */
  candidates: PullRequestCandidatesResponse | null;
}

/**
 * GitHub's reviewers list: each person once — awaiting when asked (again),
 * else their latest review — teams as asked.
 */
function ReviewersSummary({
  detail,
  candidates,
  onEdit,
}: ReviewersProps): ReactNode {
  const { pullRequest, viewer } = detail;
  // a review carries only a login: its avatar is the candidate lists'
  const avatarOf = (login: string): string | null =>
    [
      ...(candidates?.suggestedReviewers ?? []),
      ...(candidates?.reviewerCandidates ?? []),
      ...(candidates?.assigneeCandidates ?? []),
    ].find((person) => person.login === login)?.avatarUrl ?? null;
  const requestedLogins = new Set(
    pullRequest.requestedReviewers.flatMap((reviewer) =>
      reviewer.kind === "user" ? [reviewer.login] : [],
    ),
  );
  const answered = pullRequest.reviews.filter(
    (review) => !requestedLogins.has(review.author),
  );
  if (pullRequest.requestedReviewers.length === 0 && answered.length === 0) {
    return <Text className="text-sm text-muted">No reviews</Text>;
  }

  return (
    <View className="gap-xxs">
      {answered.map((review) => (
        <ReviewerLine
          key={review.author}
          name={review.author}
          avatarUrl={avatarOf(review.author)}
          state={review.state}
          onRerequest={
            pullRequest.viewerCanUpdate &&
            review.author !== viewer &&
            pullRequest.state !== "merged"
              ? async () => {
                  await onEdit({
                    kind: "reviewers",
                    add: [review.author],
                    remove: [],
                    addTeams: [],
                    removeTeams: [],
                  });
                }
              : undefined
          }
        />
      ))}
      {pullRequest.requestedReviewers.map((reviewer) =>
        reviewer.kind === "user" ? (
          <ReviewerLine
            key={userValue(reviewer.login)}
            name={reviewer.login}
            avatarUrl={reviewer.avatarUrl}
            state={null}
          />
        ) : (
          <ReviewerLine
            key={teamValue(reviewer.slug)}
            name={reviewer.name}
            avatarUrl={null}
            state={null}
          />
        ),
      )}
    </View>
  );
}

interface ReviewersValues {
  members: string[];
  teams: string[];
}

/** Past this many people, the groups are tabs rather than stacked. */
const maxStackedReviewers = 5;

type ReviewerGroup = "members" | "teams";

const isReviewerGroup = (value: string): value is ReviewerGroup =>
  value === "members" || value === "teams";

interface ReviewerGroupsProps {
  tabbed: boolean;
  /** each group's field, null when it offers no one */
  members: ReactNode;
  teams: ReactNode;
}

function ReviewerGroups({
  tabbed,
  members,
  teams,
}: ReviewerGroupsProps): ReactNode {
  const [tab, setTab] = useState<ReviewerGroup>(() =>
    members === null ? "teams" : "members",
  );

  if (!tabbed) {
    return (
      <View className="gap-m">
        {members}
        {teams}
      </View>
    );
  }

  return (
    <View className="gap-m">
      <Tabs
        aria-label="Reviewer groups"
        value={tab}
        onValueChange={(next) => {
          if (isReviewerGroup(next)) setTab(next);
        }}
      >
        {members === null ? null : <Tab value="members" label="Members" />}
        {teams === null ? null : <Tab value="teams" label="Teams" />}
      </Tabs>
      {tab === "members" ? members : teams}
    </View>
  );
}

interface MemberCheckboxesProps {
  title: string | null;
  logins: string[];
}

function MemberCheckboxes({ title, logins }: MemberCheckboxesProps): ReactNode {
  if (logins.length === 0) return null;
  return (
    <View className="gap-xxs">
      {title === null ? null : (
        <Text className="font-body-bold text-xs text-muted">{title}</Text>
      )}
      {logins.map((login) => (
        <Checkbox key={login} value={userValue(login)} label={login} />
      ))}
    </View>
  );
}

/**
 * The reviewers section: who was asked and what each answered, re-request
 * beside an answered review, and an editor to ask or unask — offered only when
 * GitHub lets the viewer and the candidates were read. Every gesture is one
 * `reviewers` edit through `onEdit`.
 *
 * Members: GitHub's suggestions grouped first, then anyone else already asked,
 * then the repository's assignable users; those already asked lead each group.
 * Teams: those already asked, then the rest.
 */
export function Reviewers({
  detail,
  candidates,
  onEdit,
}: ReviewersProps): ReactNode {
  const { pullRequest } = detail;
  const suggestedLogins = (candidates?.suggestedReviewers ?? []).map(
    ({ login }) => login,
  );
  const reviewerCandidates = candidates?.reviewerCandidates ?? [];
  const teamCandidates = candidates?.teamCandidates ?? [];
  const requestedLogins = pullRequest.requestedReviewers.flatMap((reviewer) =>
    reviewer.kind === "user" ? [reviewer.login] : [],
  );
  const requestedTeams = pullRequest.requestedReviewers.flatMap((reviewer) =>
    reviewer.kind === "team" ? [reviewer] : [],
  );
  const requestedSuggested = requestedLogins.filter((login) =>
    suggestedLogins.includes(login),
  );
  const requestedMembers = requestedLogins.filter(
    (login) => !suggestedLogins.includes(login),
  );
  const teams = [
    ...requestedTeams,
    ...teamCandidates.filter(
      ({ slug }) => !requestedTeams.some((team) => team.slug === slug),
    ),
  ];
  const suggested = [
    ...requestedSuggested,
    ...suggestedLogins.filter((login) => !requestedLogins.includes(login)),
  ];
  const otherMembers = [
    ...requestedMembers,
    ...reviewerCandidates
      .map(({ login }) => login)
      .filter(
        (login) =>
          !requestedLogins.includes(login) && !suggestedLogins.includes(login),
      ),
  ];
  const memberCount = suggested.length + otherMembers.length;

  if (!pullRequest.viewerCanUpdate || candidates === null) {
    return (
      <ReadOnlySection title="Reviewers">
        <ReviewersSummary
          detail={detail}
          candidates={candidates}
          onEdit={onEdit}
        />
      </ReadOnlySection>
    );
  }

  return (
    <FormEditableSection<ReviewersValues>
      title="Reviewers"
      editAriaLabel="Edit the requested reviewers"
      cancelLabel="Cancel"
      submitLabel="Save"
      submitErrorToMessage={errorToMessage}
      defaultValues={{
        members: requestedLogins.map(userValue),
        teams: requestedTeams.map(({ slug }) => teamValue(slug)),
      }}
      render={({ control }) => (
        <ReviewerGroups
          tabbed={memberCount > maxStackedReviewers}
          members={
            memberCount === 0 ? null : (
              <FormField
                control={control}
                name="members"
                label="Members"
                render={({ field, labelId }) => (
                  <CheckboxGroup
                    values={field.value}
                    aria-labelledby={labelId}
                    onValuesChange={field.onChange}
                  >
                    <View className="gap-sm">
                      <MemberCheckboxes title="Suggested" logins={suggested} />
                      <MemberCheckboxes
                        title={suggested.length === 0 ? null : "Others"}
                        logins={otherMembers}
                      />
                    </View>
                  </CheckboxGroup>
                )}
              />
            )
          }
          teams={
            teams.length === 0 ? null : (
              <FormField
                control={control}
                name="teams"
                label="Teams"
                render={({ field, labelId }) => (
                  <CheckboxGroup
                    values={field.value}
                    aria-labelledby={labelId}
                    onValuesChange={field.onChange}
                  >
                    <View className="gap-xxs">
                      {teams.map((team) => (
                        <Checkbox
                          key={team.slug}
                          value={teamValue(team.slug)}
                          label={team.name}
                        />
                      ))}
                    </View>
                  </CheckboxGroup>
                )}
              />
            )
          }
        />
      )}
      onSubmit={async ({ members: selectedMembers, teams: selectedTeams }) => {
        const edit = reviewersEdit(pullRequest, [
          ...selectedMembers,
          ...selectedTeams,
        ]);
        await onEdit(edit);
      }}
    >
      <ReviewersSummary
        detail={detail}
        candidates={candidates}
        onEdit={onEdit}
      />
    </FormEditableSection>
  );
}
