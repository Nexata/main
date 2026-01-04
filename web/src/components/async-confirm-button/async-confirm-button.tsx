import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AsyncConfirmButtonProps = {
    onClick: () => Promise<void>;
    children: React.ReactNode;
    successDuration?: number;
    size?: "sm" | "default" | "lg";
    variant?: "default" | "outline";
    className?: string;
};

type State = "idle" | "loading" | "success";

export function AsyncConfirmButton({
    onClick,
    children,
    successDuration = 2000,
    size = "sm",
    variant = "outline",
    className,
}: AsyncConfirmButtonProps) {
    const [state, setState] = useState<State>("idle");

    async function handleClick() {
        if (state !== "idle") return;

        try {
            setState("loading");
            await onClick();
            setState("success");

            setTimeout(() => {
                setState("idle");
            }, successDuration);
        } catch {
            setState("idle");
        }
    }

    return (
        <Button
        size={size}
        variant={variant}
        disabled={state !== "idle"}
        onClick={handleClick}
        className={cn(
            "min-w-[150px] transition-colors cursor-pointer",
            state === "success" &&
            `
                bg-emerald-500
                border-emerald-500
                text-white
                hover:bg-emerald-500
                dark:bg-emerald-500
                dark:border-emerald-500
                dark:text-white
                dark:hover:bg-emerald-500
            `,
            className
        )}
        >
        <AnimatePresence mode="wait" initial={false}>
            {state === "loading" && (
                <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center"
                >
                    <Loader2 className="h-4 w-4 animate-spin" />
                </motion.span>
            )}

            {state === "success" && (
                <motion.span
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center justify-center"
                >
                    <Check className="h-4 w-4" />
                </motion.span>
            )}

            {state === "idle" && (
                <motion.span
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center"
                >
                    {children}
                </motion.span>
            )}
        </AnimatePresence>
        </Button>
    );
}
