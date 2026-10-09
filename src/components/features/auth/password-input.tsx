"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PasswordInputProps = Omit<React.ComponentProps<"input">, "type">;

/**
 * A password field with a "Vis password" toggle (handy on a phone in a dim
 * pub). The toggle is a 44 px button inside the field's right edge.
 */
export function PasswordInput({ className, id, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        className={cn("pr-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label="Vis password"
        aria-pressed={visible}
        aria-controls={id}
        className="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center rounded-r-lg text-slate transition-colors hover:text-olive"
      >
        {visible ? (
          <EyeOffIcon aria-hidden className="size-5" />
        ) : (
          <EyeIcon aria-hidden className="size-5" />
        )}
      </button>
    </div>
  );
}
