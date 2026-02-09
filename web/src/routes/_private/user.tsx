'use client';

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import {
	AlertTriangle,
	ArrowLeft,
	Check,
	Copy,
	KeyRound,
	LogOut,
	Pencil,
	RotateCw,
	Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { UAParser } from 'ua-parser-js';
import { AsyncConfirmButton } from '@/components/async-confirm-button/async-confirm-button';
import { infoToast } from '@/components/info-toast/info-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { FilePreview } from '@/components/ui/file-preview';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { clearTokens } from '@/lib/auth';
import { clearFingerprint, getFingerprint } from '@/lib/fingerprint';
import {
	useCreateOrRegenerateApiKey,
	useDeleteApiKey,
	useDeleteMe,
	useDeleteMyDevice,
	useMe,
	useUpdateMe,
} from '@/lib/user';
import {
	'common.cancel' as common_cancel,
	'common.confirm' as common_confirm,
	'user.profile.api_keys.actions.create' as profile_api_keys_action_create,
	'user.profile.api_keys.actions.delete' as profile_api_keys_action_delete,
	'user.profile.api_keys.actions.regenerate' as profile_api_keys_action_regenerate,
	'user.profile.api_keys.empty.description' as profile_api_keys_empty_description,
	'user.profile.api_keys.empty.title' as profile_api_keys_empty_title,
	'user.profile.api_keys.section.subtitle' as profile_api_keys_section_subtitle,
	'user.profile.api_keys.section.title' as profile_api_keys_section_title,
	'user.profile.api_keys.toasts.delete.error_description' as profile_api_keys_toast_delete_error_description,
	'user.profile.api_keys.toasts.delete.error_title' as profile_api_keys_toast_delete_error_title,
	'user.profile.api_keys.toasts.delete.loading_description' as profile_api_keys_toast_delete_loading_description,
	'user.profile.api_keys.toasts.delete.loading_title' as profile_api_keys_toast_delete_loading_title,
	'user.profile.api_keys.toasts.delete.success_description' as profile_api_keys_toast_delete_success_description,
	'user.profile.api_keys.toasts.delete.success_title' as profile_api_keys_toast_delete_success_title,
	'user.profile.api_keys.toasts.generate.error_description' as profile_api_keys_toast_generate_error_description,
	'user.profile.api_keys.toasts.generate.error_title' as profile_api_keys_toast_generate_error_title,
	'user.profile.api_keys.toasts.generate.loading_description' as profile_api_keys_toast_generate_loading_description,
	'user.profile.api_keys.toasts.generate.loading_title' as profile_api_keys_toast_generate_loading_title,
	'user.profile.api_keys.toasts.generate.success_description' as profile_api_keys_toast_generate_success_description,
	'user.profile.api_keys.toasts.generate.success_title' as profile_api_keys_toast_generate_success_title,
	'user.profile.header.back_to_chat' as profile_back_to_chat,
	'user.profile.edit.cancel' as profile_cancel,
	'user.profile.danger_zone.subtitle' as profile_danger_zone_subtitle,
	'user.profile.danger_zone.title' as profile_danger_zone_title,
	'user.profile.devices.revoke.error_description' as profile_device_revoke_error_description,
	'user.profile.devices.revoke.error_title' as profile_device_revoke_error_title,
	'user.profile.devices.revoke.loading_description' as profile_device_revoke_loading_description,
	'user.profile.devices.revoke.loading_title' as profile_device_revoke_loading_title,
	'user.profile.devices.revoke.success_description' as profile_device_revoke_success_description,
	'user.profile.devices.revoke.success_title' as profile_device_revoke_success_title,
	'user.profile.devices.added_on' as profile_devices_added_on,
	'user.profile.devices.empty' as profile_devices_empty,
	'user.profile.devices.subtitle' as profile_devices_subtitle,
	'user.profile.devices.title' as profile_devices_title,
	'user.profile.edit.display_name_label' as profile_display_name_label,
	'user.profile.header.subtitle' as profile_header_subtitle,
	'user.profile.header.title' as profile_header_title,
	'user.profile.edit.profile_image_label' as profile_profile_image_label,
	'user.profile.edit.save' as profile_save,
	'user.profile.api_keys.delete_modal.description' as user_profile_api_keys_delete_modal_description,
	'user.profile.api_keys.delete_modal.title' as user_profile_api_keys_delete_modal_title,
	'user.profile.api_keys.one_time_modal.copy_aria_label' as user_profile_api_keys_one_time_modal_copy_aria_label,
	'user.profile.api_keys.one_time_modal.description' as user_profile_api_keys_one_time_modal_description,
	'user.profile.api_keys.one_time_modal.saved_button' as user_profile_api_keys_one_time_modal_saved_button,
	'user.profile.api_keys.one_time_modal.security_note' as user_profile_api_keys_one_time_modal_security_note,
	'user.profile.api_keys.one_time_modal.title' as user_profile_api_keys_one_time_modal_title,
	'user.profile.delete_account.description' as user_profile_delete_account_description,
	'user.profile.delete_account.subtitle' as user_profile_delete_account_subtitle,
	'user.profile.delete_account.title' as user_profile_delete_account_title,
	'user.profile.devices.delete' as user_profile_devices_delete,
	'user.profile.edit.label' as user_profile_edit_label,
	'user.profile.header.logout' as user_profile_header_logout,
	'user.profile.info.messages_used' as user_profile_info_messages_used,
} from '@/paraglide/messages.js';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { LANGUAGE_OPTIONS } from '@/hooks/use-sync-language';
import { Language } from '@api/schema/user';
import { isLocale, setLocale } from '@/paraglide/runtime';

export const Route = createFileRoute('/_private/user')({
	component: ProfilePage,
});

export default function ProfilePage() {
	const navigate = useNavigate();
	const { data: me, isLoading: meLoading } = useMe();
	const updateMe = useUpdateMe();
	const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [language, setLanguage] = useState<Language>(Language.ES);
	const [file, setFile] = useState<File | null>(null);
	const deleteMyDevice = useDeleteMyDevice();
	const deleteMe = useDeleteMe();
	const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
	const createOrRegenerateApiKey = useCreateOrRegenerateApiKey();
	const deleteApiKey = useDeleteApiKey();
	const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
	const [generatedApiKey, setGeneratedApiKey] = useState<string | null>(null);
	const [deleteApiKeyOpen, setDeleteApiKeyOpen] = useState(false);

	useEffect(() => {
		document.title = `Nexata | ${profile_header_title()}`;
    if (me?.displayName) setDisplayName(me.displayName);
    if (me?.language) setLanguage(me.language);
  }, [me]);

	// Cambio de Idioma
	const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
    if (isLocale(lang)) setLocale(lang, { reload: false });

    updateMe({ language: lang });
  };

	// TODO: Skeleton
	if (meLoading || !me) return null;

	// UpdateMe
	async function handleSave() {
    await updateMe({
      language,
      displayName: displayName !== me?.displayName ? displayName : undefined,
			pfp: file ?? undefined,
		});

		setEditing(false);
		setFile(null);
	}

	// Delete Device
	async function handleDeleteDevice(
		fingerprint: string,
		isLogout: boolean = false,
	) {
		const actualFingerprint = await getFingerprint();
		if (!isLogout && fingerprint === actualFingerprint) {
			await handleLogout();
			return;
		}

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
		} catch (_error) {
			infoToast.error(toastId, {
				title: profile_device_revoke_error_title(),
				description: profile_device_revoke_error_description(),
			});
		}
	}

	// CreateOrRegenerateApiKey
	async function handleCreateOrRegenerateApiKey() {
		const toastId = infoToast.loading({
			title: profile_api_keys_toast_generate_loading_title(),
			description: profile_api_keys_toast_generate_loading_description(),
		});

		try {
			const apiKey = await createOrRegenerateApiKey();
			setGeneratedApiKey(apiKey);
			setApiKeyModalOpen(true);

			infoToast.success(toastId, {
				title: profile_api_keys_toast_generate_success_title(),
				description: profile_api_keys_toast_generate_success_description(),
			});
		} catch (_error) {
			infoToast.error(toastId, {
				title: profile_api_keys_toast_generate_error_title(),
				description: profile_api_keys_toast_generate_error_description(),
			});
		}
	}

	// DeleteApiKey
	async function handleDeleteApiKey() {
		const toastId = infoToast.loading({
			title: profile_api_keys_toast_delete_loading_title(),
			description: profile_api_keys_toast_delete_loading_description(),
		});

		try {
			await deleteApiKey();

			infoToast.success(toastId, {
				title: profile_api_keys_toast_delete_success_title(),
				description: profile_api_keys_toast_delete_success_description(),
			});

			setDeleteApiKeyOpen(false);
		} catch (_error) {
			infoToast.error(toastId, {
				title: profile_api_keys_toast_delete_error_title(),
				description: profile_api_keys_toast_delete_error_description(),
			});
		}
	}

	// UserAgent Helper
	function formatUserAgent(ua: string | null | undefined) {
		if (!ua) return 'Unknown device';

		const parser = new UAParser(ua);
		const { browser, os, cpu, device } = parser.getResult();

		const parts = [
			browser.name && browser.version
				? `${browser.name} ${browser.version}`
				: browser.name,
			os.name && os.version ? `${os.name} ${os.version}` : os.name,
			device.type ?? 'Desktop',
			cpu.architecture,
		];

		return parts.filter(Boolean).join(' · ');
	}

	// Handle LogOut
	async function handleLogout() {
		try {
			const fingerprint = await getFingerprint();
			await handleDeleteDevice(fingerprint, true);

			clearTokens();
			clearFingerprint();
			localStorage.clear();
			sessionStorage.clear();
			window.location.href = '/login';
		} catch (_e) {}
	}

	return (
		<div className="flex flex-col gap-6 px-3 py-4 w-full max-w-screen-2xl mx-auto">
			{/* Header */}
			<header className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-semibold tracking-tight">
						{profile_header_title()}
					</h1>
					<p className="text-sm text-muted-foreground">
						{profile_header_subtitle()}
					</p>
				</div>

				<div className="flex items-center gap-2">
					<Button
						className="cursor-pointer"
						variant="outline"
						onClick={() => navigate({ to: '/chat' })}
					>
						<ArrowLeft className="h-4 w-4 mr-2" />
						{profile_back_to_chat()}
					</Button>

					<Button
						className="cursor-pointer"
						variant="destructive"
						onClick={handleLogout}
					>
						<LogOut className="h-4 w-4 mr-2" />
						{user_profile_header_logout()}
					</Button>
				</div>
			</header>

			<Separator />

			<Card className="bg-sidebar">
				<CardContent className="p-6 space-y-6">
					<div className="flex items-center justify-between gap-6">
						<div className="flex items-center gap-5">
							<Avatar className="h-16 w-16">
								<AvatarImage src={me.pfpUrl ?? undefined} />
								<AvatarFallback>
									{(me.displayName ?? me.email)[0]?.toUpperCase()}
								</AvatarFallback>
							</Avatar>

							<div className="space-y-1">
								<div className="flex items-center gap-2">
									<h2 className="text-lg font-semibold">
										{me.displayName ?? 'User'}
									</h2>
									{me.isAdmin && <Badge variant="destructive">Admin</Badge>}

									<Tooltip>
										<TooltipTrigger>
											<Button
												className="cursor-pointer"
												size="icon"
												variant="ghost"
												onClick={() => setEditing((v) => !v)}
											>
												<Pencil className="h-4 w-4" />
											</Button>
										</TooltipTrigger>
										<TooltipContent>{user_profile_edit_label()}</TooltipContent>
									</Tooltip>
								</div>

								<p className="text-sm text-muted-foreground">{me.email}</p>
							</div>
						</div>

            <div className="flex items-center gap-1">
              <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/40 px-4 py-2">
                <LanguageSelector value={language} onChange={handleLanguageChange} />
                <Separator orientation="vertical" className="h-6" />
                <span className="text-sm text-muted-foreground">
                  {user_profile_info_messages_used()}
                </span>
                <Separator orientation="vertical" className="h-6" />
                <span className="text-xl font-semibold leading-none text-primary">
                  {me.messageCount}
                </span>
              </div>
            </div>
					</div>

					<AnimatePresence>
						{editing && (
							<motion.div
								initial={{ opacity: 0, height: 0 }}
								animate={{ opacity: 1, height: 'auto' }}
								exit={{ opacity: 0, height: 0 }}
								transition={{ duration: 0.25 }}
								className="overflow-hidden"
							>
								<Separator className="my-6" />

								<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 py-2 px-2">
									<div className="flex flex-col md:flex-row md:items-start gap-6 flex-1">
										<div className="flex flex-col gap-2">
											<label className="text-sm font-medium">
												{profile_display_name_label()}
											</label>
											<Input
												className="w-full md:w-64 h-10"
												value={displayName}
												onChange={(e) => setDisplayName(e.target.value)}
											/>
										</div>

										<div className="flex flex-col gap-2">
											<label className="text-sm font-medium">
												{profile_profile_image_label()}
											</label>

											<div className="flex items-center gap-3 min-h-10">
												<Input
													type="file"
													accept="image/*"
													className="w-56 h-10"
													onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
												setEditing(false);
												setFile(null);
                        setDisplayName(me.displayName ?? '');
												setLanguage(me.language);
											}}
										>
											{profile_cancel()}
										</Button>

										<AsyncConfirmButton onClick={handleSave}>
											{profile_save()}
										</AsyncConfirmButton>
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>

					<Separator />

					<div className="space-y-4">
						<div>
							<h2 className="text-lg font-semibold">
								{profile_devices_title()}
							</h2>
							<p className="text-sm text-muted-foreground">
								{profile_devices_subtitle()}
							</p>
						</div>

						{me.devices.length === 0 && (
							<p className="text-sm text-muted-foreground">
								{profile_devices_empty()}
							</p>
						)}

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
										<p className="text-sm font-medium truncate">
											{formatUserAgent(device.userAgent)}
										</p>
										<p className="text-xs text-muted-foreground truncate">
											{device.userAgent}
										</p>
										<p className="text-xs text-muted-foreground">
											{profile_devices_added_on()}{' '}
											{new Date(device.createdAt).toLocaleDateString()}
										</p>
									</div>

									<Tooltip>
										<TooltipTrigger>
											<Button
												variant="destructive"
												size="icon"
												className="cursor-pointer"
												onClick={() => handleDeleteDevice(device.fingerprint)}
											>
												<Trash2 className="w-5 h-5" />
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											{user_profile_devices_delete()}
										</TooltipContent>
									</Tooltip>
								</div>
							))}
						</div>
					</div>
				</CardContent>
			</Card>

			<Card className="bg-sidebar">
				<CardContent className="p-6 space-y-6">
					<div className="space-y-3">
						<div>
							<h2 className="text-lg font-semibold">
								{profile_api_keys_section_title()}
							</h2>
							<p className="text-sm text-muted-foreground">
								{profile_api_keys_section_subtitle()}
							</p>
						</div>

						{me.hasApiKey ? (
							<div className="flex flex-col sm:flex-row sm:items-center gap-3">
								<div className="flex-1">
									<div
										className="
									flex items-center
									h-10 px-3
									rounded-md border border-border
									bg-muted/40
									font-mono text-sm
									text-muted-foreground
									tracking-widest
									select-none
									"
									>
										*****************************
									</div>
								</div>

								<TooltipProvider>
									<div className="flex items-center gap-2 shrink-0">
										<Tooltip>
											<TooltipTrigger>
												<Button
													variant="outline"
													size="icon"
													className="cursor-pointer"
													onClick={handleCreateOrRegenerateApiKey}
													aria-label="Regenerate API key"
												>
													<RotateCw className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>{profile_api_keys_action_regenerate()}</p>
											</TooltipContent>
										</Tooltip>

										{/* Delete */}
										<Tooltip>
											<TooltipTrigger>
												<Button
													variant="destructive"
													size="icon"
													className="cursor-pointer"
													onClick={() => setDeleteApiKeyOpen(true)}
													aria-label="Delete API key"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent>
												<p>{profile_api_keys_action_delete()}</p>
											</TooltipContent>
										</Tooltip>
									</div>
								</TooltipProvider>
							</div>
						) : (
							<div className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-4">
								<div>
									<p className="text-sm font-medium">
										{profile_api_keys_empty_title()}
									</p>
									<p className="text-xs text-muted-foreground">
										{profile_api_keys_empty_description()}
									</p>
								</div>

								<Button
									size="sm"
									className="cursor-pointer"
									onClick={handleCreateOrRegenerateApiKey}
								>
									{profile_api_keys_action_create()}
								</Button>
							</div>
						)}
					</div>

					<Separator />

					<div
						className="
					rounded-lg border border-destructive/40
					bg-destructive/5
					p-5
					space-y-3
					"
					>
						<div>
							<h3 className="text-sm font-semibold text-destructive">
								{profile_danger_zone_title()}
							</h3>
							<p className="text-xs text-muted-foreground">
								{profile_danger_zone_subtitle()}
							</p>
						</div>

						<Separator />

						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
							<div>
								<p className="text-sm font-medium">
									{user_profile_delete_account_title()}
								</p>
								<p className="text-xs text-muted-foreground">
									{user_profile_delete_account_subtitle()}
								</p>
							</div>

							<Button
								variant="destructive"
								size="sm"
								className="cursor-pointer"
								onClick={() => setDeleteAccountOpen(true)}
							>
								{user_profile_delete_account_title()}
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<ConfirmDeleteAccountModal
				open={deleteAccountOpen}
				onOpenChange={setDeleteAccountOpen}
				onConfirm={async () => {
					await deleteMe();
				}}
			/>

			<ApiKeyOneTimeModal
				open={apiKeyModalOpen}
				apiKey={generatedApiKey}
				onOpenChange={(v) => {
					setApiKeyModalOpen(v);
					if (!v) setGeneratedApiKey(null);
				}}
			/>

			<ConfirmDeleteApiKeyModal
				open={deleteApiKeyOpen}
				onOpenChange={setDeleteApiKeyOpen}
				onConfirm={handleDeleteApiKey}
			/>
		</div>
	);
}

// ------ DELETE MODAL ------

function ConfirmDeleteAccountModal({
	open,
	onOpenChange,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<span className="flex h-8 w-8 items-center justify-center rounded-full">
							<AlertTriangle className="h-4 w-4 text-destructive" />
						</span>
						{user_profile_delete_account_title()}
					</DialogTitle>
					<DialogDescription className="pt-1">
						{user_profile_delete_account_description()}
					</DialogDescription>
				</DialogHeader>

				<DialogFooter className="flex justify-end gap-2">
					<Button
						variant="outline"
						className="cursor-pointer"
						onClick={() => onOpenChange(false)}
					>
						{common_cancel()}
					</Button>

					<Button
						variant="destructive"
						className="cursor-pointer"
						onClick={onConfirm}
					>
						{common_confirm()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ------- ONE TIME APIKEY MODAL -------
function ApiKeyOneTimeModal({
	open,
	onOpenChange,
	apiKey,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	apiKey: string | null;
}) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (open) setCopied(false);
	}, [open]);

	if (!apiKey) return null;

	const handleCopy = async () => {
		await navigator.clipboard.writeText(apiKey);
		setCopied(true);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
							<KeyRound className="h-4 w-4 text-primary" />
						</span>
						{user_profile_api_keys_one_time_modal_title()}
					</DialogTitle>

					<DialogDescription className="pt-1">
						{user_profile_api_keys_one_time_modal_description()}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<Input readOnly value={apiKey} className="font-mono" />

						<Button
							size="icon"
							variant="outline"
							onClick={handleCopy}
							className="cursor-pointer"
							aria-label={user_profile_api_keys_one_time_modal_copy_aria_label()}
						>
							{copied ? (
								<Check className="h-4 w-4 text-green-600" />
							) : (
								<Copy className="h-4 w-4" />
							)}
						</Button>
					</div>

					<p className="text-xs text-muted-foreground">
						{user_profile_api_keys_one_time_modal_security_note()}
					</p>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						className="cursor-pointer"
						onClick={() => onOpenChange(false)}
					>
						{user_profile_api_keys_one_time_modal_saved_button()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ----- DELETE APIKEY MODAL -----
function ConfirmDeleteApiKeyModal({
	open,
	onOpenChange,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	onConfirm: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{user_profile_api_keys_delete_modal_title()}
					</DialogTitle>
					<DialogDescription className="pt-1">
						{user_profile_api_keys_delete_modal_description()}
					</DialogDescription>
				</DialogHeader>

				<DialogFooter className="flex justify-end gap-2 cursor-pointer">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						<span>{common_cancel()}</span>
					</Button>
					<Button
						className="cursor-pointer"
						variant="destructive"
						onClick={onConfirm}
					>
						<span>{common_confirm()}</span>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function LanguageSelector({
  value,
  onChange,
}: {
  value: Language;
  onChange: (v: Language) => void;
}) {
  const current =
    LANGUAGE_OPTIONS.find((l) => l.value === value) ??
    LANGUAGE_OPTIONS[0];

  return (
    <Select value={value} onValueChange={(v) => onChange(v as Language)}>
      <SelectTrigger
        className="
          h-8
          min-w-18
          px-2
          gap-2
          border-none
          bg-transparent
          hover:bg-muted/60
          flex items-center
        "
      >
        <Flag country={current.country} />
        <span className="hidden sm:inline text-xs font-medium uppercase">
          {current.value}
        </span>
      </SelectTrigger>

      <SelectContent align="start">
        {LANGUAGE_OPTIONS.map((lang) => (
          <SelectItem key={lang.value} value={lang.value}>
            <div className="flex items-center gap-2">
              <Flag country={lang.country} />
              <span className="text-sm uppercase">{lang.value}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Flag({ country }: { country: string }) {
  return (
    <span
      className={`fi fi-${country} rounded-sm shrink-0 inline-block`}
      style={{ width: 18, height: 12 }}
    />
  );
}
