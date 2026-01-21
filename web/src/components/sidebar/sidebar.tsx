"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  IoSunny,
  IoMoon,
  IoSettings,
  IoMenu,
  IoAdd,
  IoTrash,
  IoCreate,
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
import { "sidebar.new_chat" as sidebar_new_chat} from "@/paraglide/messages.js";
import { TenantLogo } from "../tenant-logo/tenant-logo";

export default function Sidebar() {
  const navigate = useNavigate()
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [editingChatId, setEditingChatId] = useState<number | null>(null);
  const [chats, setChats] = useState([
    { id: 1, title: "Chat con Juan" },
    { id: 2, title: "Proyecto Marketing" },
    { id: 3, title: "Equipo Dev" },
    { id: 4, title: "Ventas" },
    { id: 5, title: "Soporte Técnico" },
    { id: 6, title: "Soporte Técnico" },
    { id: 7, title: "Soporte Técnico" },
    { id: 8, title: "Soporte Técnico" },
    { id: 9, title: "Soporte Técnico" },
  ]);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleEditClick = (id: number) => {
    setEditingChatId(id);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleEditSave = (id: number, newTitle: string) => {
    setChats(chats.map((chat) => (chat.id === id ? { ...chat, title: newTitle } : chat)));
    setEditingChatId(null);
  };

  const handleDeleteClick = (chat: { id: number; title: string }) =>
    setChatToDelete(chat);

  const confirmDelete = () => {
    if (chatToDelete) {
      setChats(chats.filter((c) => c.id !== chatToDelete.id));
      setChatToDelete(null);
    }
  };

  const sidebarWidth = isCollapsed ? 60 : 250;
  const MotionDiv = motion.div;
  const { theme, setTheme } = useTheme();
  const toggleDarkMode = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  // User info
  const { data: me, isLoading: meLoading } = useMe();

  // Tenant info
  const { data: myTenant, isLoading: tenantLoading } = useMyTenant();

  return (
    <>
      <MotionDiv
        className="h-full flex flex-col"
        animate={{ width: sidebarWidth }}
        initial={{ width: sidebarWidth }}
        transition={{ width: { type: "spring", stiffness: 300, damping: 30 } }}
      >
        <div className="flex flex-col justify-between h-full p-4 bg-[var(--sidebar)] text-[var(--sidebar-foreground)] border-r border-[var(--sidebar-border)] shadow-md">
          {/* Header */}
          <div className="mb-4 min-h-[3rem] flex items-center w-full justify-between">
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
              onClick={() => {}}
            >
              <IoAdd className="w-5 h-5" />
              {sidebar_new_chat()}
            </Button>
          )}

          {/* Lista de chats */}
          {!isCollapsed && (
            <div className="flex-1 overflow-y-auto mb-4 scrollbar-thin">
              <div className="flex flex-col gap-2">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className="px-2 py-2 rounded-md flex justify-between items-center hover:bg-primary/10 cursor-pointer group"
                  >
                    {editingChatId === chat.id ? (
                      <div className="flex items-center w-full">
                        <Input
                          ref={inputRef}
                          defaultValue={chat.title}
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
                              handleEditSave(chat.id, inputRef.current?.value || chat.title)
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
                        <span className="truncate">{chat.title}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <IoCreate
                            className="text-secondary-500 w-5 h-5 cursor-pointer"
                            onClick={() => handleEditClick(chat.id)}
                          />
                          <IoTrash
                            className="text-error-500 w-5 h-5 cursor-pointer"
                            onClick={() => handleDeleteClick(chat)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Menú inferior */}
          <div
            className={`flex flex-col gap-4 transition-all duration-300 ${
              isCollapsed ? "items-center" : "items-stretch"
            }`}
          >
            <Button
              variant="outline"
              size="icon"
              onClick={toggleDarkMode}
              className="w-10 h-10 cursor-pointer transition-colors rounded-lg w-full flex justify-center items-center"
            >
              {theme === "dark" ? (<IoSunny className="w-6 h-6" />) : (<IoMoon className="w-6 h-6" />)}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate({ to: "/settings" })}
              className="w-10 h-10 cursor-pointer transition-colors rounded-lg w-full flex justify-center"
            >
              <IoSettings className="w-6 h-6" />
            </Button>

            <UserSection
              me={me ?? null}
              collapsed={isCollapsed}
              loading={meLoading}
            />
          </div>
        </div>
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


