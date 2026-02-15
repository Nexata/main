"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Pencil,
  Trash2,
  Settings,
  HelpCircle,
  MessageSquareText,
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
  "sidebar.help" as sidebar_help,
  "sidebar.feedback" as sidebar_feedback
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

export default function Sidebar() {
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
  const inputRef = useRef<HTMLInputElement | null>(null);


  const handleEditClick = (id: string) => {
    setEditingChatId(id);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleEditSave = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;

    try {
      await updateThreadFn(id, { title: newTitle });
      setEditingChatId(null);
    } catch (error) {
      console.error('Failed to update thread', error);
    }
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

  return (
    <>
      <MotionDiv
        className="h-full flex flex-col relative"
        animate={{ width: isCollapsed ? COLLAPSED_WIDTH : sidebarWidth }}
        initial={false}
        transition={
          isResizing
            ? { duration: 0 }
            : { width: { type: "spring", stiffness: 300, damping: 30 } }
        }
      >
        <div className="flex flex-col justify-between h-full p-4 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-md">
          {/* Header */}
          <div className="mb-4 min-h-12 flex items-center w-full justify-between">
            {!isCollapsed && (
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
                <motion.div
                  className="h-8 w-px bg-border"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeInOut", delay: 0.15 }}
                />
                <TenantLogo
                  loading={tenantLoading}
                  logoUrl={myTenant?.logoUrl}
                  displayName={myTenant?.displayName}
                />
              </div>
            )}

            <motion.button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-[var(--sidebar-primary)/20] cursor-pointer transition-colors"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                key={isCollapsed ? "menu" : "close"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ type: "spring", stiffness: 250, damping: 28 }}
              >
                {isCollapsed ? <IoMenu className="w-6 h-6" /> : <IoClose className="w-6 h-6" />}
              </motion.div>
            </motion.button>
          </div>

          {/* Nuevo chat */}
          {!isCollapsed && (
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
          {!isCollapsed && (
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
          {!isCollapsed && (
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
                    onClick={() => handleSelectChat(chat.id)}
                    className={cn(
                      "px-2 py-2 rounded-md flex justify-between items-center cursor-pointer group transition-colors",
                      chat.id === activeThreadId ? "bg-muted text-foreground" : "hover:bg-muted/50"
                    )}
                  >
                    {editingChatId !== null && editingChatId === chat.id ? (
                      <div className="flex items-center w-full">
                        <Input
                          ref={inputRef}
                          defaultValue={chat.title ?? "New Chat"}
                          className="flex-1 bg-transparent border-b border-muted focus:border-primary"
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleEditSave(chat.id, (e.target as HTMLInputElement).value);
                            else if (e.key === "Escape") setEditingChatId(null);
                          }}
                        />
                        <div className="flex gap-2 ml-2">
                          <IoCheckmark
                            className="text-green-500 w-5 h-5 cursor-pointer"
                            onClick={() =>
                              handleEditSave(chat.id, inputRef.current?.value || chat.title || "New Chat")
                            }
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
                        />

                        {chat.id !== null && (
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Pencil
                              className="text-secondary-500 w-4 h-4 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(chat.id);
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
                key={isCollapsed ? "collapsed" : "expanded"}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={cn(
                  "flex w-full",
                  isCollapsed
                    ? "flex-col items-center gap-2"
                    : "flex-row items-center gap-2"
                )}
              >

                {/* Theme */}
                <div className={cn(isCollapsed ? "" : "flex-1")}>
                  <Tooltip>
                    <TooltipTrigger className={cn(isCollapsed ? "" : "w-full block")}>
                      <Button
                        variant="outline"
                        onClick={toggleDarkMode}
                        className={cn(
                          "h-10 rounded-lg cursor-pointer transition-all duration-200",
                          isCollapsed ? "w-10" : "w-full"
                        )}
                      >
                        {theme === "dark" ? (
                          <IoSunny className="w-5 h-5" />
                        ) : (
                          <IoMoon className="w-5 h-5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side={isCollapsed ? "right" : "top"}>
                      {sidebar_theme()}
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Settings */}
                <div className={cn(isCollapsed ? "" : "flex-1")}>
                  <Tooltip>
                    <TooltipTrigger className={cn(isCollapsed ? "" : "w-full block")}>
                      <Button
                        variant="outline"
                        onClick={() => navigate({ to: "/settings" })}
                        className={cn(
                          "h-10 rounded-lg cursor-pointer transition-all duration-200",
                          isCollapsed ? "w-10" : "w-full"
                        )}
                      >
                        <Settings className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side={isCollapsed ? "right" : "top"}>
                      {sidebar_settings()}
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Help */}
                <div className={cn(isCollapsed ? "" : "flex-1")}>
                  <Tooltip>
                    <TooltipTrigger className={cn(isCollapsed ? "" : "w-full block")}>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-10 rounded-lg cursor-pointer transition-all duration-200",
                          isCollapsed ? "w-10" : "w-full"
                        )}
                      >
                        <HelpCircle className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side={isCollapsed ? "right" : "top"}>
                      {sidebar_help()}
                    </TooltipContent>
                  </Tooltip>
                </div>

                {/* Feedback */}
                <div className={cn(isCollapsed ? "" : "flex-1")}>
                  <Tooltip>
                    <TooltipTrigger className={cn(isCollapsed ? "" : "w-full block")}>
                      <Button
                        variant="outline"
                        className={cn(
                          "h-10 rounded-lg cursor-pointer transition-all duration-200",
                          isCollapsed ? "w-10" : "w-full"
                        )}
                      >
                        <MessageSquareText className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side={isCollapsed ? "right" : "top"}>
                      {sidebar_feedback()}
                    </TooltipContent>
                  </Tooltip>
                </div>

              </motion.div>

              <div className="mt-3">
                <UserSection
                  me={me ?? null}
                  collapsed={isCollapsed}
                  loading={meLoading}
                />
              </div>

            </div>
          </TooltipProvider>



        </div>

        {!isCollapsed && (
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
}: {
  title: string;
  isTyping: boolean;
  }) {
  function truncateText(text: string, max = 32) {
    if (text.length <= max) return text;
    return text.slice(0, max - 1) + "…";
  }

  const animated = useTypingText(title, isTyping);
  const visibleText = isTyping ? animated : truncateText(title, 22);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span className="truncate cursor-pointer">
            {visibleText}
          </span>
        </TooltipTrigger>

        <TooltipContent side="bottom" align="start" sideOffset={10} className="max-w-xs">
          {title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
