import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  safeGetItem,
  safeSetItem,
  safeRemoveItem,
  safeClearNamespace,
} from "../lib/storage/safe-storage";

describe("Safe Storage Layer", () => {
  test("stores and retrieves typed items safely", () => {
    const key = "alethia:test:valid:v1";
    const sample = { id: "123", count: 42, active: true };

    safeSetItem(key, sample);
    const retrieved = safeGetItem(key, { id: "", count: 0, active: false });

    assert.deepEqual(retrieved, sample);
    safeRemoveItem(key);
  });

  test("returns fallback when key does not exist", () => {
    const fallback = { status: "fallback_value" };
    const retrieved = safeGetItem("alethia:non-existent-key", fallback);
    assert.deepEqual(retrieved, fallback);
  });

  test("returns fallback when stored JSON is corrupted", () => {
    const key = "alethia:test:corrupted:v1";
    safeSetItem(key, "invalid raw string");

    const validator = (v: unknown): v is { field: string } =>
      typeof v === "object" && v !== null && "field" in v;

    const fallback = { field: "default_safe" };
    const result = safeGetItem(key, fallback, validator);
    assert.deepEqual(result, fallback);

    safeRemoveItem(key);
  });

  test("removes items cleanly", () => {
    const key = "alethia:test:remove:v1";
    safeSetItem(key, { name: "test" });
    const stored = safeGetItem<{ name: string } | null>(key, null);
    assert.equal(stored?.name, "test");

    safeRemoveItem(key);
    assert.equal(safeGetItem(key, null), null);
  });

  test("clears namespace without affecting other keys", () => {
    safeSetItem("alethia:test:ns1", "val1");
    safeSetItem("alethia:test:ns2", "val2");
    safeSetItem("other:key", "keep");

    safeClearNamespace("alethia:test:");

    assert.equal(safeGetItem("alethia:test:ns1", null), null);
    assert.equal(safeGetItem("alethia:test:ns2", null), null);
    assert.equal(safeGetItem("other:key", null), "keep");

    safeRemoveItem("other:key");
  });
});
