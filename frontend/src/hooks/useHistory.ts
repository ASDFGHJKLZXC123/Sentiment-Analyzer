import { useCallback, useState } from "react";
import { EMOTION_KEYS, type EmotionKey } from "@/api/types";
import type {
  AnalysisView,
  EmotionView,
  KeywordView,
  SentimentDisplay,
} from "@/api/toView";

const STORAGE_KEY = "sad:history:v1";
const LEGACY_KEY = "sa.history.v1";
const MAX_ENTRIES = 50;

export interface HistoryEntry {
  id: string;
  timestamp: number;
  inputText: string;
  result: AnalysisView;
}

interface HistoryStore {
  version: 1;
  entries: HistoryEntry[];
}

export interface UseHistoryResult {
  items: HistoryEntry[];
  add: (input: { inputText: string; result: AnalysisView }) => HistoryEntry;
  clear: () => void;
  select: (id: string) => HistoryEntry | undefined;
}

export function useHistory(): UseHistoryResult {
  const [store, setStore] = useState<HistoryStore>(() => loadOrMigrate());

  const persist = useCallback((next: HistoryStore) => {
    setStore(next);
    saveStore(next);
  }, []);

  const add = useCallback(
    ({ inputText, result }: { inputText: string; result: AnalysisView }) => {
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        inputText,
        result,
      };
      setStore((prev) => {
        const next: HistoryStore = {
          version: 1,
          entries: [entry, ...prev.entries].slice(0, MAX_ENTRIES),
        };
        saveStore(next);
        return next;
      });
      return entry;
    },
    [],
  );

  const clear = useCallback(() => {
    persist({ version: 1, entries: [] });
  }, [persist]);

  const select = useCallback(
    (id: string) => store.entries.find((e) => e.id === id),
    [store.entries],
  );

  return { items: store.entries, add, clear, select };
}

// ---- Persistence + migration ----

function loadOrMigrate(): HistoryStore {
  const fresh = readNewStore();
  if (fresh && fresh.entries.length > 0) return fresh;

  // Best-effort one-time migration from the legacy mock-frontend key. Fields
  // that don't match the current view-model are dropped; the legacy key is
  // intentionally left in place per spec §7 (avoids destructive errors).
  const migrated = migrateLegacy();
  if (migrated.length > 0) {
    const store: HistoryStore = { version: 1, entries: migrated };
    saveStore(store);
    return store;
  }

  return fresh ?? { version: 1, entries: [] };
}

function readNewStore(): HistoryStore | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isHistoryStore(parsed)) return null;
  return parsed;
}

function saveStore(store: HistoryStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage can throw (quota exceeded, private mode). History is a
    // convenience, not a correctness requirement — fail silently.
  }
}

function isHistoryStore(x: unknown): x is HistoryStore {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (!Array.isArray(o.entries)) return false;
  return o.entries.every(isHistoryEntry);
}

function isHistoryEntry(x: unknown): x is HistoryEntry {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.timestamp === "number" &&
    typeof o.inputText === "string" &&
    typeof o.result === "object" &&
    o.result !== null
  );
}

// ---- Legacy migration ----

const EMOTION_KEY_SET: ReadonlySet<string> = new Set<string>(EMOTION_KEYS);
const SENTIMENT_DISPLAY_VALUES: ReadonlySet<string> = new Set<SentimentDisplay>([
  "Positive",
  "Negative",
  "Neutral",
]);

function migrateLegacy(): HistoryEntry[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(LEGACY_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: HistoryEntry[] = [];
  for (const item of parsed) {
    const entry = convertLegacyEntry(item);
    if (entry) out.push(entry);
    if (out.length >= MAX_ENTRIES) break;
  }
  return out;
}

function convertLegacyEntry(item: unknown): HistoryEntry | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  if (typeof o.ts !== "number") return null;
  if (typeof o.input !== "string") return null;
  if (!o.result || typeof o.result !== "object") return null;
  const r = o.result as Record<string, unknown>;
  if (typeof r.sentiment !== "string") return null;
  if (typeof r.confidence !== "number") return null;
  if (!SENTIMENT_DISPLAY_VALUES.has(r.sentiment)) return null;

  // Legacy emotions [{label, score}] (Title-Case) → [{key, label, score}].
  // Drops any unrecognized labels.
  const emotions: EmotionView[] = [];
  if (Array.isArray(r.emotions)) {
    for (const e of r.emotions) {
      if (!e || typeof e !== "object") continue;
      const eo = e as Record<string, unknown>;
      if (typeof eo.label !== "string" || typeof eo.score !== "number") continue;
      const key = eo.label.toLowerCase();
      if (!EMOTION_KEY_SET.has(key)) continue;
      emotions.push({ key: key as EmotionKey, label: eo.label, score: eo.score });
    }
  }

  // Legacy `score` was already 0-1 higher-better, so it doubles as `weight`.
  // The original raw YAKE score is unrecoverable; reuse `score`.
  const keywords: KeywordView[] = [];
  if (Array.isArray(r.keywords)) {
    for (const k of r.keywords) {
      if (!k || typeof k !== "object") continue;
      const ko = k as Record<string, unknown>;
      if (typeof ko.term !== "string" || typeof ko.score !== "number") continue;
      keywords.push({ term: ko.term, rawScore: ko.score, weight: ko.score });
    }
  }

  const result: AnalysisView = {
    sentiment: r.sentiment as SentimentDisplay,
    confidence: r.confidence,
    emotions,
    keywords,
    inputText: o.input,
    analyzedAt: new Date(o.ts).toISOString(),
  };

  return { id: o.id, timestamp: o.ts, inputText: o.input, result };
}
