import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@trackingext/ui/lib/utils";
import * as React from "react";

/**
 * Material 3 filled text field.
 * @see https://m3.material.io/components/text-fields/overview
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-14 w-full min-w-0 rounded-t-[4px] rounded-b-none border-0 border-b border-foreground/40 bg-muted px-4 text-base leading-6 text-foreground transition-[border-width,border-color,background-color] outline-none file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-b-2 focus-visible:border-primary focus-visible:bg-muted/80 focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-38 aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive md:text-base",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
