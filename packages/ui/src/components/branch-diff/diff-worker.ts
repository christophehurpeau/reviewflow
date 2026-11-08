/**
 * The portable entry, which inlines shiki. The plain `worker.js` imports shiki
 * modules the diff viewers import too, and the web export moves those into a
 * shared `__common` chunk that only the page loads: the worker then fails on
 * its first `require`.
 */
import "@pierre/diffs/worker/worker-portable.js";
