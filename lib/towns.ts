export const TOWNS = [
  "Gampaha",
  "Kiribathgoda",
  "Nugegoda",
  "Kandy",
  "Kurunegala",
] as const;

export type Town = (typeof TOWNS)[number];
