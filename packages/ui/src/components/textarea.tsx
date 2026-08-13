import { cn } from "@trackingext/ui/lib/utils";
import * as React from "react";

/**
 * Material 3 filled multiline text field.
 * @see https://m3.material.io/components/text-fields/overview
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-28 w-full resize-none rounded-t-[4px] rounded-b-none border-0 border-b border-foreground/40 bg-muted px-4 py-4 text-base leading-6 text-foreground transition-[border-width,border-color,background-color] outline-none placeholder:text-muted-foreground focus-visible:border-b-2 focus-visible:border-primary focus-visible:bg-muted/80 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-38 aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive md:text-base",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
