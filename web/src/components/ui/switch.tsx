import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        // layout
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full outline-none",
        // sizing
        "data-[size=default]:h-[18px] data-[size=default]:w-[34px]",
        "data-[size=sm]:h-[14px] data-[size=sm]:w-[24px]",
        // track – unchecked
        "data-unchecked:bg-muted-foreground/20 dark:data-unchecked:bg-muted-foreground/25",
        // track – checked
        "data-checked:bg-foreground/85 dark:data-checked:bg-foreground/75 data-checked:shadow-[inset_0_1px_2px_0_rgba(0,0,0,0.12)]",
        // border
        "border-2 border-transparent data-checked:border-foreground/10",
        // transition
        "transition-[background-color,border-color,box-shadow] duration-200 ease-out",
        // focus ring
        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        // validation
        "aria-invalid:ring-2 aria-invalid:ring-destructive/30 aria-invalid:border-destructive dark:aria-invalid:ring-destructive/40",
        // disabled
        "data-disabled:cursor-not-allowed data-disabled:opacity-40",
        // hit area
        "after:absolute after:-inset-x-2 after:-inset-y-1.5",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          // shape & base colour
          "pointer-events-none block rounded-full bg-white shadow-sm",
          "ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
          // sizing
          "group-data-[size=default]/switch:size-[12px]",
          "group-data-[size=sm]/switch:size-[8px]",
          // position – unchecked (slight inset)
          "group-data-[size=default]/switch:data-unchecked:translate-x-[1px]",
          "group-data-[size=sm]/switch:data-unchecked:translate-x-[1px]",
          // position – checked (flush to end)
          "group-data-[size=default]/switch:data-checked:translate-x-[18px]",
          "group-data-[size=sm]/switch:data-checked:translate-x-[12px]",
          // checked: scale bounce + elevated shadow
          "data-checked:shadow-md",
          // smooth spring-like motion
          "transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
