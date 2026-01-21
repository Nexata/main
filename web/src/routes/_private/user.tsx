"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useNavigate, createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useMe } from "@/lib/user";
import { AsyncConfirmButton } from "@/components/async-confirm-button/async-confirm-button";
import { FilePreview } from "@/components/ui/file-preview";

export const Route = createFileRoute("/_private/user")({
  component: ProfilePage,
});

export default function ProfilePage() {
	const navigate = useNavigate();

	const { data: me, isLoading: meLoading } = useMe();

	const [editing, setEditing] = useState(false);
	const [displayName, setDisplayName] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const previewUrl = file ? URL.createObjectURL(file) : me?.pfpUrl;

	useEffect(() => {
		document.title = "Profile";
		if (me?.displayName) setDisplayName(me.displayName);
	}, [me]);

	if (meLoading || !me) return null;

	async function handleSave() {
		// TODO: update profile API
		await new Promise((r) => setTimeout(r, 800)); // request
		await new Promise((r) => setTimeout(r, 1000)); // dejar lucir botón
		setEditing(false);
	}

	return (
		<motion.div
		initial={{ opacity: 0, y: 6 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ duration: 0.25, ease: "easeOut" }}
		className="flex flex-col gap-6 px-3 py-4 w-full max-w-screen-2xl mx-auto"
		>
			{/* Header */}
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
					<p className="text-sm text-muted-foreground">Manage your personal information</p>
				</div>

				<Button variant="outline" onClick={() => navigate({ to: "/chat" })}>
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back to chat
				</Button>
			</header>

			<Separator />

			<Card className="bg-[var(--sidebar)]">
				<CardContent className="p-6 space-y-6">
					<div className="flex items-center justify-between gap-6">

						<div className="flex items-center gap-5">
							<Avatar className="h-16 w-16">
								<AvatarImage src={me.pfpUrl ?? undefined} />
								<AvatarFallback>{(me.displayName ?? me.email)[0]?.toUpperCase()}</AvatarFallback>
							</Avatar>

							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<h2 className="text-lg font-semibold">{me.displayName ?? "User"}</h2>
									{me.isAdmin && (<Badge variant="destructive">Admin</Badge>)}
									<Button className="cursor-pointer" size="icon" variant="ghost"	onClick={() => setEditing((v) => !v)}>
										<Pencil className="h-4 w-4" />
									</Button>
								</div>

								<p className="text-sm text-muted-foreground">{me.email}</p>
							</div>
						</div>

						<div className="flex items-center gap-4 rounded-lg border border-border bg-muted/40 px-4 py-2">
							<span className="text-sm text-muted-foreground">Messages</span>
								<Separator orientation="vertical" className="h-6" />
							<span className="text-xl font-semibold leading-none text-primary">{me.messageCount}</span>
						</div>
					</div>

					<AnimatePresence>
						{editing && (
							<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							transition={{ duration: 0.25 }}
							className="overflow-hidden"
							>
								<Separator className="my-6" />

								<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 py-2 px-2">
									<div className="flex flex-col md:flex-row md:items-start gap-6 flex-1">	
										<div className="flex flex-col gap-2">
										<label className="text-sm font-medium">
											Display name
										</label>

										<Input
											className="w-full md:w-64 h-10"
											value={displayName}
											onChange={(e) => setDisplayName(e.target.value)}
										/>
										</div>

										<div className="flex flex-col gap-2">
										<label className="text-sm font-medium">
											Profile image
										</label>

										<div className="flex items-center gap-3 min-h-[40px]">
											<Input
											type="file"
											accept="image/*"
											className="w-56 h-10"
											onChange={(e) =>
												setFile(e.target.files?.[0] ?? null)
											}
											/>

											<div className="flex items-center h-10">
											<AnimatePresence initial={false}>
												{file && (
												<motion.div
													initial={{ opacity: 0, scale: 0.96 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0, scale: 0.96 }}
													transition={{ duration: 0.15 }}
												>
													<FilePreview
													file={file}
													onRemove={() => setFile(null)}
													/>
												</motion.div>
												)}
											</AnimatePresence>
											</div>
										</div>
										</div>
									</div>

									<div className="flex items-center justify-end gap-2 pt-7 shrink-0">
										<Button
										variant="ghost"
										onClick={() => {
											setEditing(false)
											setFile(null)
											setDisplayName(me.displayName ?? "")
										}}
										>
										Cancel
										</Button>

										<AsyncConfirmButton onClick={handleSave}>
										Save changes
										</AsyncConfirmButton>
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>

					<Separator />

					<div className="space-y-4">
						<div>
							<h2 className="text-lg font-semibold">Devices</h2>
							<p className="text-sm text-muted-foreground">Devices currently signed into your account</p>
						</div>

						{me.devices.length === 0 && (<p className="text-sm text-muted-foreground">No active devices</p>)}

						<div className="space-y-3">
							{me.devices.map((device) => (
								<div
								key={device.id}
								className="
								flex items-center justify-between
								rounded-lg border border-border
								px-4 py-3
								hover:bg-muted/40
								transition-colors
								"
								>
								<div className="space-y-1 min-w-0">
									<p className="text-sm font-medium truncate">{device.userAgent}</p>
									<p className="text-xs text-muted-foreground">Added on{" "} {new Date(device.createdAt).toLocaleDateString()}</p>
								</div>

								<Button
									size="sm"
									className="cursor-pointer"
									variant="destructive"
									onClick={() => {
									// TODO: revoke device
									}}
								>
									<Trash2 className="w-5 h-5" />
								</Button>
								</div>
							))}
						</div>
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}
