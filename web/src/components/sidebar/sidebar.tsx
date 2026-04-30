"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Pencil,
  Trash2,
  Settings,
  MessageSquareText,
  Loader2,
  Search,
  Share2,
} from "lucide-react";
import {
  IoSunny,
  IoMoon,
  IoMenu,
  IoAdd,
  IoCheckmark,
  IoClose,
} from "react-icons/io5";
import { Virtuoso } from "react-virtuoso";
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
  "sidebar.rename" as sidebar_rename,
  "sidebar.delete" as sidebar_delete,
  "sidebar.delete_selected" as sidebar_delete_selected,
  "common.success" as common_success,
  "common.error" as common_error,
  "common.loading" as common_loading,
  "sidebar.selected_count" as sidebar_selected_count,
  "common.created_at" as common_created_at,
  "sidebar.delete_toast.loading_title" as sidebar_delete_toast_loading_title,
  "sidebar.delete_toast.loading_desc" as sidebar_delete_toast_loading_desc,
  "sidebar.delete_toast.success_title" as sidebar_delete_toast_success_title,
  "sidebar.delete_toast.success_desc" as sidebar_delete_toast_success_desc,
  "sidebar.delete_toast.error_title" as sidebar_delete_toast_error_title,
  "sidebar.delete_toast.error_desc" as sidebar_delete_toast_error_desc,
  "sidebar.delete_toast.bulk_loading_title" as sidebar_delete_toast_bulk_loading_title,
  "sidebar.delete_toast.bulk_loading_desc" as sidebar_delete_toast_bulk_loading_desc,
  "sidebar.delete_toast.bulk_success_title" as sidebar_delete_toast_bulk_success_title,
  "sidebar.delete_toast.bulk_success_desc" as sidebar_delete_toast_bulk_success_desc,
  "sidebar.delete_toast.bulk_error_title" as sidebar_delete_toast_bulk_error_title,
  "sidebar.delete_toast.bulk_error_desc" as sidebar_delete_toast_bulk_error_desc,
} from "@/paraglide/messages.js";
import { TenantLogo } from "../tenant-logo/tenant-logo";
import { useInfiniteThreads, useDeleteThreadById, useDeleteThreadsByIds, useUpdateThreadById, useUpdateThreadShare } from '@/lib/chat';
import { infoToast } from '@/components/info-toast/info-toast';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from "@/lib/utils";
import { extractErrorText } from "@/lib/error";
import { useChatUIStore } from '@/lib/chat.store';
import { removeChatInstance } from '@/lib/chat-pool';
import { useTypingText } from '@/hooks/use-typing-text';
import { useSyncLocale } from "@/hooks/use-sync-language";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebarStore } from "@/lib/sidebar.store";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

type SidebarProps = {
  isMobileOverlay?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ isMobileOverlay = false, onClose }: SidebarProps) {
  const navigate = useNavigate()
  const isCollapsed = useSidebarStore((s) => s.isCollapsed);
  const toggleCollapsed = useSidebarStore((s) => s.toggle);
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
  const streamingThreadIds = useChatUIStore((s) => s.streamingThreadIds);
  const unreadThreadIds = useChatUIStore((s) => s.unreadThreadIds);

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
  const {
    data: threadsData,
    isLoading: threadsLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteThreads({ search: debouncedSearch || undefined });

  const threads = threadsData?.pages.flat() ?? [];

  // Add new Thread Title
  const mergedThreads = useMemo(() => {
    const uniqueThreads = [
      ...Object.values(optimisticThreads),
      ...threads,
    ].filter((t, index, self) => index === self.findIndex((x) => x.id === t.id));

    return uniqueThreads.sort(
      (a, b) => getThreadSortTimestamp(b) - getThreadSortTimestamp(a)
    );
  }, [optimisticThreads, threads]);

  useEffect(() => {
    if (!threads.length) return;

    const { removeOptimisticThread } = useChatUIStore.getState();

    threads.forEach((t) => {
      if (t.id) {
        removeOptimisticThread(t.id);
      }
    });
  }, [threadsData]);

  const deleteThreadFn = useDeleteThreadById();
  const deleteThreadsByIdsFn = useDeleteThreadsByIds();
  const updateThreadFn = useUpdateThreadById();
  const updateThreadShareFn = useUpdateThreadShare();
  const [chatToDelete, setChatToDelete] = useState<{
    id: string;
    title: string | null;
  } | null>(null);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);

  // Multi-select state
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const lastClickedIndexRef = useRef<number | null>(null);

  // Clear selection on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedThreadIds.size > 0) {
        setSelectedThreadIds(new Set());
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selectedThreadIds.size]);

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

  const handleShareClick = async (threadId: string, isPublic?: boolean) => {
    const toastId = infoToast.loading({ title: common_loading() });

    try {
      if (!isPublic) {
        await updateThreadShareFn(threadId, { isPublic: true });
      }

      await navigator.clipboard.writeText(
        `${window.location.origin}/chat?id=${encodeURIComponent(threadId)}`,
      );

      infoToast.success(toastId, { title: common_success() });
    } catch (error) {
      infoToast.error(toastId, {
        title: common_error(),
        description: extractErrorText(error),
      });
    }
  };

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedThreadIds.size === 0) return;
    setBulkDeleteIds([...selectedThreadIds]);
  }, [selectedThreadIds]);

  const confirmDelete = async () => {
    if (!chatToDelete) return;

    const deletedThreadId = chatToDelete.id;
    setChatToDelete(null);

    const toastId = infoToast.loading({
      title: sidebar_delete_toast_loading_title(),
      description: sidebar_delete_toast_loading_desc(),
    });

    try {
      await deleteThreadFn(deletedThreadId);
      removeChatInstance(deletedThreadId);

      infoToast.success(toastId, {
        title: sidebar_delete_toast_success_title(),
        description: sidebar_delete_toast_success_desc(),
      });

      if (deletedThreadId === activeThreadId) {
        useChatUIStore.getState().startNewChat();
        navigate({ to: '/chat', search: { id: undefined } });
      }

      await queryClient.invalidateQueries({
        queryKey: ['chat-threads'],
      });
    } catch (error) {
      infoToast.error(toastId, {
        title: sidebar_delete_toast_error_title(),
        description: extractErrorText(error) ?? sidebar_delete_toast_error_desc(),
      });

      await queryClient.invalidateQueries({
        queryKey: ['chat-threads'],
      });
    }
  };

  const confirmBulkDelete = async () => {
    if (!bulkDeleteIds || bulkDeleteIds.length === 0) return;

    const idsToDelete = [...bulkDeleteIds];
    const count = String(idsToDelete.length);
    setBulkDeleteIds(null);
    setSelectedThreadIds(new Set());

    const toastId = infoToast.loading({
      title: sidebar_delete_toast_bulk_loading_title({ count }),
      description: sidebar_delete_toast_bulk_loading_desc(),
    });

    try {
      await deleteThreadsByIdsFn(idsToDelete);
      idsToDelete.forEach((id) => removeChatInstance(id));

      infoToast.success(toastId, {
        title: sidebar_delete_toast_bulk_success_title({ count }),
        description: sidebar_delete_toast_bulk_success_desc(),
      });

      if (activeThreadId && idsToDelete.includes(activeThreadId)) {
        useChatUIStore.getState().startNewChat();
        navigate({ to: '/chat', search: { id: undefined } });
      }

      await queryClient.invalidateQueries({
        queryKey: ['chat-threads'],
      });
    } catch (error) {
      infoToast.error(toastId, {
        title: sidebar_delete_toast_bulk_error_title(),
        description: extractErrorText(error) ?? sidebar_delete_toast_bulk_error_desc(),
      });

      await queryClient.invalidateQueries({
        queryKey: ['chat-threads'],
      });
    }
  };

  const handleThreadClick = (e: React.MouseEvent, chat: { id: string | null }, index: number) => {
    if (!chat.id) return;
    if (editingChatId === chat.id) return;

    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isCtrl) {
      // Toggle individual selection
      e.preventDefault();
      setSelectedThreadIds((prev) => {
        const next = new Set(prev);
        if (next.has(chat.id!)) {
          next.delete(chat.id!);
        } else {
          next.add(chat.id!);
        }
        return next;
      });
      lastClickedIndexRef.current = index;
      return;
    }

    if (isShift && lastClickedIndexRef.current !== null) {
      // Range selection
      e.preventDefault();
      const start = Math.min(lastClickedIndexRef.current, index);
      const end = Math.max(lastClickedIndexRef.current, index);
      setSelectedThreadIds((prev) => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) {
          const thread = mergedThreads[i];
          if (thread?.id) {
            next.add(thread.id);
          }
        }
        return next;
      });
      return;
    }

    // Normal click — clear selection and navigate
    if (selectedThreadIds.size > 0) {
      setSelectedThreadIds(new Set());
    }
    lastClickedIndexRef.current = index;
    handleSelectChat(chat.id);
  };

  const handleThreadContextMenu = (chat: { id: string | null }, index: number) => {
    if (!chat.id) return;

    // If right-clicking a thread not in current selection, select only it
    if (!selectedThreadIds.has(chat.id)) {
      setSelectedThreadIds(new Set([chat.id]));
      lastClickedIndexRef.current = index;
    }
  };

  const handleSelectChat = (threadId: string | null) => {
    if (!threadId) startNewChat();
    else hydrateChat(threadId);

    navigate({ to: '/chat', search: { id: undefined } });
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
      <div className="flex flex-col justify-between h-full p-4 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-lg rounded-r-2xl pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]" data-tour="sidebar">
          {/* Header */}
          <div className="mb-3 pb-3 min-h-12 flex items-center w-full justify-between border-b border-sidebar-border">
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
                onClick={toggleCollapsed}
                data-tour="sidebar-toggle"
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
              className="w-full mb-4 flex items-center gap-2 cursor-pointer border-dashed border-sidebar-primary/50 hover:border-sidebar-primary hover:bg-sidebar-primary/5 transition-all duration-200"
              onClick={() => handleSelectChat(null)}
            >
              <IoAdd className="w-5 h-5" />
              {sidebar_new_chat()}
            </Button>
          )}

          {/* Search chats */}
          {!effectiveCollapsed && (
            <div className="mb-3 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
              <Input
                placeholder={sidebar_search()}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 text-sm bg-transparent pl-8 pr-8"
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

          {/* Selection indicator */}
          {!effectiveCollapsed && selectedThreadIds.size > 0 && (
            <div className="mb-2 px-3 py-1.5 rounded-lg bg-primary/10 text-xs text-primary flex items-center justify-between">
              <span>{sidebar_selected_count({ count: String(selectedThreadIds.size) })}</span>
              <button
                onClick={() => setSelectedThreadIds(new Set())}
                className="text-primary/70 hover:text-primary cursor-pointer transition-colors"
              >
                <IoClose className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Lista de chats */}
          {!effectiveCollapsed && (
            <div className="flex-1 min-h-0 mb-4 overflow-x-hidden" data-tour="sidebar-threads">
              {threadsLoading && (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 rounded-lg flex items-center"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="h-8 w-full bg-muted/70 rounded-lg animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!threadsLoading && mergedThreads.length === 0 && (
                <div
                  onClick={() => handleSelectChat(null)}
                  className={cn(
                    "px-3 py-2 rounded-lg flex justify-between items-center cursor-pointer group transition-all duration-150 border-l-2",
                    "hover:bg-muted/50 border-transparent"
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <ThreadTitle
                      title={sidebar_new_chat()}
                      isTyping={false}
                      isSaving={false}
                      sidebarWidth={sidebarWidth}
                      createdAt={new Date()}
                    />
                  </div>
                </div>
              )}

              {!threadsLoading && mergedThreads.length > 0 && (
                <Virtuoso
                  data={mergedThreads}
                  endReached={() => {
                    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
                  }}
                  overscan={200}
                  className="scrollbar-thin overflow-x-hidden"
                  style={{ height: '100%' }}
                  itemContent={(index, chat) => {
                    const isSelected = chat.id !== null && selectedThreadIds.has(chat.id);
                    const isMultiSelected = selectedThreadIds.size > 1;

                    return (
                      <ContextMenu>
                        <ContextMenuTrigger
                          onContextMenu={() => handleThreadContextMenu(chat, index)}
                          asChild
                        >
                          <div
                            onClick={(e) => handleThreadClick(e, chat, index)}
                            className={cn(
                              "px-3 py-2 rounded-lg flex justify-between items-center cursor-pointer group transition-all duration-150 border-l-2",
                              isSelected
                                ? "bg-primary/15 text-foreground border-primary/40"
                                : chat.id === activeThreadId
                                  ? "bg-sidebar-primary/10 text-foreground font-medium border-sidebar-primary"
                                  : "hover:bg-muted/50 border-transparent"
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
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  {chat.id !== null && streamingThreadIds.has(chat.id) && (
                                    <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-primary" />
                                  )}
                                  {chat.id !== null && chat.id !== activeThreadId && !streamingThreadIds.has(chat.id) && unreadThreadIds.has(chat.id) && (
                                    <span className="w-2 h-2 shrink-0 rounded-full bg-primary ring-2 ring-primary/30" />
                                  )}
                                  <ThreadTitle
                                    title={chat.title ?? sidebar_new_chat()}
                                    isTyping={Boolean(optimisticThreads[chat.id ?? '']?.isTyping)}
                                    isSaving={savingThreads.has(chat.id ?? "")}
                                    sidebarWidth={sidebarWidth}
                                    createdAt={(chat as { createdAt?: Date | string }).createdAt ?? new Date()}
                                  />
                                </div>

                                {chat.id !== null && selectedThreadIds.size === 0 && (
                                  <div className="flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <Pencil
                                      className="text-muted-foreground hover:text-foreground w-4 h-4 cursor-pointer transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditClick(chat.id, chat.title ?? sidebar_new_chat());
                                      }}
                                    />
                                    <Share2
                                      className="text-muted-foreground hover:text-foreground w-4 h-4 cursor-pointer transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleShareClick(chat.id, (chat as { isPublic?: boolean }).isPublic);
                                      }}
                                    />
                                    <Trash2
                                      className="text-muted-foreground hover:text-destructive w-4 h-4 cursor-pointer transition-colors"
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
                        </ContextMenuTrigger>

                        <ContextMenuContent>
                          {isSelected && isMultiSelected ? (
                            /* Bulk context menu */
                            <ContextMenuItem
                              variant="destructive"
                              onClick={handleBulkDeleteClick}
                              className="cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mr-1.5" />
                              {sidebar_delete_selected()} ({selectedThreadIds.size})
                            </ContextMenuItem>
                          ) : (
                            /* Single-item context menu */
                            <>
                              {chat.id !== null && (
                                <>
                                  <ContextMenuItem
                                    onClick={() => handleEditClick(chat.id, chat.title ?? sidebar_new_chat())}
                                    className="cursor-pointer"
                                  >
                                    <Pencil className="w-4 h-4 mr-1.5" />
                                    {sidebar_rename()}
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => handleShareClick(chat.id, (chat as { isPublic?: boolean }).isPublic)}
                                    className="cursor-pointer"
                                  >
                                    <Share2 className="w-4 h-4 mr-1.5" />
                                    Share
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    variant="destructive"
                                    onClick={() => handleDeleteClick(chat)}
                                    className="cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4 mr-1.5" />
                                    {sidebar_delete()}
                                  </ContextMenuItem>
                                </>
                              )}
                            </>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  }}
                  components={{
                    Footer: () =>
                      isFetchingNextPage ? (
                        <div className="flex justify-center py-2">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : null,
                  }}
                />
              )}
            </div>
          )}

          {/* Menú inferior */}
          <TooltipProvider>
            <div className="mt-auto flex flex-col w-full pt-3 border-t border-sidebar-border">

              <motion.div
                key={effectiveCollapsed ? "collapsed" : "expanded"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={cn(
                  "flex w-full p-1 rounded-xl bg-muted/30",
                  effectiveCollapsed
                    ? "flex-col items-center gap-1.5"
                    : "flex-row items-center gap-1.5"
                )}
                data-tour="sidebar-buttons"
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
                <div className={cn(effectiveCollapsed ? "" : "flex-1")} data-tour="settings-button">
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

              <div className="mt-4" data-tour="user-section">
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

      {/* Modal de eliminación — single */}
      <DeleteChatModal
        open={!!chatToDelete}
        chatTitle={chatToDelete?.title}
        onCancel={() => setChatToDelete(null)}
        onConfirm={confirmDelete}
      />

      {/* Modal de eliminación — bulk */}
      <DeleteChatModal
        open={!!bulkDeleteIds && bulkDeleteIds.length > 0}
        bulkCount={bulkDeleteIds?.length}
        onCancel={() => setBulkDeleteIds(null)}
        onConfirm={confirmBulkDelete}
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
        <TooltipTrigger asChild>
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden cursor-pointer">

            <span className="min-w-0 flex-1 truncate">
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

function getThreadSortTimestamp(
  thread: { createdAt?: Date | string; insertedAt?: number }
) {
  if (typeof thread.insertedAt === 'number') {
    return thread.insertedAt;
  }

  if (thread.createdAt instanceof Date) {
    return thread.createdAt.getTime();
  }

  if (typeof thread.createdAt === 'string') {
    const parsedTime = new Date(thread.createdAt).getTime();

    if (!Number.isNaN(parsedTime)) {
      return parsedTime;
    }
  }

  return 0;
}
