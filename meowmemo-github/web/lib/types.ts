export type Cat = {
  id: string;
  name: string;
  photo?: Blob;
  createdAt: number;
};

export type Detection = "likely" | "uncertain" | "not_detected";
export type ContextId = "food" | "brushing" | "isolation";
export type UserLabel = ContextId | "other" | "unknown";

/** Exactly what the inference API returned. Never edited or invented on the client. */
export type AnalysisResult = {
  model_version: string;
  duration_s: number;
  detection: Detection;
  reason?: "silence" | "not_cat";
  contexts: { id: ContextId; text: string; rank: "closest match" | "possible" }[];
  context_unsure: boolean;
  evidence: string[];
};

export type Recording = {
  id: string;
  catId: string;
  audio: Blob;
  mime: string;
  createdAt: number;
  trimStart: number;
  trimEnd: number;
  result: AnalysisResult;
  modelVersion: string;
  userLabel: UserLabel;
  note: string;
};

export const LABELS: { id: UserLabel; text: string }[] = [
  { id: "food", text: "Wants food" },
  { id: "brushing", text: "Being brushed or handled" },
  { id: "isolation", text: "Alone or somewhere new" },
  { id: "other", text: "Something else" },
  { id: "unknown", text: "Not sure" },
];

export const labelText = (id: UserLabel) => LABELS.find((l) => l.id === id)?.text ?? id;
