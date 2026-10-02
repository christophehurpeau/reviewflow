import type { SVGIconElement } from "alouette";
import {
  Box,
  Button,
  ConfirmationMessage,
  ErrorMessage,
  ExternalLinkText,
  Icon,
  Paragraph,
  ScrollView,
  Text,
  View,
} from "alouette";
import { CheckCircleRegularIcon } from "alouette-icons/phosphor-icons/CheckCircleRegularIcon";
import { GitMergeRegularIcon } from "alouette-icons/phosphor-icons/GitMergeRegularIcon";
import { GithubLogoRegularIcon } from "alouette-icons/phosphor-icons/GithubLogoRegularIcon";
import { ListChecksRegularIcon } from "alouette-icons/phosphor-icons/ListChecksRegularIcon";
import { SlackLogoRegularIcon } from "alouette-icons/phosphor-icons/SlackLogoRegularIcon";
import { SquaresFourRegularIcon } from "alouette-icons/phosphor-icons/SquaresFourRegularIcon";
import { TagRegularIcon } from "alouette-icons/phosphor-icons/TagRegularIcon";
import type { ReactNode } from "react";
import { PageContainer } from "#/components/page-container.tsx";

const sourceUrl = "https://github.com/christophehurpeau/reviewflow";
const privacyPolicyUrl = "https://chapplications.com/privacy-policy";

/**
 * Two soft radial glows bleeding from the top corners over the plain screen
 * ground, instead of a full-page tinted wash. `opacity-*` keeps the glow
 * subtle in both modes without relying on color-mix, which native lacks.
 */
function LandingBackdrop(): ReactNode {
  return (
    <View className="pointer-events-none absolute inset-0 overflow-hidden">
      <Box
        accent="brand"
        className="absolute -top-[260px] -left-[200px] size-[720px] rounded-full bg-radial from-enabled to-transparent to-70% opacity-30"
      />
      <Box
        accent="info"
        className="absolute -top-[180px] -right-[240px] size-[640px] rounded-full bg-radial from-enabled to-transparent to-70% opacity-20"
      />
    </View>
  );
}

interface FeatureCardProps {
  icon: SVGIconElement;
  title: string;
  children: string;
}

function FeatureCard({ icon, title, children }: FeatureCardProps): ReactNode {
  return (
    <Box className="surface surface-sm min-w-[260px] flex-1 gap-sm">
      <Box
        accent="brand"
        className="flex-center size-[40px] rounded-full bg-highlight-accent"
      >
        <Icon icon={icon} size={22} className="text-accent" />
      </Box>
      <Text className="font-body-bold text-base">{title}</Text>
      <Paragraph className="text-sm text-muted">{children}</Paragraph>
    </Box>
  );
}

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
    <View className="h-screen bg-screen">
      <LandingBackdrop />
      <ScrollView className="flex-1" contentContainerClassName="pb-xxl">
        <PageContainer className="gap-xxl py-xxl lg:py-[96px]">
          <View className="gap-l lg:max-w-[760px]">
            <Text className="font-heading-extrabold text-4xl leading-tight xl:text-6xl">
              Pull requests that{" "}
              <Text
                accent="brand"
                className="font-heading-extrabold text-4xl leading-tight text-accent xl:text-6xl italic"
              >
                move forward
              </Text>
              .
            </Text>
            <Paragraph className="text-lg text-muted lg:max-w-[600px]">
              A status checklist in every description, labels and conventions
              kept in check, reviews and checks tracked, automerge when
              everything is green, and slack notifications for whoever is
              waiting.
            </Paragraph>

            {loggedOut ? (
              <ConfirmationMessage>You are signed out.</ConfirmationMessage>
            ) : null}
            {error ? <ErrorMessage>{error}</ErrorMessage> : null}

            <View className="flex-row flex-wrap items-center gap-m">
              <Button
                variant="filled"
                text="Sign in with GitHub"
                icon={<GithubLogoRegularIcon />}
                onPress={onSignIn}
              />
            </View>
          </View>

          <View className="flex-row flex-wrap gap-m">
            <FeatureCard
              icon={<ListChecksRegularIcon />}
              title="A checklist in every description"
            >
              The pull request body is rewritten with what is left to do:
              reviews, checks, conventions, and the options you toggled.
            </FeatureCard>
            <FeatureCard
              icon={<SlackLogoRegularIcon />}
              title="Slack where it matters"
            >
              Reviewers and authors are notified in slack, with per-message
              settings each member tunes for themselves.
            </FeatureCard>
            <FeatureCard
              icon={<CheckCircleRegularIcon />}
              title="Conventions enforced"
            >
              Titles and commits are linted against your conventional commit
              rules, and reported as a check on the pull request.
            </FeatureCard>
            <FeatureCard
              icon={<GitMergeRegularIcon />}
              title="Automerge when green"
            >
              Tick automerge and reviewflow waits for approvals and checks,
              keeps the branch up to date, then merges it.
            </FeatureCard>
            <FeatureCard icon={<TagRegularIcon />} title="Labels kept in sync">
              Review states, checks and code owners are turned into labels, so a
              board of pull requests reads at a glance.
            </FeatureCard>
            <FeatureCard
              icon={<SquaresFourRegularIcon />}
              title="A dashboard for an overview"
            >
              Every pull request you author or review, across all your accounts,
              grouped by what it is waiting for.
            </FeatureCard>
            <FeatureCard
              icon={<GithubLogoRegularIcon />}
              title="Configured per account"
            >
              Labels, review groups and rules are configured for your account,
              and shared by all its repositories.
            </FeatureCard>
          </View>

          <View className="flex-row flex-wrap items-center gap-m">
            <ExternalLinkText
              size="sm"
              href={privacyPolicyUrl}
              text="Privacy policy"
            />
            <ExternalLinkText
              size="sm"
              href={sourceUrl}
              text="Source on GitHub"
            />
          </View>
        </PageContainer>
      </ScrollView>
    </View>
  );
}
