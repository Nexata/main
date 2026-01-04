import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { FilePreview } from "@/components/ui/file-preview";
import { updateMe, type Me } from "@/lib/user";
import * as m from "@/paraglide/messages.js";
import { AsyncConfirmButton } from "../async-confirm-button/async-confirm-button";

export default function UserSection({
    me,
    collapsed,
    onSave,
}: {
    me: NonNullable<Me>;
    collapsed: boolean;
    onSave: (me: NonNullable<Me>) => void;
}) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [displayName, setDisplayName] = useState(me.displayName ?? "");
    const [file, setFile] = useState<File | null>(null);

    const size = collapsed ? 28 : 32;

    function stringToColor(str: string) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
    }

    async function handleSave() {
        try {
        setSaving(true);

        const updated = await updateMe({
            displayName,
            pfp: file ?? undefined,
        });

        // TODO: Ver como hacer para que no se cierre inmediato y ver la animacion de Ok

        setOpen(false);
        setFile(null);
        onSave(updated);
        } finally {
        setSaving(false);
        }
    }

    return (
        <div className="relative">
            {/* User row */}
            <motion.div
                onClick={() => {
                if (saving) return;
                setOpen((v) => !v);
                }}
                whileHover={{ scale: 1.02 }}
                className={`
                mt-2 rounded-lg p-2 flex items-center gap-3 cursor-pointer
                hover:bg-[var(--muted)/60] transition-colors
                ${collapsed ? "justify-center" : ""}
                `}
            >
                {me.pfpUrl ? (
                    <img
                        src={me.pfpUrl}
                        alt={me.displayName ?? me.email}
                        className="rounded-full object-cover aspect-square shrink-0"
                        style={{
                        width: size,
                        height: size,
                        minWidth: size,
                        minHeight: size,
                        }}
                    />
                ) : (
                    <div
                        className="rounded-full flex items-center justify-center text-white font-medium shrink-0 aspect-square"
                        style={{
                        width: size,
                        height: size,
                        minWidth: size,
                        minHeight: size,
                        backgroundColor: stringToColor(me.displayName ?? me.email),
                        fontSize: size * 0.45,
                        }}
                    >
                        {(me.displayName ?? me.email)[0]?.toUpperCase()}
                    </div>
                )}

                {!collapsed && (
                    <div className="min-w-0">
                        <div className="font-semibold truncate">{me.displayName ?? m["common.user"]()}</div>
                        <div className="text-xs opacity-60 truncate">{me.email}</div>
                    </div>
                )}
            </motion.div>

            {/* Backdrop (click fuera) */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="backdrop"
                        className="fixed inset-0 z-40"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => {
                        if (saving) return;
                        setOpen(false);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Popover */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="popover"
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="
                        absolute bottom-full left-0 mb-2 w-72 rounded-xl p-4
                        bg-[var(--popover)] border border-[var(--border)]
                        shadow-lg z-50
                        "
                    >
                        <div className="flex flex-col gap-3">
                            <div className="text-sm font-semibold text-center">
                                {m["user.profile.title"]()}
                            </div>

                            <Separator />

                            <Input
                                placeholder={m["user.profile.display_name_placeholder"]()}
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                            />

                            {file ? (
                                <FilePreview file={file} onRemove={() => setFile(null)} />
                            ) : (
                                <Input
                                type="file"
                                className="cursor-pointer"
                                accept="image/*"
                                onChange={(e) =>
                                    setFile(e.target.files?.[0] ?? null)
                                }
                                />
                            )}

                            <AsyncConfirmButton
                                size="sm"
                                className="mt-2 w-full"
                                onClick={handleSave}
                            >
                                {m["common.save_changes"]()}
                            </AsyncConfirmButton>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
