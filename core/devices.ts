import { createId } from "./ids";
import { requiredText } from "./validation";

export function newDevice(input: { id?: string; name: string; browser: string }) {
  return {
    id: input.id || createId("dev"),
    name: requiredText(input.name, "Device name", 120),
    browser: requiredText(input.browser, "Browser", 60),
  };
}
