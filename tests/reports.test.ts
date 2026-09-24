import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  defang,
  filterReports,
  getRole,
  isCompactSort,
  seedReports,
  sortReports,
  toggleSignal,
  hasSignaled,
  type LaporanReport,
} from "../features/reports/reports";
import { defaultProgress } from "../features/progress/progress";
import { safeRemoveItem } from "../lib/storage/safe-storage";

const NOW = Date.parse("2026-09-22T00:00:00Z");

function makeReport(id: string, createdAt: string, title = id): LaporanReport {
  return {
    id,
    title,
    category: "SMS phishing",
    channel: "Text message",
    pattern: "Urgency",
    author: "tester",
    createdAt,
    status: "Queued",
    review: "queued",
    evidence: "sample evidence text",
    whyRisky: "sample risk reason text",
  };
}

describe("Laporan reports layer", () => {
  test("seeds six reports matching the wireframe slots", () => {
    assert.equal(seedReports(NOW).length, 6);
  });

  test("monthly filter keeps last 30 days, all keeps everything", () => {
    const reports = [
      makeReport("recent", new Date(NOW - 5 * 86_400_000).toISOString()),
      makeReport("old", new Date(NOW - 45 * 86_400_000).toISOString()),
    ];
    assert.deepEqual(
      filterReports(reports, "monthly", NOW).map((r) => r.id),
      ["recent"],
    );
    assert.equal(filterReports(reports, "all", NOW).length, 2);
  });

  test("sorts newest, oldest, and title A-Z", () => {
    const reports = [
      makeReport("b", new Date(NOW - 10 * 86_400_000).toISOString(), "Bravo"),
      makeReport("a", new Date(NOW - 2 * 86_400_000).toISOString(), "Alpha"),
      makeReport("c", new Date(NOW - 20 * 86_400_000).toISOString(), "Charlie"),
    ];
    assert.deepEqual(
      sortReports(reports, "newest").map((r) => r.id),
      ["a", "b", "c"],
    );
    assert.deepEqual(
      sortReports(reports, "oldest").map((r) => r.id),
      ["c", "b", "a"],
    );
    assert.deepEqual(
      sortReports(reports, "title").map((r) => r.id),
      ["a", "b", "c"],
    );
  });

  test("top sort ranks by signal count, review sort floats the queue first", () => {
    const reports = [
      makeReport("seed-otp-forward", new Date(NOW - 2 * 86_400_000).toISOString()),
      makeReport("seed-courier-surge", new Date(NOW - 9 * 86_400_000).toISOString()),
    ];
    assert.equal(sortReports(reports, "top")[0].id, "seed-courier-surge");
    const mixed = [
      { ...makeReport("x", new Date(NOW - 1 * 86_400_000).toISOString()), review: "approved" as const },
      { ...makeReport("y", new Date(NOW - 9 * 86_400_000).toISOString()), review: "queued" as const },
    ];
    assert.equal(sortReports(mixed, "review")[0].id, "y");
  });

  test("compact layout for every sort except top signals", () => {
    assert.equal(isCompactSort("top"), false);
    assert.equal(isCompactSort("review"), true);
    assert.equal(isCompactSort("newest"), true);
    assert.equal(isCompactSort("oldest"), true);
    assert.equal(isCompactSort("title"), true);
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

  test("signals toggle per report", () => {
    safeRemoveItem("alethia:report-signals:v1");
    assert.equal(hasSignaled("seed-courier-surge"), false);
    toggleSignal("seed-courier-surge");
    assert.equal(hasSignaled("seed-courier-surge"), true);
    toggleSignal("seed-courier-surge");
    assert.equal(hasSignaled("seed-courier-surge"), false);
  });

  test("defangs urls for safe display", () => {
    assert.equal(defang("https://parcel-track.example/confirm"), "parcel-track[.]example/confirm");
    assert.equal(defang("  example.invalid "), "example[.]invalid");
  });
});
