import { cn } from "@trackingext/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

/**
 * Material 3 cards — elevated, filled, outlined.
 * @see https://m3.material.io/components/cards/overview
 */
const cardVariants = cva(
  "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-xl py-(--card-spacing) text-sm text-card-foreground [--card-spacing:--spacing(4)] has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:[--card-spacing:--spacing(3)] data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
  {
    variants: {
      variant: {
        /** surface-container-low + elevation level 1 */
        elevated:
          "bg-card shadow-[0_1px_2px_oklch(0_0_0/0.3),0_1px_3px_1px_oklch(0_0_0/0.15)] ring-0 transition-shadow hover:shadow-[0_1px_2px_oklch(0_0_0/0.3),0_2px_6px_2px_oklch(0_0_0/0.15)]",
        /** surface-container-highest, no elevation */
        filled: "bg-muted shadow-none ring-0",
        /** surface + outline-variant */
        outlined: "bg-background shadow-none ring-1 ring-border",
      },
      size: {
        default: "",
        sm: "",
      },
    },
    defaultVariants: {
      variant: "elevated",
      size: "default",
    },
  },
);

function Card({
  className,
  size = "default",
  variant = "elevated",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof cardVariants>) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-variant={variant}
      className={cn(cardVariants({ variant, size }), className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1.5 px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "cn-font-heading text-base leading-6 font-medium tracking-[0.01em] group-data-[size=sm]/card:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm leading-5 text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-content" className={cn("px-(--card-spacing)", className)} {...props} />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex flex-wrap items-center gap-2 px-(--card-spacing) pt-1 pb-(--card-spacing)",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  cardVariants,
};
