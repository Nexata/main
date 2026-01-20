"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getMe, type Me } from "@/lib/user";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_private/user")({ component: ProfilePage });

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [pfpUrl, setPfpUrl] = useState("");

  useEffect(() => {
    document.title = "Profile";

    getMe()
      .then((user) => {
        if (!user) return;
        setMe(user);
        setDisplayName(user.displayName ?? "");
        setPfpUrl(user.pfpUrl ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !me) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col gap-6 px-3 py-4 w-full max-w-screen-lg mx-auto"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal information and security
        </p>
      </div>

      <Separator />

      {/* User info */}
      <Card className="bg-[var(--sidebar)]">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-5">
            <Avatar className="h-16 w-16">
              <AvatarImage src={pfpUrl || undefined} />
              <AvatarFallback>
                {me.email.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {displayName || "Unnamed user"}
                </h2>
                {me.isAdmin && <Badge variant="secondary">Admin</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{me.email}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Display name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Profile picture URL
              </label>
              <Input
                value={pfpUrl}
                onChange={(e) => setPfpUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button className="cursor-pointer">
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Devices */}
      <Card className="bg-[var(--sidebar)]">
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Devices</h2>
            <p className="text-sm text-muted-foreground">
              Devices currently logged into your account
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            {me.devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {device.userAgent || "Unknown device"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Added{" "}
                    {new Date(device.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive cursor-pointer"
                  onClick={() => {
                    // TODO: revoke device
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usage */}
      <Card className="bg-[var(--sidebar)]">
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Usage</h2>
            <p className="text-sm text-muted-foreground">
              Messages consumed this month
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm">Messages used</span>
            <span className="text-2xl font-semibold">
              {me.messageCount}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
