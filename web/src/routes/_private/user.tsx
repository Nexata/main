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
import { useMe, useUpdateMe } from "@/lib/user";
import { AsyncConfirmButton } from "@/components/async-confirm-button/async-confirm-button";
import { FilePreview } from "@/components/ui/file-preview";
import {
	"user.profile.header.title" as profile_header_title,
	"user.profile.header.subtitle" as profile_header_subtitle,
	"user.profile.header.back_to_chat" as profile_back_to_chat,
	"user.profile.info.messages_used" as user_profile_info_messages_used,
	"user.profile.edit.display_name_label" as profile_display_name_label,
	"user.profile.edit.profile_image_label" as profile_profile_image_label,
	"user.profile.edit.cancel" as profile_cancel,
	"user.profile.edit.save" as profile_save,
	"user.profile.devices.title" as profile_devices_title,
	"user.profile.devices.subtitle" as profile_devices_subtitle,
	"user.profile.devices.empty" as profile_devices_empty,
	"user.profile.devices.added_on" as profile_devices_added_on,
	"user.profile.devices.revoke.loading_title" as profile_device_revoke_loading_title,
	"user.profile.devices.revoke.loading_description" as profile_device_revoke_loading_description,
	"user.profile.devices.revoke.success_title" as profile_device_revoke_success_title,
	"user.profile.devices.revoke.success_description" as profile_device_revoke_success_description,
	"user.profile.devices.revoke.error_title" as profile_device_revoke_error_title,
	"user.profile.devices.revoke.error_description" as profile_device_revoke_error_description
} from "@/paraglide/messages.js";
import { useDeleteMyDevice } from "@/lib/user";
import { infoToast } from "@/components/info-toast/info-toast"; 

export const Route = createFileRoute("/_private/user")({
  component: ProfilePage,
});

export default function ProfilePage() {
	const navigate = useNavigate();
	const { data: me, isLoading: meLoading } = useMe();
	const updateMe = useUpdateMe();
	const [editing, setEditing] = useState(false);
	const [displayName, setDisplayName] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const deleteMyDevice = useDeleteMyDevice();

	useEffect(() => {
		document.title = `Nexata | ${profile_header_title()}`;
		if (me?.displayName) setDisplayName(me.displayName);
	}, [me]);

	if (meLoading || !me) return null;

	// UpdateMe
	async function handleSave() {
		await updateMe({
			displayName:
			displayName !== me?.displayName ? displayName : undefined,
			pfp: file ?? undefined,
		});

		setEditing(false);
		setFile(null);
	}

	// Delete Device
	async function handleDeleteDevice(fingerprint: string) {
	const toastId = infoToast.loading({
		title: profile_device_revoke_loading_title(),
		description: profile_device_revoke_loading_description(),
	});

	try {
		await deleteMyDevice(fingerprint);

		infoToast.success(toastId, {
		title: profile_device_revoke_success_title(),
		description: profile_device_revoke_success_description(),
		});
	} catch (error) {
		infoToast.error(toastId, {
		title: profile_device_revoke_error_title(),
		description: profile_device_revoke_error_description(),
		});
	}
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
					<h1 className="text-3xl font-semibold tracking-tight">{profile_header_title()}</h1>
					<p className="text-sm text-muted-foreground">{profile_header_subtitle()}</p>
				</div>

				<Button variant="outline" onClick={() => navigate({ to: "/chat" })}>
					<ArrowLeft className="h-4 w-4 mr-2" />
					{profile_back_to_chat()}
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
							<span className="text-sm text-muted-foreground">{user_profile_info_messages_used()}</span>
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
											<label className="text-sm font-medium">{profile_display_name_label()}</label>
											<Input
												className="w-full md:w-64 h-10"
												value={displayName}
												onChange={(e) => setDisplayName(e.target.value)}
											/>
										</div>

										<div className="flex flex-col gap-2">
											<label className="text-sm font-medium">{profile_profile_image_label()}</label>

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
										className="cursor-pointer"
										variant="ghost"
										onClick={() => {
											setEditing(false)
											setFile(null)
											setDisplayName(me.displayName ?? "")
										}}
										>
										{profile_cancel()}
										</Button>

										<AsyncConfirmButton onClick={handleSave}>{profile_save()}</AsyncConfirmButton>
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>

					<Separator />

					<div className="space-y-4">
						<div>
							<h2 className="text-lg font-semibold">{profile_devices_title()}</h2>
							<p className="text-sm text-muted-foreground">{profile_devices_subtitle()}</p>
						</div>

						{me.devices.length === 0 && (<p className="text-sm text-muted-foreground">{profile_devices_empty()}</p>)}

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
									<p className="text-xs text-muted-foreground">{profile_devices_added_on()}{" "} {new Date(device.createdAt).toLocaleDateString()}</p>
								</div>

								<Button
									size="sm"
									className="cursor-pointer"
									variant="destructive"
									onClick={() => handleDeleteDevice(device.fingerprint)}
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
