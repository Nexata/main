"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Pencil,
  Trash2,
  Settings,
  MessageSquareText,
  Loader2
} from "lucide-react";
import {
  IoSunny,
  IoMoon,
  IoMenu,
  IoAdd,
  IoCheckmark,
  IoClose,
} from "react-icons/io5";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DeleteChatModal from "./delete-chat.modal";
import { useTheme } from "../theme-provider";
import { useNavigate } from "@tanstack/react-router";
import { useMe, useMyTenant } from "@/lib/user";
import UserSection from "../user-section/user-section";
import {
  "sidebar.new_chat" as sidebar_new_chat,
  "sidebar.search" as sidebar_search,
  "sidebar.theme" as sidebar_theme,
  "sidebar.settings" as sidebar_settings,
  "sidebar.feedback" as sidebar_feedback,
  "common.created_at" as common_created_at,
} from "@/paraglide/messages.js";
import { TenantLogo } from "../tenant-logo/tenant-logo";
import { useThreads, useDeleteThreadById, useUpdateThreadById } from '@/lib/chat';
import { infoToast } from '@/components/info-toast/info-toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from "@/lib/utils";
import { useChatUIStore } from '@/lib/chat.store';
import { useTypingText } from '@/hooks/use-typing-text';
import { useSyncLocale } from "@/hooks/use-sync-language";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type SidebarProps = {
  isMobileOverlay?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ isMobileOverlay = false, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const [isCollapsed, setIsCollapsed] = useState(false);
  useSyncLocale();
  const queryClient = useQueryClient();

  // Sidebar Sizes + Resizing Effect
  const MIN_WIDTH = 220;
  const MAX_WIDTH = 320;
  const COLLAPSED_WIDTH = 60;
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (!isResizing) return;

    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    let raf: number;

    const handleMouseMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);

      raf = requestAnimationFrame(() => {
        const newWidth = Math.min(
          Math.max(e.clientX, MIN_WIDTH),
          MAX_WIDTH
        );

        setSidebarWidth(newWidth);
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      cancelAnimationFrame(raf);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Chat Status
  const { startNewChat, hydrateChat } = useChatUIStore();

  // Search
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(t);
  }, [search]);

  // Get active thread only if /chat is active
  const activeThreadId = useChatUIStore((s) => s.activeThreadId);
  // New Thread Title
  const optimisticThreads = useChatUIStore((s) => s.optimisticThreads);
  // Get Threads
  const { data: threads, isLoading: threadsLoading } = useThreads({ search: debouncedSearch || undefined });

  // Add new Thread Title
  const mergedThreads = [
    ...Object.values(optimisticThreads),
    ...(threads ?? []),
  ].filter((t, index, self) => index === self.findIndex((x) => x.id === t.id));

  useEffect(() => {
    if (!threads) return;

    const { removeOptimisticThread } = useChatUIStore.getState();

    threads.forEach((t) => {
      if (t.id) {
        removeOptimisticThread(t.id);
      }
    });
  }, [threads]);

  const deleteThreadFn = useDeleteThreadById();
  const updateThreadFn = useUpdateThreadById();
  const [chatToDelete, setChatToDelete] = useState<{
    id: string;
    title: string | null;
  } | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);

  // Edit Thread
  const [editingTitle, setEditingTitle] = useState("");
  const [savingThreads, setSavingThreads] = useState<Set<string>>(new Set());

  const handleEditClick = (id: string, currentTitle: string) => {
    setEditingChatId(id);
    setEditingTitle(currentTitle);
  };

  const handleEditSave = (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;

    setEditingChatId(null);
    setSavingThreads(prev => new Set(prev).add(id));

    updateThreadFn(id, { title: newTitle })
      .catch((error) => {
        console.error("Failed to update thread", error);
      })
      .finally(() => {
        setSavingThreads(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  };


  const handleDeleteClick = (chat: { id: string; title: string | null }) => setChatToDelete(chat);

  const confirmDelete = async () => {
    if (!chatToDelete) return;

    const deletedThreadId = chatToDelete.id;
    setChatToDelete(null);

    const toastId = infoToast.loading({
      title: 'Deleting chat...',
      description: 'Please wait while we delete the conversation.',
    });

    try {
      await deleteThreadFn(deletedThreadId);

      infoToast.success(toastId, {
        title: 'Chat deleted',
        description: 'The conversation was deleted successfully.',
      });

      if (deletedThreadId === activeThreadId) {
        useChatUIStore.getState().startNewChat();
        navigate({ to: '/chat' });
      }

      await queryClient.invalidateQueries({
        queryKey: ['chat-threads'],
      });
    } catch (error) {
      infoToast.error(toastId, {
        title: 'Failed to delete chat',
        description: 'Something went wrong while deleting the conversation.',
      });

      await queryClient.invalidateQueries({
        queryKey: ['chat-threads'],
      });
    }
  };

  const handleSelectChat = (threadId: string | null) => {
    if (!threadId) startNewChat();
    else hydrateChat(threadId);

    navigate({ to: '/chat' });
    if (isMobileOverlay && onClose) onClose();
  };

  // Theme Switch
  const MotionDiv = motion.div;
  const { theme, setTheme } = useTheme();
  const toggleDarkMode = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // User + Tenant info
  const { data: me, isLoading: meLoading } = useMe();
  const { data: myTenant, isLoading: tenantLoading } = useMyTenant();

  // In mobile overlay mode, always show expanded at full width
  const effectiveCollapsed = isMobileOverlay ? false : isCollapsed;

  return (
    <>
      <MotionDiv
        className="h-full flex flex-col relative"
        animate={isMobileOverlay ? { width: "100%" } : { width: effectiveCollapsed ? COLLAPSED_WIDTH : sidebarWidth }}
        initial={false}
        transition={
          isMobileOverlay
            ? { duration: 0 }
            : isResizing
              ? { duration: 0 }
              : { width: { type: "spring", stiffness: 300, damping: 30 } }
        }
      >
        <div className="flex flex-col justify-between h-full p-4 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-md">
          {/* Header */}
          <div className="mb-4 min-h-12 flex items-center w-full justify-between">
            {!effectiveCollapsed && (
              <div className="flex items-center gap-4">
                <motion.img
                  src="/nexata_logo.png"
                  alt="Nexata"
                  className="h-7 w-auto object-contain"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                />

                {myTenant?.logoUrl && (
                  <>
                    <motion.div
                      className="h-8 w-px bg-border"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: "easeInOut", delay: 0.15 }}
                    />
                    <TenantLogo
                      loading={tenantLoading}
                      logoUrl={myTenant.logoUrl}
                      displayName={myTenant.displayName}
                    />
                  </>
                )}
              </div>
            )}

            {isMobileOverlay ? (
              <motion.button
                onClick={onClose}
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-[var(--sidebar-primary)/20] cursor-pointer transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <IoClose className="w-6 h-6" />
              </motion.button>
            ) : (
              <motion.button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-[var(--sidebar-primary)/20] cursor-pointer transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  key={effectiveCollapsed ? "menu" : "close"}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 250, damping: 28 }}
                >
                  {effectiveCollapsed ? <IoMenu className="w-6 h-6" /> : <IoClose className="w-6 h-6" />}
                </motion.div>
              </motion.button>
            )}
          </div>

          {/* Nuevo chat */}
          {!effectiveCollapsed && (
            <Button
              variant="outline"
              className="w-full mb-4 flex items-center gap-2 cursor-pointer"
              onClick={() => handleSelectChat(null)}
            >
              <IoAdd className="w-5 h-5" />
              {sidebar_new_chat()}
            </Button>
          )}

          {/* Search chats */}
          {!effectiveCollapsed && (
            <div className="mb-3 relative">
              <Input
                placeholder={sidebar_search()}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-sm bg-transparent pr-8"
              />

              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="
                  absolute right-2 top-1/2 -translate-y-1/2
                  text-muted-foreground
                  hover:text-foreground
                  transition-colors
                  cursor-pointer
                  "
                >
                  <IoClose className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Lista de chats */}
          {!effectiveCollapsed && (
            <div className="flex-1 overflow-y-auto mb-4 scrollbar-thin">
              <div className="flex flex-col gap-2">
                {threadsLoading && (
                  <>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="px-2 py-2 rounded-md flex items-center"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="h-8 w-full bg-muted rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {!threadsLoading && ((mergedThreads.length > 0 ? mergedThreads : [{ id: null, title: sidebar_new_chat(), createdAt: new Date() }]).map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      if (editingChatId === chat.id) return;
                      handleSelectChat(chat.id);
                    }}
                    className={cn(
                      "px-2 py-2 rounded-md flex justify-between items-center cursor-pointer group transition-colors",
                      chat.id === activeThreadId ? "bg-muted text-foreground" : "hover:bg-muted/50"
                    )}
                  >
                    {editingChatId !== null && editingChatId === chat.id ? (
                      <div className="flex items-center w-full">
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          autoFocus
                          className="flex-1 bg-transparent border-b border-muted focus:border-primary"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave(chat.id, editingTitle);
                            else if (e.key === "Escape") setEditingChatId(null);
                          }}
                        />
                        <div className="flex gap-2 ml-2">
                          <IoCheckmark
                            className="text-green-500 w-5 h-5 cursor-pointer"
                            onClick={() => handleEditSave(chat.id, editingTitle)}
                          />
                          <IoClose
                            className="text-red-500 w-5 h-5 cursor-pointer"
                            onClick={() => setEditingChatId(null)}
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <ThreadTitle
                          title={chat.title ?? "New Chat"}
                          isTyping={Boolean(optimisticThreads[chat.id ?? '']?.isTyping)}
                          isSaving={savingThreads.has(chat.id ?? "")}
                          sidebarWidth={sidebarWidth}
                          createdAt={(chat as { createdAt?: Date | string }).createdAt ?? new Date()}
                        />

                        {chat.id !== null && (
                          <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <Pencil
                              className="text-secondary-500 w-4 h-4 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(chat.id, chat.title ?? "New Chat");
                              }}
                            />
                            <Trash2
                              className="text-error-500 w-4 h-4 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(chat);
                              }}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )))}
              </div>
            </div>
          )}

          {/* Menú inferior */}
          <TooltipProvider>
            <div className="mt-auto flex flex-col w-full">

              <motion.div
                key={effectiveCollapsed ? "collapsed" : "expanded"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={cn(
                  "flex w-full",
                  effectiveCollapsed
                    ? "flex-col items-center gap-2"
                    : "flex-row items-center gap-2"
                )}
              >

                {/* Theme */}
                <div className={cn(effectiveCollapsed ? "" : "flex-1")}>
                  <Tooltip>
                    <TooltipTrigger className={cn(effectiveCollapsed ? "" : "w-full block")}>
                      <Button
                        variant="outline"
                        onClick={toggleDarkMode}
                        className={cn(
                          "h-10 rounded-lg cursor-pointer transition-all duration-200",
                          effectiveCollapsed ? "w-10" : "w-full"
                        )}
                      >
                        {theme === "dark" ? (
                          <IoSunny className="w-5 h-5" />
                        ) : (
                          <IoMoon className="w-5 h-5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side={effectiveCollapsed ? "right" : "top"}>
                      {sidebar_theme()}
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Settings */}
                <div className={cn(effectiveCollapsed ? "" : "flex-1")}>
                  <Tooltip>
                    <TooltipTrigger className={cn(effectiveCollapsed ? "" : "w-full block")}>
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigate({ to: "/settings" });
                          if (isMobileOverlay && onClose) onClose();
                        }}
                        className={cn(
                          "h-10 rounded-lg cursor-pointer transition-all duration-200",
                          effectiveCollapsed ? "w-10" : "w-full"
                        )}
                      >
                        <Settings className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side={effectiveCollapsed ? "right" : "top"}>
                      {sidebar_settings()}
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Feedback */}
                <div className={cn(effectiveCollapsed ? "" : "flex-1")}>
                  <Tooltip>
                    <TooltipTrigger className={cn(effectiveCollapsed ? "" : "w-full block")}>
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigate({ to: "/feedback" });
                          if (isMobileOverlay && onClose) onClose();
                        }}
                        className={cn(
                          "h-10 rounded-lg cursor-pointer transition-all duration-200",
                          effectiveCollapsed ? "w-10" : "w-full"
                        )}
                      >
                        <MessageSquareText className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side={effectiveCollapsed ? "right" : "top"}>
                      {sidebar_feedback()}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </motion.div>

              <div className="mt-4">
                <UserSection
                  me={me ?? null}
                  collapsed={effectiveCollapsed}
                  loading={meLoading}
                />
              </div>

            </div>
          </TooltipProvider>
        </div>

        {!effectiveCollapsed && !isMobileOverlay && (
          <div
            onMouseDown={() => setIsResizing(true)}
            className="
            absolute right-0 top-0 h-full w-1.5
            cursor-col-resize
            group
            "
          >
            <div
              className="
              h-full w-full
              bg-transparent
              group-hover:bg-primary/20
              transition-colors
              "
            />
          </div>
        )}
      </MotionDiv>

      {/* Modal de eliminación */}
      <DeleteChatModal
        open={!!chatToDelete}
        chatTitle={chatToDelete?.title}
        onCancel={() => setChatToDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function ThreadTitle({
  title,
  isTyping,
  isSaving,
  sidebarWidth,
  createdAt,
}: {
  title: string;
  isTyping: boolean;
  isSaving: boolean;
  sidebarWidth: number;
  createdAt: Date | string;
}) {
  function truncateText(text: string, max = 32) {
    if (text.length <= max) return text;
    return text.slice(0, max - 1) + "…";
  }

  const animated = useTypingText(title, isTyping);
  const extraChars = sidebarWidth > 250 ? Math.floor((sidebarWidth - 250) / 12) : 0;
  const maxChars = Math.floor((sidebarWidth - 80) / 8) + extraChars;
  const visibleText = truncateText(isTyping ? animated : title, maxChars);

  const formattedDate = new Date(createdAt).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className="flex items-center gap-2 min-w-0 cursor-pointer">

            <span className="truncate">
              {visibleText}
            </span>

            <div
              className={`
              w-4 h-4 shrink-0
              transition-all duration-200 ease-out
              ${isSaving ? "opacity-100 scale-100" : "opacity-0 scale-75"}
              `}
            >
              <Loader2 className="w-4 h-4 animate-spin opacity-70" />
            </div>

          </div>
        </TooltipTrigger>

        <TooltipContent
        side="bottom"
        align="start"
        sideOffset={10}
        className="max-w-xs"
        >
          <p>{title}</p>
          <p className="text-xs text-muted-foreground">{common_created_at()}: {formattedDate}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
