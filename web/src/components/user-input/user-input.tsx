"use client";
import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import * as m from "@/paraglide/messages.js";
import { cn } from "@/lib/utils";
import { getUsers, type Users } from "@/lib/user";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type User = NonNullable<Users>[number];

type UserInputProps = {
    value?: string;
    onChange?: (userId: string, user: User) => void;
    disabled?: boolean;
};

export default function UserInput({
    value,
    onChange,
    disabled,
}: UserInputProps) {
    const [open, setOpen] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const fetchedRef = useRef(false);

    /** Fetch users once, on first interaction */
    const fetchUsers = async () => {
        if (fetchedRef.current || loading) return;

        try {
        setLoading(true);
        const result = await getUsers();
        setUsers(result ?? []);
        fetchedRef.current = true;
        } finally {
        setLoading(false);
        }
    };

    const selectedUser = useMemo(
        () => users.find((u) => u.id === value),
        [users, value]
    );

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger>
                <Button
                    variant="outline"
                    role="combobox"
                    disabled={disabled}
                    aria-expanded={open}
                    onClick={fetchUsers}
                    className={cn(
                        "w-full justify-between h-auto px-3 py-3 font-normal items-center",
                        !selectedUser && "text-muted-foreground"
                    )}
                >
                    {selectedUser ? (
                        <div className="flex items-center gap-3 truncate">
                            <Avatar user={selectedUser} />
                            <div className="flex flex-col truncate text-left">
                                <span className="truncate text-sm">{selectedUser.displayName ?? selectedUser.email}</span>
                                {selectedUser.displayName && (
                                    <span className="truncate text-xs text-muted-foreground">{selectedUser.email}</span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <span>{m["user_input.placeholder"]()}</span>
                    )}

                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput
                        placeholder={m["user_input.search"]()}
                        autoFocus
                    />

                    <CommandList>
                        {loading && (
                            <div className="py-6 text-center text-sm text-muted-foreground">{m["common.loading"]()}</div>
                        )}

                        {!loading && (
                            <CommandEmpty>{m["user_input.no_results"]()}</CommandEmpty>
                        )}

                        <CommandGroup>
                            {users.map((user) => {
                                const label = user.displayName ?? user.email;

                                return (
                                    <CommandItem
                                        key={user.id}
                                        value={`${label} ${user.email}`}
                                        onSelect={() => {
                                        onChange?.(user.id, user);
                                        setOpen(false);
                                        }}
                                        className="flex items-center gap-3"
                                    >
                                        <Check className={cn("h-4 w-4", value === user.id ? "opacity-100" : "opacity-0")}/>
                                        <Avatar user={user} />
                                        <div className="flex flex-col truncate">
                                            <span className="truncate text-sm">{label}</span>
                                            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}


function Avatar({ user }: { user: User }) {
    return (
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-muted flex items-center justify-center">
            {user.pfpUrl ? (
                <img
                    src={user.pfpUrl}
                    alt={user.displayName ?? user.email}
                    className="h-full w-full object-cover"
                />
            ) : (
                <span className="text-xs font-medium text-muted-foreground">
                    {(user.displayName ?? user.email).charAt(0).toUpperCase()}
                </span>
            )}
        </div>
    );
}
