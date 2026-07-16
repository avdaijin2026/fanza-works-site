import actressDescriptionsData from "@/data/actress-descriptions.json";

export type ActressDescriptionEntry = {
  status?: string;
  updatedAt?: string;
  name?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  author?: string;
};

const actressDescriptions = actressDescriptionsData as Record<
  string,
  ActressDescriptionEntry
>;

export function getActressDescriptionEntry(actressId: string) {
  return actressDescriptions[actressId] ?? null;
}

export function getActressDescription(actressId: string) {
  const description = getActressDescriptionEntry(actressId)?.description;

  return typeof description === "string" && description.trim()
    ? description.trim()
    : "";
}
