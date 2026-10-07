import type { MongoStore } from "liwi-mongo";
import type { Update } from "liwi-store";
import type { MongoStores, ReviewflowPr } from "../mongo.ts";

export type PrUpdate = Update<ReviewflowPr>;

export interface PrChange {
  prev: ReviewflowPr;
  next: ReviewflowPr;
}

export interface PrsWriter {
  /**
   * Partial update of one pr by `_id`. Bumps `revision`, sets `updated`, and
   * notifies the `prs` subscribers with the document as it was in the
   * database before the write, never with the caller's copy.
   *
   * Pass only the change: `revision` and `updated` are owned by the helper.
   * Throws when the pr does not exist.
   */
  updateOne: (id: string, update: PrUpdate) => Promise<PrChange>;
}

/**
 * Single entry point for writes to `prs`. Only updates for now; inserts,
 * deletes and bulk writes are added to the returned object.
 */
export function createPrsWriter(
  rawPrs: MongoStore<ReviewflowPr>,
  subscribedPrs: MongoStores["prs"],
): PrsWriter {
  return {
    async updateOne(id, update) {
      if (
        update.$set &&
        ("revision" in update.$set || "updated" in update.$set)
      ) {
        throw new Error("revision and updated are set by the prs writer");
      }

      const collection = await rawPrs.collection;
      // atomic: `prev` is exactly the document this update applied to
      const prev = await collection.findOneAndUpdate(
        { _id: id },
        {
          ...update,
          $set: { ...update.$set, updated: new Date() },
          $inc: { ...update.$inc, revision: 1 },
        } as Parameters<typeof collection.findOneAndUpdate>[1],
        { returnDocument: "before" },
      );
      if (!prev) throw new Error(`Pr not found: ${id}`);

      // Not atomic with the update: a write landing in between shows up in
      // `next`, and is itself emitted with this `next` as its `prev`.
      const next = await rawPrs.findByKey(id);
      if (!next) throw new Error(`Pr deleted during update: ${id}`);

      subscribedPrs.callSubscribed({
        type: "updated",
        changes: [[prev, next]],
      });
      return { prev, next };
    },
  };
}
