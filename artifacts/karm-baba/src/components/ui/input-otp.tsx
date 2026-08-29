import * as React from "react"
import { OTPInput, OTPInputContext, REGEXP_ONLY_DIGITS } from "input-otp"
import { Minus } from "lucide-react"

import { cn } from "@/lib/utils"
import { normalizeOtpCode } from "@/lib/otpInput"

const InputOTP = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(
  (
    {
      className,
      containerClassName,
      onChange,
      pasteTransformer,
      maxLength = 6,
      pattern = REGEXP_ONLY_DIGITS,
      pushPasswordManagerStrategy = "none",
      inputMode = "numeric",
      autoComplete = "one-time-code",
      ...props
    },
    ref
  ) => {
    const handleChange = React.useCallback(
      (next: string) => {
        onChange?.(normalizeOtpCode(next, maxLength))
      },
      [onChange, maxLength]
    )

    const handlePaste = React.useCallback(
      (pasted: string) =>
        (pasteTransformer ?? ((value: string) => normalizeOtpCode(value, maxLength)))(
          pasted
        ),
      [pasteTransformer, maxLength]
    )

    return (
      <OTPInput
        ref={ref}
        maxLength={maxLength}
        pattern={pattern}
        inputMode={inputMode}
        autoComplete={autoComplete}
        pushPasswordManagerStrategy={pushPasswordManagerStrategy}
        pasteTransformer={handlePaste}
        onChange={handleChange}
        containerClassName={cn(
          "flex items-center gap-2 has-[:disabled]:opacity-50",
          containerClassName
        )}
        className={cn(
          "disabled:cursor-not-allowed caret-transparent",
          className
        )}
        {...props}
      />
    )
  }
)
InputOTP.displayName = "InputOTP"

const InputOTPGroup = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex items-center gap-2", className)} {...props} />
))
InputOTPGroup.displayName = "InputOTPGroup"

const InputOTPSlot = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div"> & { index: number }
>(({ index, className, ...props }, ref) => {
  const inputOTPContext = React.useContext(OTPInputContext)
  const { char, isActive } = inputOTPContext.slots[index]

  return (
    <div
      ref={ref}
      data-active={isActive || undefined}
      className={cn(
        "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-input bg-white text-sm font-semibold shadow-sm transition-all",
        isActive && "z-10 border-primary ring-2 ring-primary/30",
        className
      )}
      {...props}
    >
      {/* Digits only — never render input-otp hasFakeCaret (standing blink line). */}
      {char}
    </div>
  )
})
InputOTPSlot.displayName = "InputOTPSlot"

const InputOTPSeparator = React.forwardRef<
  React.ElementRef<"div">,
  React.ComponentPropsWithoutRef<"div">
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <Minus />
  </div>
))
InputOTPSeparator.displayName = "InputOTPSeparator"

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator }
