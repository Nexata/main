import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import type { Me } from "@/lib/user";

export default function UserSection({
    me,
    collapsed,
    loading,
}: {
    me: Me | null;
    collapsed: boolean;
    loading?: boolean;
}) {
    const navigate = useNavigate();
    const size = collapsed ? 28 : 32;

    function stringToColor(str: string) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        return `hsl(${Math.abs(hash) % 360}, 65%, 55%)`;
    }

    // Skeleton
    if (loading) {
        return (
            <div className={`mt-2 rounded-lg p-2 flex items-center gap-3 ${ collapsed ? "justify-center" : "" }`}>
                <div
                    className="rounded-full bg-muted animate-pulse shrink-0"
                    style={{
                        width: size,
                        height: size,
                        minWidth: size,
                        minHeight: size,
                    }}
                />

                {!collapsed && (
                    <div className="flex-1 space-y-1">
                        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                        <div className="h-3 w-32 bg-muted rounded animate-pulse opacity-60" />
                    </div>
                )}
            </div>
        );
    }

    if (!me) return null;

    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate({ to: "/user" })}
            className={`mt-2 rounded-lg p-2 flex items-center gap-3 cursor-pointer hover:bg-[var(--muted)/60] transition-colors ${collapsed ? "justify-center" : ""}`}>
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
                        backgroundColor: stringToColor(
                        me.displayName ?? me.email ?? ""
                        ),
                        fontSize: size * 0.45,
                    }}
                >
                    {(me.displayName ?? me.email)[0]?.toUpperCase()}
                </div>
            )}

            {!collapsed && (
                <div className="min-w-0">
                    <div className="font-semibold truncate">{me.displayName ?? "User"}</div>
                    <div className="text-xs opacity-60 truncate">{me.email}</div>
                </div>
            )}
        </motion.div>
    );
}
