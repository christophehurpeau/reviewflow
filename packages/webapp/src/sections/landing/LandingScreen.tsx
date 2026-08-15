import {
  Button,
  ConfirmationMessage,
  ErrorMessage,
  ExternalLinkButton,
  GradientBackground,
  HStack,
  Icon,
  Paragraph,
  ScrollView,
  Stack,
  Surface,
  Text,
  VStack,
} from "alouette";
import { CheckCircleRegularIcon } from "alouette-icons/phosphor-icons/CheckCircleRegularIcon";
import { GitMergeRegularIcon } from "alouette-icons/phosphor-icons/GitMergeRegularIcon";
import { GithubLogoRegularIcon } from "alouette-icons/phosphor-icons/GithubLogoRegularIcon";
import { ListChecksRegularIcon } from "alouette-icons/phosphor-icons/ListChecksRegularIcon";
// import { PlusCircleRegularIcon } from "alouette-icons/phosphor-icons/PlusCircleRegularIcon";
import { SlackLogoRegularIcon } from "alouette-icons/phosphor-icons/SlackLogoRegularIcon";
import { TagRegularIcon } from "alouette-icons/phosphor-icons/TagRegularIcon";
import type { ReactElement, ReactNode } from "react";
import { PageContainer } from "#/components/page-container.tsx";
// import { reviewflowName } from "#/reviewflowName.ts";

const sourceUrl = "https://github.com/christophehurpeau/reviewflow";
// const installUrl = `https://github.com/apps/${reviewflowName}`;

interface Feature {
  icon: ReactElement;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: <ListChecksRegularIcon />,
    title: "A checklist in every description",
    description:
      "The pull request body is rewritten with what is left to do: reviews, checks, conventions, and the options you toggled.",
  },
  {
    icon: <SlackLogoRegularIcon />,
    title: "Slack where it matters",
    description:
      "Reviewers and authors are notified in slack, with per-message settings each member tunes for themselves.",
  },
  {
    icon: <CheckCircleRegularIcon />,
    title: "Conventions enforced",
    description:
      "Titles and commits are linted against your conventional commit rules, and reported as a check on the pull request.",
  },
  {
    icon: <GitMergeRegularIcon />,
    title: "Automerge when green",
    description:
      "Tick automerge and reviewflow waits for approvals and checks, keeps the branch up to date, then merges it.",
  },
  {
    icon: <TagRegularIcon />,
    title: "Labels kept in sync",
    description:
      "Review states, checks and code owners are turned into labels, so a board of pull requests reads at a glance.",
  },
  {
    icon: <GithubLogoRegularIcon />,
    title: "Configured per account",
    description:
      "Labels, review groups and rules are configured for your account, and shared by all its repositories.",
  },
];

interface LandingScreenProps {
  error?: string;
  loggedOut: boolean;
  onSignIn: () => void;
}

export function LandingScreen({
  error,
  loggedOut,
  onSignIn,
}: LandingScreenProps): ReactNode {
  return (
    <VStack className="h-screen bg-screen">
      <GradientBackground accent="brand" />
      <ScrollView className="flex-1" contentContainerClassName="pb-xxl">
        <PageContainer className="gap-xxl py-xxl">
          <VStack className="gap-l lg:max-w-[720px]">
            <Text className="font-heading-extrabold text-4xl xl:text-5xl">
              reviewflow
            </Text>
            <Paragraph className="text-lg text-muted">
              The github bot that moves pull requests forward: a status
              checklist in every description, labels and conventions kept in
              check, reviews and checks tracked, automerge when everything is
              green, and slack notifications for whoever is waiting.
            </Paragraph>

            {loggedOut ? (
              <ConfirmationMessage>You are signed out.</ConfirmationMessage>
            ) : null}
            {error ? <ErrorMessage>{error}</ErrorMessage> : null}

            <HStack className="flex-wrap items-center gap-m">
              <Button
                text="Sign in with GitHub"
                icon={<GithubLogoRegularIcon />}
                onPress={onSignIn}
              />
              {/* <ExternalLinkButton
                variant="contained"
                icon={<PlusCircleRegularIcon />}
                href={installUrl}
                text={`Install ${reviewflowName}`}
              /> */}
            </HStack>
          </VStack>

          <Stack className="gap-m">
            {features.map((feature) => (
              <Surface
                key={feature.title}
                className="min-w-[260px] flex-1 gap-sm"
              >
                <Icon icon={feature.icon} size={28} className="text-accent" />
                <Text className="font-body-bold text-base">
                  {feature.title}
                </Text>
                <Paragraph className="text-sm text-muted">
                  {feature.description}
                </Paragraph>
              </Surface>
            ))}
          </Stack>

          <HStack>
            <ExternalLinkButton
              variant="ghost"
              size="sm"
              href={sourceUrl}
              text="Source on GitHub"
            />
          </HStack>
        </PageContainer>
      </ScrollView>
    </VStack>
  );
}
