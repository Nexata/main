import type { DisplayCredential } from '@api/utils/credential';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDeleteCredentialModal } from '@/components/credentials/credential-delete-modal';
import { infoToast } from '@/components/info-toast/info-toast';
import { SourceRow } from '@/components/sources/source-row';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getIsAdmin } from '@/lib/auth';
import {
	credentialsBySource,
	DINAMIC_DATA_SOURCES,
	STORAGE_DATA_SOURCES,
} from '@/lib/available-sources';
import { deleteCredentialById, listCredentials } from '@/lib/credential';
import * as m from '@/paraglide/messages.js';

export const Route = createFileRoute('/_private/settings')({
	component: SettingsPage,
});

// ------------------------------- Settings Page ----------------------------------
function SettingsPage() {
	useEffect(() => {
		document.title = m['settings.meta.title']();
	}, []);
	const navigate = useNavigate();

	const [credentials, setCredentials] = useState<DisplayCredential[] | null>(
		null,
	);
	const [loading, setLoading] = useState(true);
	const [deleteModal, setDeleteModal] = useState<{
		credentialId: string | null;
	}>({ credentialId: null });

	useEffect(() => {
		let mounted = true;

		async function loadCredentials() {
			try {
				setLoading(true);
				const data = await listCredentials();
				if (mounted) setCredentials(data);
			} catch (err) {
				console.error(err);
			} finally {
				if (mounted) setLoading(false);
			}
		}

		loadCredentials();
		return () => {
			mounted = false;
		};
	}, []);

	async function handleDeleteCredential(id: string) {
		const toastId = infoToast.loading({
			title: m['components.credentials.toast.delete.loading'](),
		});

		try {
			await deleteCredentialById(id);
			const fresh = await listCredentials();
			setCredentials(fresh);

			infoToast.success(toastId, {
				title: m['common.success'](),
				description: m['components.credentials.toast.delete.success'](),
			});
		} catch (err) {
			console.error(err);
			infoToast.error(toastId, {
				title: m['common.error'](),
				description: m['components.credentials.toast.delete.error'](),
			});
		}
	}

	return (
		<>
			<motion.div
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.25, ease: 'easeOut' }}
				className="flex flex-col gap-6 px-3 py-4 w-full max-w-screen-2xl mx-auto"
			>
				{/* Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-semibold tracking-tight">
							{m['settings.title']()}
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							{m['settings.subtitle']()}
						</p>
					</div>

					<div className="flex gap-3">
						<Button
							variant="destructive"
							onClick={() => navigate({ to: '/adminsettings' })}
							className="gap-2 cursor-pointer"
						>
							<SettingsIcon className="h-4 w-4" />
							{m['settings.actions.admin_panel']()}
						</Button>

						<Button
							variant="outline"
							onClick={() => navigate({ to: '/chat' })}
							className="gap-2 cursor-pointer"
						>
							<ArrowLeft className="h-4 w-4" />
							{m['settings.actions.back_to_chat']()}
						</Button>
					</div>
				</div>

				<div className="h-px w-full bg-border" />

				<DataSourcesSection
					credentials={credentials ?? []}
					loading={loading}
					onCredentialsUpdate={setCredentials}
					onRequestDelete={(id) => setDeleteModal({ credentialId: id })}
				/>

				<StorageSection
					credentials={credentials ?? []}
					loading={loading}
					onCredentialsUpdate={setCredentials}
					onRequestDelete={(id) => setDeleteModal({ credentialId: id })}
				/>
			</motion.div>

			<ConfirmDeleteCredentialModal
				modal={deleteModal}
				setModal={setDeleteModal}
				onDeleteCredential={handleDeleteCredential}
			/>
		</>
	);
}

// --------------------------------------------------------------------------------
// --------------------------- Data Sources Section -------------------------------
// --------------------------------------------------------------------------------

type DataSourcesSectionProps = {
	credentials: DisplayCredential[];
	loading: boolean;
	onCredentialsUpdate: React.Dispatch<
		React.SetStateAction<DisplayCredential[] | null>
	>;
	onRequestDelete: (id: string) => void;
};

export function DataSourcesSection({
	credentials,
	loading,
	onCredentialsUpdate,
	onRequestDelete,
}: DataSourcesSectionProps) {
	const [openSourceId, setOpenSourceId] = useState<string | null>(null);
	const [expandedCredentialId, setExpandedCredentialId] = useState<
		string | null
	>(null);

	const canManageCredential = (cred: DisplayCredential) =>
		getIsAdmin() || cred.canAdmin === true;

	return (
		<Card className="bg-[var(--sidebar)]">
			<CardContent className="p-6 space-y-4">
				<div>
					<h2 className="text-lg font-semibold">
						{m['settings.sources.title']()}
					</h2>
					<p className="text-sm text-muted-foreground">
						{m['settings.sources.description']()}
					</p>
				</div>

				<Separator />

				<div className="space-y-3">
					{DINAMIC_DATA_SOURCES.map((source) => {
						const sourceCredentials = credentialsBySource(source, credentials);

						return (
							<SourceRow
								key={source.id}
								source={source}
								credentials={sourceCredentials}
								loading={loading}
								isOpen={openSourceId === source.id}
								onToggle={() =>
									setOpenSourceId(openSourceId === source.id ? null : source.id)
								}
								expandedCredentialId={expandedCredentialId}
								onToggleCredential={(id) =>
									setExpandedCredentialId(
										expandedCredentialId === id ? null : id,
									)
								}
								canManageCredential={canManageCredential}
								onDeleteCredential={onRequestDelete}
								onCredentialsUpdate={onCredentialsUpdate}
							/>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}

// --------------------------------------------------------------------------------
// ------------------------------- Storage Section ----------------------------------
// --------------------------------------------------------------------------------

type StorageSectionProps = {
	credentials: DisplayCredential[];
	loading: boolean;
	onCredentialsUpdate: React.Dispatch<
		React.SetStateAction<DisplayCredential[] | null>
	>;
	onRequestDelete: (id: string) => void;
};

export function StorageSection({
	credentials,
	loading,
	onCredentialsUpdate,
	onRequestDelete,
}: StorageSectionProps) {
	const [openSourceId, setOpenSourceId] = useState<string | null>(null);
	const [expandedCredentialId, setExpandedCredentialId] = useState<
		string | null
	>(null);

	const canManageCredential = (cred: DisplayCredential) =>
		getIsAdmin() || cred.canAdmin === true;

	return (
		<Card className="bg-[var(--sidebar)]">
			<CardContent className="p-6 space-y-4">
				<div>
					<h2 className="text-lg font-semibold">
						{m['settings.storage.title']()}
					</h2>
					<p className="text-sm text-muted-foreground">
						{m['settings.storage.description']()}
					</p>
				</div>

				<Separator />

				<div className="space-y-3">
					{STORAGE_DATA_SOURCES.map((source) => {
						const sourceCredentials = credentialsBySource(source, credentials);

						return (
							<SourceRow
								key={source.id}
								source={source}
								credentials={sourceCredentials}
								loading={loading}
								isOpen={openSourceId === source.id}
								onToggle={() =>
									setOpenSourceId(openSourceId === source.id ? null : source.id)
								}
								expandedCredentialId={expandedCredentialId}
								onToggleCredential={(id) =>
									setExpandedCredentialId(
										expandedCredentialId === id ? null : id,
									)
								}
								canManageCredential={canManageCredential}
								onDeleteCredential={onRequestDelete}
								onCredentialsUpdate={onCredentialsUpdate}
							/>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
