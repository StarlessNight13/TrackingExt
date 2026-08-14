import { createId } from "./ids";
import { requiredText } from "./validation";

export function newGroup(input: { name: string; notes?: string }) {
  const notes = input.notes ?? "";
  if (notes.length > 4000) throw new Error("Notes must be at most 4000 characters");
  return { id: createId("grp"), name: requiredText(input.name, "Group name", 120), notes };
}
