"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root modal {...props} />;
}

function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger {...props} />;
}

type DialogContentProps = DialogPrimitive.Popup.Props & {
  /** Botão X canto superior direito (acessível via Dialog.Close). */
  showCloseButton?: boolean;
};

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...popupProps
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className={cn(
          "fixed inset-0 z-250 bg-black/55 backdrop-blur-[1px]",
          "transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
        )}
      />
      <DialogPrimitive.Popup
        data-slot="dialog-popup"
        className={cn(
          "fixed top-1/2 left-1/2 z-260 flex max-h-[min(88dvh,calc(100vh-2rem))] w-[min(100vw-1.5rem,28rem)] -translate-x-1/2 -translate-y-1/2 flex-col",
          "rounded-2xl border border-cifra-border bg-cifra-surface shadow-[0_24px_80px_rgba(0,0,0,0.55)] outline-none",
          "transition-[opacity,transform] duration-200 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
          className,
        )}
        {...popupProps}
      >
        {showCloseButton ? (
          <DialogPrimitive.Close
            type="button"
            className="absolute top-3 right-3 z-10 rounded-lg p-2 text-cifra-muted outline-none transition-colors hover:bg-white/6 hover:text-cifra-text focus-visible:ring-2 focus-visible:ring-cifra-teal/40"
            aria-label="Fechar"
          >
            <X className="size-4 shrink-0" strokeWidth={2} aria-hidden />
          </DialogPrimitive.Close>
        ) : null}
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col gap-1 border-b border-white/8 px-5 pb-4 pr-14 pt-5 text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 border-t border-white/8 px-5 py-4 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn("text-[15px] font-semibold leading-snug tracking-tight text-cifra-text", className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn("text-[11px] leading-snug text-cifra-muted", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
export type { DialogContentProps };
