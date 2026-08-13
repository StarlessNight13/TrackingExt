import { Button } from "@trackingext/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@trackingext/ui/components/dropdown-menu";
import { ChevronDownIcon } from "lucide-react";

export type MenuSelectOption = {
  value: string;
  label: string;
};

const EMPTY_VALUE = "__menu_select_empty__";

/**
 * Select control styled like an M3 filled text field, with an M3 menu.
 */
export function MenuSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select",
  "aria-label": ariaLabel,
  id,
  disabled,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: MenuSelectOption[];
  placeholder?: string;
  "aria-label"?: string;
  id?: string;
  disabled?: boolean;
}) {
  const selected = options.find((option) => option.value === value);
  const label = selected?.label ?? placeholder;
  const radioValue = value === "" ? EMPTY_VALUE : value;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={id}
        disabled={disabled}
        render={
          <Button
            variant="ghost"
            className="menu-select-trigger h-14 w-full justify-between rounded-t-[4px] rounded-b-none border-0 border-b border-foreground/40 bg-muted px-4 text-base font-normal text-foreground hover:bg-muted/80 aria-expanded:bg-muted/80 dark:hover:bg-muted/80"
            aria-label={ariaLabel ?? placeholder}
          />
        }
      >
        <span className="truncate">{label}</span>
        <ChevronDownIcon data-icon="inline-end" className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-(--anchor-width) w-(--anchor-width) max-w-none"
      >
        <DropdownMenuGroup>
          <DropdownMenuRadioGroup
            value={radioValue}
            onValueChange={(next) => onValueChange(next === EMPTY_VALUE ? "" : next)}
          >
            {options.map((option) => (
              <DropdownMenuRadioItem
                key={option.value || EMPTY_VALUE}
                value={option.value === "" ? EMPTY_VALUE : option.value}
              >
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
