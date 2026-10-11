import type { AccountInfo } from "./AccountInfo.ts";

/**
 * A reviewer asked by name whose request is pending. The date is when
 * reviewflow received the request: github does not return it, so it is absent
 * on a request reviewflow did not see being made.
 */
export interface ReviewerRequest extends AccountInfo {
  requestedAt?: Date;
}
