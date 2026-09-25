import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  defang,
  getRole,
  isCompactSort,
  sortReports,
  type LaporanReport,
} from "../features/reports/reports";
import { defaultProgress } from "../features/progress/progress";

const NOW = Date.parse("2026-09-22T00:00:00Z");

function makeReport(
  id: string,
  createdAt: string,
  title = id,
  signalScore = 0,
  isOwner = false,
): LaporanReport {
  return {
    id,
    userId: "user-1",
    moduleId: null,
    attemptId: null,
    title,
    category: "SMS phishing",
    channel: "Text message",
    pattern: "Urgency",
    author: "operator",
    createdAt,
    updatedAt: createdAt,
    status: "Queued for developer review",
    review: "queued",
    evidence: "Observed evidence text",
    whyRisky: "Observed risk reason text",
    signalScore,
    hasSignaled: false,
    isOwner,
  };
}

describe("Laporan reports layer", () => {
  test("sorts newest and oldest", () => {
    const reports = [
      makeReport("b", new Date(NOW - 10 * 86_400_000).toISOString()),
      makeReport("a", new Date(NOW - 2 * 86_400_000).toISOString()),
      makeReport("c", new Date(NOW - 20 * 86_400_000).toISOString()),
    ];
    assert.deepEqual(
      sortReports(reports, "newest").map((report) => report.id),
      ["a", "b", "c"],
    );
    assert.deepEqual(
      sortReports(reports, "oldest").map((report) => report.id),
      ["c", "b", "a"],
    );
  });

  test("top sort uses the persisted signal_score", () => {
    const reports = [
      makeReport("lower-signal", new Date(NOW - 2 * 86_400_000).toISOString(), "Lower", 2),
      makeReport("top-signal", new Date(NOW - 9 * 86_400_000).toISOString(), "Top", 18),
    ];
    assert.equal(sortReports(reports, "top")[0].id, "top-signal");
  });

  test("only the three supported sorts are exposed", () => {
    assert.equal(isCompactSort("top"), false);
    assert.equal(isCompactSort("newest"), true);
    assert.equal(isCompactSort("oldest"), true);
  });

  test("owner metadata is preserved for my-reports views", () => {
    const report = makeReport("mine", new Date(NOW).toISOString(), "Mine", 0, true);
    assert.equal(report.isOwner, true);
  });

  test("investigator unlocks with 1 module plus a safe result", () => {
    assert.equal(getRole(defaultProgress), "student");
    assert.equal(
      getRole({ ...defaultProgress, modulesCompleted: 1, lastRetryResult: "unsafe" }),
      "student",
    );
    assert.equal(
      getRole({ ...defaultProgress, modulesCompleted: 1, lastRetryResult: "safe" }),
      "investigator",
    );
  });

  test("defangs urls for safe display", () => {
    assert.equal(defang("https://parcel-track.example/confirm"), "parcel-track[.]example/confirm");
    assert.equal(defang("  example.invalid "), "example[.]invalid");
  });
});
