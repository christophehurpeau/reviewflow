import type {
  PrStatus,
  PullRequestCandidatesResponse,
  PullRequestDetail,
  PullRequestDetailResponse,
  PullRequestEdit,
  PullRequestReviewState,
  PullRequestSummary,
} from "@reviewflow/sdk";
import { pluralOf, prStatusLabels, reviewflowPrStatus } from "@reviewflow/sdk";
import type { Accent } from "alouette";
import {
  AccentScope,
  ActionButton,
  Badge,
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  Code,
  ErrorMessage,
  FormEditableSection,
  FormField,
  Icon,
  IconButton,
  InputText,
  Tab,
  Tabs,
  Text,
  View,
  WarningMessage,
} from "alouette";
import { ArrowClockwiseRegularIcon } from "alouette-icons/phosphor-icons/ArrowClockwise";
import { ChatCircleDotsRegularIcon } from "alouette-icons/phosphor-icons/ChatCircleDots";
import type { ReactNode } from "react";
import { useState } from "react";
import { usePullRequestDataSource } from "../dataSource.ts";
import { usePrStatusAccent } from "../prStatus.ts";
import { emojify } from "../services/emojify.ts";
import { errorToMessage } from "../services/errorToMessage.ts";
import { formatDataAge } from "../services/formatDataAge.ts";
import { isViewerAuthor } from "../services/isViewerAuthor.ts";
import { LabelPill } from "./label-pill.tsx";
import {
  PullRequestMergeButton,
  PullRequestMergeStatus,
  PullRequestReopen,
} from "./pull-request-actions-merge.tsx";
import { CheckLine } from "./pull-request-checks.tsx";
import { PullRequestCommits } from "./pull-request-commits.tsx";
import { PersonAvatar } from "./pull-request-conversation-person.tsx";
import {
  PullRequestPartError,
  PullRequestPartPending,
  PullRequestPartReading,
} from "./pull-request-part-notice.tsx";
import { RepoName } from "./pull-request-repo-name.tsx";
import { PullRequestReview } from "./pull-request-review.tsx";
import { PullRequestTimeline } from "./pull-request-timeline.tsx";

/**
 * What the action components take: one edit written through the data source,
 * then GitHub's state read again.
 */
const useEditAndRefresh = ({
  detail,
  onEdited,
}: EditableProps): ((edit: PullRequestEdit) => Promise<void>) => {
  const { edit: writeEdit } = usePullRequestDataSource();
  return async (edit) => {
    await writeEdit(detail.pullRequest, edit);
    await onEdited(edit);
  };
};

interface EditableProps {
  detail: PullRequestDetailResponse;
  /** reads the pull request again once GitHub took the change */
  onEdited: (edit: PullRequestEdit) => Promise<void>;
}

/* --- header --- */

interface TitleEditorProps extends EditableProps {
  initial: string;
  onDone: () => void;
}

function TitleEditor({
  detail,
  onEdited,
  initial,
  onDone,
}: TitleEditorProps): ReactNode {
  const editAndRefresh = useEditAndRefresh({ detail, onEdited });
  const [title, setTitle] = useState(initial);
  return (
    <View className="flex-row flex-wrap items-center gap-xs">
      <InputText
        aria-label="Title"
        className="min-w-0 flex-1"
        value={title}
        onChangeText={setTitle}
      />
      <Button
        text="Cancel"
        accent="neutral"
        variant="soft"
        size="sm"
        onPress={onDone}
      />
      <ActionButton
        text="Save"
        accent="brand"
        variant="tonal"
        size="sm"
        disabled={title.trim() === ""}
        errorToMessage={errorToMessage}
        onPress={async () => {
          const edit: PullRequestEdit = { kind: "title", title };
          await editAndRefresh(edit);
          onDone();
        }}
      />
    </View>
  );
}

interface TitleTextProps {
  number: number;
  title: string;
}

function TitleText({ number, title }: TitleTextProps): ReactNode {
  return (
    <Text className="min-w-0 flex-1 font-heading-bold text-xl">
      <Text className="font-heading text-2xl text-muted">
        {`#${String(number)} `}
      </Text>
      {emojify(title)}
    </Text>
  );
}

interface MergeLineProps {
  /** null when the source does not know enough to say */
  status: PrStatus | null;
  author: string | null;
  baseRef: string | null;
  headRef: string | null;
  /** what follows the branches: sizes and age, which only GitHub's read has */
  children?: ReactNode;
}

/** Badge aligns itself to the start: in a row, that is the top, not the center. */
function CenteredBadge({ children }: { children: ReactNode }): ReactNode {
  return <View className="justify-center">{children}</View>;
}

function StatusBadge({ status }: { status: PrStatus }): ReactNode {
  return (
    <CenteredBadge>
      <Badge accent={usePrStatusAccent(status)}>{prStatusLabels[status]}</Badge>
    </CenteredBadge>
  );
}

function MergeLine({
  status,
  author,
  baseRef,
  headRef,
  children,
}: MergeLineProps): ReactNode {
  return (
    <View className="flex-row flex-wrap items-center gap-xs">
      {status === null ? null : <StatusBadge status={status} />}
      <Text className="text-sm font-body-bold">
        {author ?? "unknown author"}
      </Text>
      {baseRef === null || headRef === null ? null : (
        <>
          <Text className="text-xs text-muted">
            {status === "merged" ? "merged into" : "wants to merge into"}
          </Text>
          <Code className="text-sm">{baseRef}</Code>
          <Text className="text-xs text-muted">from</Text>
          <Code className="text-sm">{headRef}</Code>
        </>
      )}
      {children}
    </View>
  );
}

/**
 * The header from a summary the data source holds, while GitHub is read: the
 * same title and branch line, without what only GitHub's answer carries.
 */
export function PullRequestSummaryHeader({
  summary,
}: {
  summary: PullRequestSummary;
}): ReactNode {
  return (
    <View className="gap-sm">
      <RepoName ownerRepo={summary.ownerRepo} />
      <TitleText number={summary.number} title={summary.title} />
      <MergeLine
        status={reviewflowPrStatus(summary)}
        author={summary.author}
        baseRef={summary.baseRef}
        headRef={summary.headRef}
      />
    </View>
  );
}

interface HeaderProps extends EditableProps {
  summary: PullRequestSummary | null;
}

/**
 * The header: the title and its number, Edit and the way out beside
 * them, and one line saying whose branch goes where. The review status is
 * reviewflow's, never recomputed from GitHub's: without reviewflow's
 * summary, an open pull request shows none.
 */
function Header({ detail, summary, onEdited }: HeaderProps): ReactNode {
  const { pullRequest } = detail;
  const [editing, setEditing] = useState(false);

  return (
    <View className="gap-sm">
      <RepoName ownerRepo={pullRequest.ownerRepo} />
      {editing ? (
        <TitleEditor
          detail={detail}
          initial={pullRequest.title}
          onEdited={onEdited}
          onDone={() => {
            setEditing(false);
          }}
        />
      ) : (
        <View className="flex-row flex-wrap items-start gap-m">
          <TitleText number={pullRequest.number} title={pullRequest.title} />
          <View className="flex-row items-center gap-xs">
            {pullRequest.viewerCanUpdate ? (
              <Button
                text="Edit"
                accent="neutral"
                variant="tonal"
                size="sm"
                aria-label="Edit the title"
                onPress={() => {
                  setEditing(true);
                }}
              />
            ) : null}
          </View>
        </View>
      )}
      <MergeLine
        status={reviewflowPrStatus({
          state: pullRequest.state,
          reviewState: summary?.reviewState ?? null,
        })}
        author={pullRequest.author?.login ?? null}
        baseRef={pullRequest.baseRef}
        headRef={pullRequest.headRef}
      >
        <Text className="text-sm text-muted">·</Text>
        <View className="flex-row gap-xxs">
          <AccentScope accent="success">
            <Text className="text-sm font-body-bold text-accent">
              {`+${String(pullRequest.additions)}`}
            </Text>
          </AccentScope>
          <AccentScope accent="danger">
            <Text className="text-sm font-body-bold text-accent">
              {`−${String(pullRequest.deletions)}`}
            </Text>
          </AccentScope>
        </View>
        <Text className="text-xs text-muted">
          {`· updated ${formatDataAge(pullRequest.updatedAt)}`}
        </Text>
      </MergeLine>
    </View>
  );
}

/* --- conversation --- */

interface SurfaceProps {
  title: string;
  children: ReactNode;
}

function Surface({ title, children }: SurfaceProps): ReactNode {
  return (
    <Box className="surface min-w-0 gap-m p-m">
      <Text className="font-heading-bold text-lg">{title}</Text>
      {children}
    </Box>
  );
}

/**
 * The passing checks are a count: what needs reading is what failed or has
 * not finished, and a list of forty green lines buries it.
 */
function Checks({
  pullRequest,
}: {
  pullRequest: PullRequestDetail;
}): ReactNode {
  const { value, error } = usePullRequestDataSource().usePart(
    pullRequest,
    "checks",
  );
  if (value === null) {
    return <PullRequestPartPending error={error} what="the checks" />;
  }
  const { checks, checksTotal } = value;
  if (checksTotal === 0) {
    return <Text className="text-sm text-muted">no checks</Text>;
  }
  const unsettled = checks.filter((check) => check.outcome !== "passed");
  const passed = checks.length - unsettled.length;
  const unlisted = checksTotal - checks.length;

  return (
    <View className="gap-xs">
      {unsettled.map((check) => (
        <CheckLine key={check.name} check={check} />
      ))}
      <Text className="text-sm text-muted">
        {`${String(passed)} passing${unlisted > 0 ? `, ${String(unlisted)} more not listed` : ""}`}
      </Text>
    </View>
  );
}

/** Above every tab: a conflict is the one thing that blocks the merge whatever is being read. */
function ConflictWarning({
  pullRequest,
}: {
  pullRequest: PullRequestDetail;
}): ReactNode {
  if (pullRequest.mergeable !== "conflicting") return null;
  return (
    <WarningMessage>
      {`This branch has conflicts with ${pullRequest.baseRef} that must be resolved.`}
    </WarningMessage>
  );
}

/**
 * Counted from the threads GitHub listed, the ones the conversation shows and
 * resolves: reviewflow's own count would lag a resolve made here until its
 * webhook lands. Past the 100 threads read, it undercounts.
 */
function UnresolvedThreads({
  pullRequest,
}: {
  pullRequest: PullRequestDetail;
}): ReactNode {
  const { value } = usePullRequestDataSource().usePart(pullRequest, "timeline");
  const unresolved = (value?.timeline ?? []).filter(
    (item) => item.kind === "thread" && !item.resolved,
  ).length;
  if (unresolved === 0) return null;
  return (
    <View className="flex-row items-start gap-xs">
      <AccentScope accent="warning">
        <View className="h-[20px] justify-center">
          <Icon
            icon={<ChatCircleDotsRegularIcon />}
            size={16}
            className="text-accent"
          />
        </View>
      </AccentScope>
      <Text className="min-w-0 flex-1 text-sm">
        {pluralOf(unresolved, "unresolved thread")}
      </Text>
    </View>
  );
}

/**
 * GitHub's merge box, minus its buttons, at the top of the sidebar: what
 * stands between the pull request and a review. On a draft that is the
 * operator's own move, so it leads.
 */
function Status({ detail, onEdited }: EditableProps): ReactNode {
  const { pullRequest } = detail;
  const editAndRefresh = useEditAndRefresh({ detail, onEdited });
  if (pullRequest.state === "merged") return null;
  if (pullRequest.state === "closed") {
    return (
      <View className="gap-sm">
        <Text className="font-heading-bold text-xl">Status</Text>
        <Text className="text-sm">This pull request is closed.</Text>
      </View>
    );
  }

  return (
    <View className="gap-sm">
      <Text className="font-heading-bold text-xl">Status</Text>
      {pullRequest.state === "draft" && pullRequest.viewerCanUpdate ? (
        <View className="items-start gap-xs">
          <Text className="text-sm">
            This pull request is still a work in progress.
          </Text>
          <ActionButton
            text="Ready for review"
            accent="brand"
            variant="tonal"
            size="sm"
            errorToMessage={errorToMessage}
            onPress={async () => {
              const edit: PullRequestEdit = { kind: "draft", draft: false };
              await editAndRefresh(edit);
            }}
          />
        </View>
      ) : null}
      {pullRequest.state === "draft" && !pullRequest.viewerCanUpdate ? (
        <Text className="text-sm">
          This pull request is still a work in progress.
        </Text>
      ) : null}
      <Checks pullRequest={pullRequest} />
      <UnresolvedThreads pullRequest={pullRequest} />
      <PullRequestMergeStatus detail={detail} onEdit={editAndRefresh} />
    </View>
  );
}

/** Every check of the head commit, failures first, the passing ones too. */
function ChecksTab({
  pullRequest,
}: {
  pullRequest: PullRequestDetail;
}): ReactNode {
  const { value, error, reading } = usePullRequestDataSource().usePart(
    pullRequest,
    "checks",
  );
  if (value === null) {
    return <PullRequestPartPending error={error} what="the checks" />;
  }
  const { checks, checksTotal } = value;
  const unlisted = checksTotal - checks.length;
  return (
    <Surface title={`Checks (${String(checksTotal)})`}>
      <PullRequestPartReading reading={reading} />
      <PullRequestPartError error={error} />
      {checksTotal === 0 ? (
        <Text className="text-sm text-muted">no checks</Text>
      ) : (
        <View className="gap-xs">
          {checks.map((check) => (
            <CheckLine key={check.name} check={check} />
          ))}
          {unlisted > 0 ? (
            <Text className="text-sm text-muted">
              {`${String(unlisted)} more not listed`}
            </Text>
          ) : null}
        </View>
      )}
    </Surface>
  );
}

/* --- sidebar --- */

interface CandidatesProps extends EditableProps {
  /** what the editors offer; null until GitHub answered, the editors read-only */
  candidates: PullRequestCandidatesResponse | null;
}

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

/**
 * GitHub's reviewers list: each person once — awaiting when asked (again),
 * else their latest review — teams as asked.
 */
function ReviewersSummary({
  detail,
  candidates,
  onEdit,
}: {
  detail: PullRequestDetailResponse;
  candidates: PullRequestCandidatesResponse | null;
  onEdit: (edit: PullRequestEdit) => Promise<void>;
}): ReactNode {
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

function ReadOnlySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <View className="gap-sm">
      <Text className="font-heading-bold text-xl">{title}</Text>
      {children}
    </View>
  );
}

/**
 * Members: GitHub's suggestions grouped first, then anyone else already asked,
 * then the repository's assignable users; those already asked lead each group.
 * Teams: those already asked, then the rest.
 */
function Reviewers({
  detail,
  candidates,
  onEdited,
}: CandidatesProps): ReactNode {
  const { pullRequest } = detail;
  const editAndRefresh = useEditAndRefresh({ detail, onEdited });
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
          onEdit={editAndRefresh}
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
        await editAndRefresh(edit);
      }}
    >
      <ReviewersSummary
        detail={detail}
        candidates={candidates}
        onEdit={editAndRefresh}
      />
    </FormEditableSection>
  );
}

/** Where GitHub puts it: under the reviewers, the rare way back. */
function ConvertToDraft({ detail, onEdited }: EditableProps): ReactNode {
  const { pullRequest } = detail;
  const editAndRefresh = useEditAndRefresh({ detail, onEdited });
  if (pullRequest.state !== "open" || !pullRequest.viewerCanUpdate) return null;
  return (
    <View className="flex-row flex-wrap items-center gap-xs">
      <Text className="text-xs text-muted">Still in progress?</Text>
      <ActionButton
        text="Convert to draft"
        accent="neutral"
        variant="tonal"
        size="sm"
        errorToMessage={errorToMessage}
        onPress={async () => {
          const edit: PullRequestEdit = { kind: "draft", draft: true };
          await editAndRefresh(edit);
        }}
      />
    </View>
  );
}

interface AssigneesValues {
  assignees: string[];
}

function AssigneesSummary({
  pullRequest,
}: {
  pullRequest: PullRequestDetail;
}): ReactNode {
  if (pullRequest.assignees.length === 0) {
    return <Text className="text-sm text-muted">No one assigned</Text>;
  }
  return (
    <View className="gap-xs">
      {pullRequest.assignees.map((assignee) => (
        <View key={assignee.login} className="flex-row items-center gap-xs">
          <PersonAvatar person={assignee} />
          <Text className="min-w-0 flex-1 text-sm" numberOfLines={1}>
            {assignee.login}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Current assignees first, then the repository's assignable users. */
function Assignees({
  detail,
  candidates,
  onEdited,
}: CandidatesProps): ReactNode {
  const { pullRequest } = detail;
  const editAndRefresh = useEditAndRefresh({ detail, onEdited });
  const current = pullRequest.assignees.map(({ login }) => login);
  const offered = [
    ...new Set([
      ...current,
      ...(candidates?.assigneeCandidates ?? []).map(({ login }) => login),
    ]),
  ];

  if (!pullRequest.viewerCanUpdate || candidates === null) {
    return (
      <ReadOnlySection title="Assignees">
        <AssigneesSummary pullRequest={pullRequest} />
      </ReadOnlySection>
    );
  }

  return (
    <FormEditableSection<AssigneesValues>
      title="Assignees"
      editAriaLabel="Edit the pull request's assignees"
      cancelLabel="Cancel"
      submitLabel="Save"
      submitErrorToMessage={errorToMessage}
      defaultValues={{ assignees: current }}
      render={({ control }) => (
        <FormField
          control={control}
          name="assignees"
          label="Assign to"
          render={({ field, labelId }) => (
            <CheckboxGroup
              values={field.value}
              aria-labelledby={labelId}
              onValuesChange={field.onChange}
            >
              <View className="gap-xxs">
                {offered.map((login) => (
                  <Checkbox key={login} value={login} label={login} />
                ))}
              </View>
            </CheckboxGroup>
          )}
        />
      )}
      onSubmit={async ({ assignees }) => {
        const before = new Set(current);
        const after = new Set(assignees);
        const edit: PullRequestEdit = {
          kind: "assignees",
          add: assignees.filter((login) => !before.has(login)),
          remove: current.filter((login) => !after.has(login)),
        };
        await editAndRefresh(edit);
      }}
    >
      <AssigneesSummary pullRequest={pullRequest} />
    </FormEditableSection>
  );
}

interface LabelsValues {
  labels: string[];
}

function Labels({ detail, candidates, onEdited }: CandidatesProps): ReactNode {
  const { pullRequest } = detail;
  const editAndRefresh = useEditAndRefresh({ detail, onEdited });
  const current = pullRequest.labels.map(({ name }) => name);
  const offered = [
    ...new Set([
      ...current,
      ...(candidates?.repoLabels ?? []).map(({ name }) => name),
    ]),
  ];
  const summary =
    pullRequest.labels.length === 0 ? (
      <Text className="text-sm text-muted">None yet</Text>
    ) : (
      <View className="flex-row flex-wrap gap-xxs">
        {pullRequest.labels.map((label) => (
          <LabelPill key={label.name} label={label} />
        ))}
      </View>
    );

  if (!pullRequest.viewerCanUpdate || candidates === null) {
    return <ReadOnlySection title="Labels">{summary}</ReadOnlySection>;
  }

  return (
    <FormEditableSection<LabelsValues>
      title="Labels"
      editAriaLabel="Edit the pull request's labels"
      cancelLabel="Cancel"
      submitLabel="Save"
      submitErrorToMessage={errorToMessage}
      defaultValues={{ labels: current }}
      render={({ control }) => (
        <FormField
          control={control}
          name="labels"
          label="Apply labels"
          render={({ field, labelId }) => (
            <CheckboxGroup
              values={field.value}
              aria-labelledby={labelId}
              onValuesChange={field.onChange}
            >
              <View className="gap-xxs">
                {offered.map((name) => (
                  <Checkbox key={name} value={name} label={emojify(name)} />
                ))}
              </View>
            </CheckboxGroup>
          )}
        />
      )}
      onSubmit={async ({ labels }) => {
        const before = new Set(current);
        const after = new Set(labels);
        const edit: PullRequestEdit = {
          kind: "labels",
          add: labels.filter((name) => !before.has(name)),
          remove: current.filter((name) => !after.has(name)),
        };
        await editAndRefresh(edit);
      }}
    >
      {summary}
    </FormEditableSection>
  );
}

/** The status, then GitHub's sidebar order: reviewers, assignees, labels. */
function Sidebar({ detail, candidates, onEdited }: CandidatesProps): ReactNode {
  return (
    <View className="gap-xxl md:w-[296px] md:shrink-0">
      <Status detail={detail} onEdited={onEdited} />

      <View className="gap-xs">
        <Reviewers
          detail={detail}
          candidates={candidates}
          onEdited={onEdited}
        />
        <ConvertToDraft detail={detail} onEdited={onEdited} />
      </View>

      <Assignees detail={detail} candidates={candidates} onEdited={onEdited} />

      <Labels detail={detail} candidates={candidates} onEdited={onEdited} />
    </View>
  );
}

export type PullRequestTab = "checks" | "commits" | "review" | "timeline";

export const isPullRequestTab = (value: unknown): value is PullRequestTab =>
  value === "checks" ||
  value === "commits" ||
  value === "timeline" ||
  value === "review";

/** The timeline opens on the description, as GitHub's first comment. */
function TimelineTab({
  detail,
  candidates,
  onEdited,
}: CandidatesProps): ReactNode {
  return (
    <View className="flex-col gap-l md:flex-row md:items-start">
      <View className="min-w-0 gap-m md:flex-1">
        <PullRequestTimeline detail={detail} onEdited={onEdited} />
      </View>
      <Sidebar detail={detail} candidates={candidates} onEdited={onEdited} />
    </View>
  );
}

/** Beside the tabs, so the merge and the reopen are in reach from every tab. */
function PullRequestActions({ detail, onEdited }: EditableProps): ReactNode {
  const onEdit = useEditAndRefresh({ detail, onEdited });
  return (
    <View className="flex-row flex-wrap items-center gap-xs">
      <PullRequestReopen detail={detail} onEdit={onEdit} />
      <PullRequestMergeButton detail={detail} onEdit={onEdit} />
    </View>
  );
}

export interface PullRequestPanelProps extends CandidatesProps {
  /** reviewflow's copy, where the review status comes from; null without reviewflow */
  summary: PullRequestSummary | null;
  /** why the editors stay read-only, when GitHub refused what they offer */
  candidatesError: string | null;
  /** absent: the first tab, Review for a reviewer and Conversation for the author */
  tab?: PullRequestTab;
  onTabChange: (tab: PullRequestTab) => void;
  /** the commit whose diff is open on the Commits tab; absent: the tab holds it */
  openCommit?: string | null;
  onOpenCommitChange?: (oid: string | null) => void;
}

/**
 * One pull request as GitHub reports it now, laid out as GitHub's own page —
 * the header, then Timeline (the description, a status box and a narrow
 * sidebar), Commits, Checks and Review — with the edits the operator makes
 * before asking for a review. Every edit is GitHub's to refuse, and the panel
 * re-reads the pull request after it, so nothing on screen is the request
 * echoed back.
 */
export function PullRequestPanel({
  detail,
  summary,
  candidates,
  candidatesError,
  onEdited,
  tab: tabProp,
  onTabChange,
  openCommit,
  onOpenCommitChange,
}: PullRequestPanelProps): ReactNode {
  const { pullRequest, errors } = detail;
  const checks = usePullRequestDataSource().usePart(
    pullRequest,
    "checks",
  ).value;
  const viewerIsAuthor = isViewerAuthor(detail);
  const tab = tabProp ?? (viewerIsAuthor ? "timeline" : "review");
  const reviewTab = (
    <Tab
      value="review"
      label={`Review (${pluralOf(pullRequest.changedFiles, "file")})`}
    />
  );
  return (
    <View className="gap-l">
      {[...new Set([...errors, ...(candidates?.errors ?? [])])].map((error) => (
        <WarningMessage key={error}>{error}</WarningMessage>
      ))}
      {candidatesError === null ? null : (
        <WarningMessage>
          {`Reviewers, assignees and labels cannot be edited: ${candidatesError}`}
        </WarningMessage>
      )}
      <Header detail={detail} summary={summary} onEdited={onEdited} />
      <ConflictWarning pullRequest={pullRequest} />
      <View className="flex-row flex-wrap items-center justify-between gap-sm">
        <Tabs
          aria-label="Pull request sections"
          value={tab}
          onValueChange={(next) => {
            if (isPullRequestTab(next)) onTabChange(next);
          }}
        >
          {viewerIsAuthor ? null : reviewTab}
          <Tab value="timeline" label="Conversation" />
          <Tab
            value="commits"
            label={`Commits (${String(pullRequest.commitsTotal)})`}
          />
          <Tab
            value="checks"
            label={
              checks === null
                ? "Checks"
                : `Checks (${String(checks.checksTotal)})`
            }
          />
          {viewerIsAuthor ? reviewTab : null}
        </Tabs>
        <PullRequestActions detail={detail} onEdited={onEdited} />
      </View>
      {(() => {
        if (tab === "commits") {
          return (
            <PullRequestCommits
              detail={detail}
              openCommit={openCommit}
              onEdited={onEdited}
              onOpenCommitChange={onOpenCommitChange}
            />
          );
        }
        if (tab === "checks") return <ChecksTab pullRequest={pullRequest} />;
        if (tab === "review") {
          return <PullRequestReview detail={detail} onEdited={onEdited} />;
        }
        return (
          <TimelineTab
            detail={detail}
            candidates={candidates}
            onEdited={onEdited}
          />
        );
      })()}
    </View>
  );
}
