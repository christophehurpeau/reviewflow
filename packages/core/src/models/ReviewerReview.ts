/**
 * A reviewer who submitted a review on a pull request at some point. Being
 * listed here is what tells a first review apart from one asked again, since a
 * review request replaces the state they had reached.
 */
export interface ReviewerReview {
  id: number;
  login: string;
  /**
   * When they last decided — approved, requested changes, or had it dismissed.
   * Absent while their latest review is only a comment, so they are reviewing
   * rather than done.
   */
  endedAt?: Date;
}
