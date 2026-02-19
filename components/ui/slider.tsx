import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => {
  const valueCount = Array.isArray(props.value)
    ? props.value.length
    : Array.isArray(props.defaultValue)
      ? props.defaultValue.length
      : 1;

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow rounded-full bg-slate-200">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-rose-500" />
      </SliderPrimitive.Track>
      {Array.from({ length: valueCount }).map((_, index) => (
        <SliderPrimitive.Thumb
          key={`thumb-${index}`}
          className="block h-4 w-4 rounded-full border border-rose-500 bg-white shadow-sm ring-offset-background transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500/40"
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = "Slider";

export { Slider };
