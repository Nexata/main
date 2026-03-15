import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import {
	ArrowLeft,
	CalendarIcon,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	FileText,
	RefreshCcw,
	Search,
	Settings as SettingsIcon,
	Trash2,
	X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDeleteCredentialModal } from '@/components/credentials/credential-delete-modal';
import { infoToast } from '@/components/info-toast/info-toast';
import { SourceRow } from '@/components/sources/source-row';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@/components/ui/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
	Table,
	TableBody,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import {
	credentialsBySource,
	DINAMIC_DATA_SOURCES,
	STORAGE_DATA_SOURCES,
} from '@/lib/available-sources';
import type { CredentialItem } from '@/lib/credential';
import {
	canManageCredential,
	deleteCredentialById,
	listCredentials,
} from '@/lib/credential';
import type { SearchFilesParams, SearchFilesResult } from '@/lib/file';
import { useDeleteFiles, useIngestFiles, useSearchFiles } from '@/lib/file';
import { useMe } from '@/lib/user';
import {
	'common.error' as common_error,
	'common.success' as common_success,
	'components.credentials.toast.delete.error' as components_credentials_toast_delete_error,
	'components.credentials.toast.delete.loading' as components_credentials_toast_delete_loading,
	'components.credentials.toast.delete.success' as components_credentials_toast_delete_success,
	'settings.actions.admin_panel' as settings_actions_admin_panel,
	'settings.actions.back_to_chat' as settings_actions_back_to_chat,
	'settings.meta.title' as settings_meta_title,
	'settings.sources.description' as settings_sources_description,
	'settings.sources.title' as settings_sources_title,
	'settings.storage.description' as settings_storage_description,
	'settings.storage.title' as settings_storage_title,
	'settings.subtitle' as settings_subtitle,
	'settings.title' as settings_title,
} from '@/paraglide/messages.js';

export const Route = createFileRoute('/_private/settings')({
	component: SettingsPage,
});

// ------------------------------- Settings Page ----------------------------------
function SettingsPage() {
	useEffect(() => {
		document.title = settings_meta_title();
	}, []);
	const navigate = useNavigate();

	const { data: me } = useMe();
	const [credentials, setCredentials] = useState<CredentialItem[] | null>(null);
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
			title: components_credentials_toast_delete_loading(),
		});

		try {
			await deleteCredentialById(id);
			const fresh = await listCredentials();
			setCredentials(fresh);

			infoToast.success(toastId, {
				title: common_success(),
				description: components_credentials_toast_delete_success(),
			});
		} catch (err) {
			console.error(err);
			infoToast.error(toastId, {
				title: common_error(),
				description: components_credentials_toast_delete_error(),
			});
		}
	}

	return (
		<>
			<div className="flex flex-col gap-6 px-3 py-4 w-full max-w-screen-2xl mx-auto">
				{/* Header */}
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
							{settings_title()}
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							{settings_subtitle()}
						</p>
					</div>

					<div className="flex gap-3">
						{me?.isAdmin && (
							<Button
								variant="destructive"
								onClick={() => navigate({ to: '/adminsettings' })}
								className="gap-2 cursor-pointer"
							>
								<SettingsIcon className="h-4 w-4" />
								{settings_actions_admin_panel()}
							</Button>
						)}

						<Button
							variant="outline"
							onClick={() =>
								navigate({ to: '/chat', search: { id: undefined } })
							}
							className="gap-2 cursor-pointer"
						>
							<ArrowLeft className="h-4 w-4" />
							{settings_actions_back_to_chat()}
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

				<FilesManagementSection />
			</div>

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
	credentials: CredentialItem[];
	loading: boolean;
	onCredentialsUpdate: React.Dispatch<
		React.SetStateAction<CredentialItem[] | null>
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
	const { data: me } = useMe();
	const [expandedCredentialId, setExpandedCredentialId] = useState<
		string | null
	>(null);

	const canManage = (cred: CredentialItem) => canManageCredential(cred, me);

	return (
		<Card className="bg-sidebar">
			<CardContent className="p-6 space-y-4">
				<div>
					<h2 className="text-lg font-semibold">{settings_sources_title()}</h2>
					<p className="text-sm text-muted-foreground">
						{settings_sources_description()}
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
								canManageCredential={canManage}
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
	credentials: CredentialItem[];
	loading: boolean;
	onCredentialsUpdate: React.Dispatch<
		React.SetStateAction<CredentialItem[] | null>
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
	const { data: me } = useMe();
	const [expandedCredentialId, setExpandedCredentialId] = useState<
		string | null
	>(null);

	const canManage = (cred: CredentialItem) => canManageCredential(cred, me);

	return (
		<Card className="bg-sidebar">
			<CardContent className="p-6 space-y-4">
				<div>
					<h2 className="text-lg font-semibold">{settings_storage_title()}</h2>
					<p className="text-sm text-muted-foreground">
						{settings_storage_description()}
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
								canManageCredential={canManage}
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
// -------------------------------- Files Section ---------------------------------
// --------------------------------------------------------------------------------

const FILE_TYPE_OPTIONS = [
	{
		label: 'PDF',
		ext: '.pdf',
		mime: 'application/pdf',
		color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
	},
	{
		label: 'Word (.docx)',
		ext: '.docx',
		mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
	},
	{
		label: 'Word (.doc)',
		ext: '.doc',
		mime: 'application/msword',
		color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
	},
	{
		label: 'Excel (.xlsx)',
		ext: '.xlsx',
		mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		color:
			'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
	},
	{
		label: 'Excel (.xls)',
		ext: '.xls',
		mime: 'application/vnd.ms-excel',
		color:
			'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
	},
	{
		label: 'PowerPoint (.pptx)',
		ext: '.pptx',
		mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		color:
			'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
	},
	{
		label: 'PowerPoint (.ppt)',
		ext: '.ppt',
		mime: 'application/vnd.ms-powerpoint',
		color:
			'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
	},
	{
		label: 'CSV',
		ext: '.csv',
		mime: 'text/csv',
		color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
	},
	{
		label: 'TSV',
		ext: '.tsv',
		mime: 'text/tab-separated-values',
		color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
	},
	{
		label: 'Text',
		ext: '.txt',
		mime: 'text/plain',
		color:
			'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
	},
	{
		label: 'Markdown',
		ext: '.md',
		mime: 'text/markdown',
		color:
			'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
	},
	{
		label: 'JSON',
		ext: '.json',
		mime: 'application/json',
		color:
			'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
	},
	{
		label: 'Image',
		ext: 'image/*',
		mime: 'image/',
		color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
	},
	{
		label: 'HTML',
		ext: '.html',
		mime: 'text/html',
		color:
			'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
	},
	{
		label: 'XML',
		ext: '.xml',
		mime: 'application/xml',
		color:
			'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
	},
	{
		label: 'YAML',
		ext: '.yaml',
		mime: 'application/x-yaml',
		color:
			'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
	},
	{
		label: 'RTF',
		ext: '.rtf',
		mime: 'application/rtf',
		color:
			'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
	},
	{
		label: 'ODT',
		ext: '.odt',
		mime: 'application/vnd.oasis.opendocument.text',
		color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
	},
	{
		label: 'ODS',
		ext: '.ods',
		mime: 'application/vnd.oasis.opendocument.spreadsheet',
		color:
			'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
	},
	{
		label: 'ODP',
		ext: '.odp',
		mime: 'application/vnd.oasis.opendocument.presentation',
		color:
			'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
	},
];

function getTypeOption(mime?: string | null) {
	if (!mime) return null;
	return (
		FILE_TYPE_OPTIONS.find((o) =>
			o.mime.endsWith('/') ? mime.startsWith(o.mime) : o.mime === mime,
		) ?? null
	);
}

const PROVIDER_OPTIONS = [
	{ id: 'nexata', name: 'Nexata', icon: '/nexata_logo.png' },
	{ id: 'drive', name: 'Google Drive', icon: '/datasource_icons/gdrive.png' },
	{ id: 'one_drive', name: 'OneDrive', icon: '/datasource_icons/onedrive.png' },
	{ id: 'dropbox', name: 'Dropbox', icon: '/datasource_icons/dropbox.png' },
];

function getProviderOption(id?: string | null) {
	if (!id) return null;
	return PROVIDER_OPTIONS.find((p) => p.id === id.toLowerCase()) ?? null;
}

function ProviderBadge({ provider }: { provider?: string }) {
	if (!provider)
		return <span className="text-xs text-muted-foreground">—</span>;
	const option = getProviderOption(provider);
	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium`}
		>
			{option && (
				<img
					src={option.icon}
					className="w-3.5 h-3.5 object-contain shrink-0"
				/>
			)}
			{option?.name ?? provider}
		</span>
	);
}

function TypeBadge({ type }: { type?: string | null }) {
	if (!type) return <span className="text-xs text-muted-foreground">—</span>;
	const option = getTypeOption(type);
	if (option) {
		return (
			<span
				className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${option.color}`}
			>
				{option.ext}
			</span>
		);
	}
	const label = type.includes('/') ? type.split('/').pop()! : type;
	return (
		<span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-xs text-muted-foreground">
			{label}
		</span>
	);
}

function UserMini({ user }: { user: SearchFilesResult[number]['ownedBy'] }) {
	if (!user)
		return <span className="text-xs text-muted-foreground italic">system</span>;
	return (
		<div className="flex items-center gap-2 min-w-0">
			{user.pfpUrl ? (
				<img
					src={user.pfpUrl}
					className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-border"
				/>
			) : (
				<div className="w-6 h-6 rounded-full flex items-center justify-center bg-primary/10 text-primary text-xs font-semibold shrink-0">
					{user.displayName?.[0]?.toUpperCase() ?? '?'}
				</div>
			)}
			<div className="min-w-0">
				<div className="text-sm font-medium truncate leading-tight">
					{user.displayName}
				</div>
				<div className="text-xs text-muted-foreground truncate leading-tight">
					{user.email}
				</div>
			</div>
		</div>
	);
}

function FilterPill({
	label,
	onRemove,
}: {
	label: string;
	onRemove: () => void;
}) {
	return (
		<span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-foreground">
			{label}
			<button
				type="button"
				onClick={onRemove}
				className="ml-0.5 rounded-full hover:bg-muted cursor-pointer transition-colors"
			>
				<X className="h-3 w-3" />
			</button>
		</span>
	);
}

// ── Discriminated union para el estado del dialog de eliminación ──────────────
type DeleteDialogState =
	| { open: false }
	| { open: true; mode: 'single'; fileId: string; fileName: string }
	| { open: true; mode: 'bulk'; count: number; ids: string[] };

export function FilesManagementSection() {
	const [filters, setFilters] = useState<SearchFilesParams>({ page: 1 });
	const [draft, setDraft] = useState<SearchFilesParams>({});
	const [selected, setSelected] = useState<Set<string>>(new Set());
	// CAMBIO 1: reemplazamos el booleano por el discriminated union
	const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>({
		open: false,
	});
	// CAMBIO 3: estado para el date picker tipo billing
	const [datePickerOpen, setDatePickerOpen] = useState(false);

	const { data: files = [], isLoading, refetch } = useSearchFiles(filters);
	const ingestMutation = useIngestFiles();
	const deleteMutation = useDeleteFiles();

	const toggleSelect = (id: string) =>
		setSelected((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});

	const toggleSelectAll = () =>
		setSelected(
			selected.size === files.length
				? new Set()
				: new Set(files.map((f) => f.id)),
		);

	const nextPage = () => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }));
	const prevPage = () =>
		setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }));

	const applyFilters = () => setFilters({ ...draft, page: 1 });
	const clearAllFilters = () => {
		setDraft({});
		setFilters({ page: 1 });
	};

	const activeFilters: { key: keyof SearchFilesParams; label: string }[] = [
		...(filters.query
			? [{ key: 'query' as const, label: `Search: "${filters.query}"` }]
			: []),
		...(filters.name
			? [{ key: 'name' as const, label: `Name: "${filters.name}"` }]
			: []),
		...(filters.provider
			? [{ key: 'provider' as const, label: `Provider: ${filters.provider}` }]
			: []),
		...(filters.type
			? [
					{
						key: 'type' as const,
						label: `Type: ${getTypeOption(filters.type)?.label ?? filters.type}`,
					},
				]
			: []),
		...(filters.createdAt
			? [
					{
						key: 'createdAt' as const,
						label: `Since: ${filters.createdAt.split('T')[0]}`,
					},
				]
			: []),
	];

	const removeFilter = (key: keyof SearchFilesParams) => {
		setFilters((f) => ({ ...f, [key]: undefined, page: 1 }));
		setDraft((d) => ({ ...d, [key]: undefined }));
	};

	// CAMBIO 2: handler unificado con infoToast
	const handleConfirmDelete = async () => {
		if (!deleteDialog.open) return;
		const ids =
			deleteDialog.mode === 'single' ? [deleteDialog.fileId] : deleteDialog.ids;
		const label =
			deleteDialog.mode === 'single'
				? `"${deleteDialog.fileName}"`
				: `${deleteDialog.count} files`;
		const toastId = infoToast.loading({ title: `Deleting ${label}…` });
		try {
			await deleteMutation.mutateAsync({ ids });
			setSelected(new Set());
			setDeleteDialog({ open: false });
			refetch();
			infoToast.success(toastId, {
				title: 'Deleted',
				description: `${label} removed successfully.`,
			});
		} catch {
			infoToast.error(toastId, {
				title: 'Error',
				description: `Could not delete ${label}.`,
			});
		}
	};

	// CAMBIO 2: refresh unitario con infoToast
	const handleSingleRefresh = async (fileId: string) => {
		const toastId = infoToast.loading({ title: 'Re-ingesting file…' });
		try {
			await ingestMutation.mutateAsync({ files: fileId, metadata: null });
			refetch();
			infoToast.success(toastId, {
				title: 'Success',
				description: 'File re-ingested successfully.',
			});
		} catch {
			infoToast.error(toastId, {
				title: 'Error',
				description: 'Could not re-ingest the file.',
			});
		}
	};

	// CAMBIO 2: refresh masivo con infoToast
	const handleMassRefresh = async () => {
		const toastId = infoToast.loading({
			title: `Re-ingesting ${selected.size} file${selected.size !== 1 ? 's' : ''}…`,
		});
		try {
			await ingestMutation.mutateAsync({ files: 'mass', metadata: null });
			refetch();
			infoToast.success(toastId, {
				title: 'Success',
				description: `${selected.size} file${selected.size !== 1 ? 's' : ''} re-ingested.`,
			});
		} catch {
			infoToast.error(toastId, {
				title: 'Error',
				description: 'Could not re-ingest the selected files.',
			});
		}
	};

	const SkeletonRows = () =>
		Array.from({ length: 6 }).map((_, i) => (
			<TableRow key={i} className="h-14">
				{Array.from({ length: 8 }).map((__, j) => (
					<TableCell key={j}>
						<div className="h-3 w-full rounded bg-muted animate-pulse" />
					</TableCell>
				))}
			</TableRow>
		));

	const empty = !isLoading && files.length === 0;
	const currentPage = filters.page ?? 1;
	const hasSelection = selected.size > 0;
	const selectedDate = draft.createdAt ? new Date(draft.createdAt) : undefined;

	// Contenido del dialog derivado del estado
	const dialogTitle = !deleteDialog.open
		? ''
		: deleteDialog.mode === 'single'
			? `Delete "${deleteDialog.fileName}"?`
			: `Delete ${deleteDialog.count} file${deleteDialog.count !== 1 ? 's' : ''}?`;

	const dialogDescription = !deleteDialog.open
		? ''
		: deleteDialog.mode === 'single'
			? `"${deleteDialog.fileName}" will be permanently removed and cannot be recovered.`
			: `You are about to permanently delete ${deleteDialog.count} file${deleteDialog.count !== 1 ? 's' : ''}. This action cannot be undone.`;

	return (
		<Card className="bg-sidebar">
			<CardContent className="p-6 space-y-5">
				{/* Header */}
				<div>
					<h2 className="text-lg font-semibold">File Management</h2>
					<p className="text-sm text-muted-foreground">
						Search, filter and manage all ingested files across providers.
					</p>
				</div>

				<Separator />

				{/* Filter panel */}
				<div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
					<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Filters
					</p>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
						{/* Semantic search */}
						<div className="flex flex-col gap-1">
							<label className="text-xs font-medium text-muted-foreground">
								Semantic search
							</label>
							<div className="relative">
								<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
								<Input
									placeholder="Search content…"
									className="pl-8 h-9 text-sm"
									value={draft.query ?? ''}
									onChange={(e) =>
										setDraft((d) => ({
											...d,
											query: e.target.value || undefined,
										}))
									}
								/>
							</div>
						</div>

						{/* File name */}
						<div className="flex flex-col gap-1">
							<label className="text-xs font-medium text-muted-foreground">
								File name
							</label>
							<Input
								placeholder="Filter by name…"
								className="h-9 text-sm"
								value={draft.name ?? ''}
								onChange={(e) =>
									setDraft((d) => ({ ...d, name: e.target.value || undefined }))
								}
							/>
						</div>

						{/* Provider */}
						<div className="flex flex-col gap-1">
							<label className="text-xs font-medium text-muted-foreground">
								Provider
							</label>
							<Select
								value={(draft.provider as string) ?? ''}
								onValueChange={(v) =>
									setDraft((d) => ({
										...d,
										provider: (v || undefined) as FileHost | undefined,
									}))
								}
							>
								<SelectTrigger className="h-9 min-h-9 px-3 py-1 text-sm w-full">
									<SelectValue placeholder="Any provider…">
										{draft.provider
											? (() => {
													const opt = getProviderOption(
														draft.provider as string,
													);
													return opt ? (
														<div className="flex items-center gap-2">
															<img
																src={opt.icon}
																className="w-4 h-4 object-contain shrink-0"
															/>
															<span>{opt.name}</span>
														</div>
													) : (
														draft.provider
													);
												})()
											: null}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{PROVIDER_OPTIONS.map((opt) => (
										<SelectItem key={opt.id} value={opt.id}>
											<div className="flex items-center gap-2">
												<img
													src={opt.icon}
													className="w-4 h-4 object-contain shrink-0"
												/>
												<span>{opt.name}</span>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* File type select */}
						<div className="flex flex-col gap-1">
							<label className="text-xs font-medium text-muted-foreground">
								File type
							</label>
							<Select
								value={draft.type ?? ''}
								onValueChange={(v) =>
									setDraft((d) => ({ ...d, type: v || undefined }))
								}
							>
								<SelectTrigger className="h-9 min-h-9 px-3 py-1 text-sm w-full">
									<SelectValue placeholder="Any type…">
										{draft.type
											? (() => {
													const opt = getTypeOption(draft.type);
													return opt ? (
														<div className="flex items-center gap-2">
															<span
																className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${opt.color}`}
															>
																{opt.ext}
															</span>
															<span>{opt.label}</span>
														</div>
													) : (
														draft.type
													);
												})()
											: null}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{FILE_TYPE_OPTIONS.map((opt) => (
										<SelectItem key={opt.mime} value={opt.mime}>
											<div className="flex items-center gap-2">
												<span
													className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${opt.color}`}
												>
													{opt.ext}
												</span>
												<span>{opt.label}</span>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{/* CAMBIO 3: Ingested since — Popover + Calendar igual que billing */}
						<div className="flex flex-col gap-1">
							<label className="text-xs font-medium text-muted-foreground">
								Ingested since
							</label>
							<Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
								<PopoverTrigger>
									<Button
										variant="outline"
										size="sm"
										className="h-9 w-full justify-start text-left font-normal cursor-pointer"
									>
										<CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
										{selectedDate ? (
											<span>{format(selectedDate, 'PPP')}</span>
										) : (
											<span className="text-muted-foreground">
												Pick a date…
											</span>
										)}
										{selectedDate && (
											<X
												className="ml-auto h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors"
												onClick={(e) => {
													e.stopPropagation();
													setDraft((d) => ({ ...d, createdAt: undefined }));
													setDatePickerOpen(false);
												}}
											/>
										)}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="end">
									<Calendar
										mode="single"
										selected={selectedDate}
										onSelect={(date) => {
											setDraft((d) => ({
												...d,
												createdAt: date
													? `${format(date, 'yyyy-MM-dd')}T00:00:00Z`
													: undefined,
											}));
											setDatePickerOpen(false);
										}}
										disabled={(date) => date > new Date()}
										autoFocus
									/>
								</PopoverContent>
							</Popover>
						</div>
					</div>

					<div className="flex items-center gap-2 pt-1">
						<Button
							size="sm"
							onClick={applyFilters}
							className="cursor-pointer gap-1.5"
						>
							<Search className="w-3.5 h-3.5" /> Apply filters
						</Button>
						{activeFilters.length > 0 && (
							<Button
								size="sm"
								variant="ghost"
								onClick={clearAllFilters}
								className="cursor-pointer gap-1.5 text-muted-foreground"
							>
								<X className="w-3.5 h-3.5" /> Clear all
							</Button>
						)}
					</div>
				</div>

				{/* Action bar — always visible */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:h-9">
					<div className="flex items-center gap-2 flex-wrap min-h-0 overflow-hidden">
						{activeFilters.length > 0 ? (
							activeFilters.map(({ key, label }) => (
								<FilterPill
									key={key}
									label={label}
									onRemove={() => removeFilter(key)}
								/>
							))
						) : (
							<span className="text-xs text-muted-foreground/50 select-none">
								No active filters
							</span>
						)}
					</div>

					<div className="flex items-center gap-2 shrink-0">
						{hasSelection && (
							<span className="text-xs text-muted-foreground">
								{selected.size} selected
							</span>
						)}
						<Button
							size="sm"
							variant="outline"
							onClick={handleMassRefresh}
							disabled={!hasSelection}
							className="gap-1.5 cursor-pointer disabled:opacity-40"
						>
							<RefreshCcw className="w-3.5 h-3.5" /> Refresh
						</Button>
						{/* CAMBIO 1: bulk delete abre el dialog en modo "bulk" */}
						<Button
							size="sm"
							variant="destructive"
							disabled={!hasSelection}
							onClick={() =>
								setDeleteDialog({
									open: true,
									mode: 'bulk',
									count: selected.size,
									ids: [...selected],
								})
							}
							className="gap-1.5 cursor-pointer disabled:opacity-40"
						>
							<Trash2 className="w-3.5 h-3.5" /> Delete
						</Button>
					</div>
				</div>

				{/* Table */}
				<div className="rounded-lg border border-border overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow className="bg-muted/40 hover:bg-muted/40">
								<TableHead className="w-10">
									<Checkbox
										checked={files.length > 0 && selected.size === files.length}
										onCheckedChange={toggleSelectAll}
									/>
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									Name
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									Owner
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									Provider
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									Type
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									Ingested
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									Updated At
								</TableHead>
								<TableHead className="text-right font-semibold text-xs uppercase tracking-wider">
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>

						<TableBody>
							{isLoading && <SkeletonRows />}

							{empty && (
								<TableRow>
									<TableCell colSpan={8}>
										<div className="flex flex-col items-center py-14 text-center gap-2">
											<div className="rounded-full bg-muted p-3">
												<FileText className="w-5 h-5 text-muted-foreground" />
											</div>
											<p className="text-sm font-medium">No files found</p>
											<p className="text-xs text-muted-foreground max-w-xs">
												Try adjusting your filters or ingesting new files from
												your connected sources.
											</p>
										</div>
									</TableCell>
								</TableRow>
							)}

							{!isLoading &&
								!empty &&
								files.map((file) => (
									<TableRow
										key={file.id}
										className={`transition-colors ${selected.has(file.id) ? 'bg-primary/5' : ''}`}
									>
										<TableCell>
											<Checkbox
												checked={selected.has(file.id)}
												onCheckedChange={() => toggleSelect(file.id)}
											/>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2 min-w-0">
												<div className="rounded-md bg-muted p-1.5 shrink-0">
													<FileText className="w-3.5 h-3.5 text-muted-foreground" />
												</div>
												{file.url ? (
													<a
														href={file.url}
														target="_blank"
														rel="noopener noreferrer"
														className="text-sm font-medium truncate max-w-[180px] hover:underline"
													>
														{file.name}
														<ExternalLink className="w-3 h-3 inline-block ml-1 align-baseline text-muted-foreground" />
													</a>
												) : (
													<span className="text-sm font-medium truncate max-w-[180px]">
														{file.name}
													</span>
												)}
											</div>
										</TableCell>
										<TableCell>
											<UserMini user={file.ownedBy} />
										</TableCell>
										<TableCell>
											<ProviderBadge provider={file.provider} />
										</TableCell>
										<TableCell>
											<TypeBadge type={file.type} />
										</TableCell>
										<TableCell>
											<span className="text-sm whitespace-nowrap">
												{format(new Date(file.ingestedAt), 'MMM d, yyyy HH:mm')}
											</span>
										</TableCell>
										<TableCell>
											<span className="text-sm whitespace-nowrap">
												{format(new Date(file.modifiedAt), 'MMM d, yyyy HH:mm')}
											</span>
										</TableCell>
										<TableCell>
											<div className="flex justify-end gap-1">
												<TooltipProvider>
													<Tooltip>
														<TooltipTrigger>
															{/* CAMBIO 2: refresh unitario con su propio handler */}
															<Button
																size="icon"
																variant="ghost"
																className="h-8 w-8 cursor-pointer"
																onClick={() => handleSingleRefresh(file.id)}
															>
																<RefreshCcw className="w-3.5 h-3.5" />
															</Button>
														</TooltipTrigger>
														<TooltipContent>Re-ingest file</TooltipContent>
													</Tooltip>
													<Tooltip>
														<TooltipTrigger>
															{/* CAMBIO 1: delete unitario abre el dialog en modo "single" con el nombre */}
															<Button
																size="icon"
																variant="ghost"
																className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10"
																onClick={() =>
																	setDeleteDialog({
																		open: true,
																		mode: 'single',
																		fileId: file.id,
																		fileName: file.name,
																	})
																}
															>
																<Trash2 className="w-3.5 h-3.5" />
															</Button>
														</TooltipTrigger>
														<TooltipContent>Delete file</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											</div>
										</TableCell>
									</TableRow>
								))}
						</TableBody>

						<TableFooter className="bg-muted/30">
							<TableRow>
								<TableCell colSpan={5}>
									<span className="text-xs text-muted-foreground">
										{files.length > 0
											? `${files.length} file${files.length !== 1 ? 's' : ''} on this page`
											: 'No results'}
									</span>
								</TableCell>
								<TableCell colSpan={3}>
									<div className="flex items-center justify-end gap-2">
										<span className="text-xs text-muted-foreground">
											Page {currentPage}
										</span>
										<Button
											size="sm"
											variant="outline"
											onClick={prevPage}
											disabled={currentPage === 1}
											className="h-7 w-7 p-0 cursor-pointer"
										>
											<ChevronLeft className="w-4 h-4" />
										</Button>
										<Button
											size="sm"
											variant="outline"
											onClick={nextPage}
											disabled={files.length === 0}
											className="h-7 w-7 p-0 cursor-pointer"
										>
											<ChevronRight className="w-4 h-4" />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						</TableFooter>
					</Table>
				</div>
			</CardContent>

			{/* CAMBIO 1+2: dialog diferenciado single/bulk con infoToast */}
			<Dialog
				open={deleteDialog.open}
				onOpenChange={(open) => !open && setDeleteDialog({ open: false })}
			>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>{dialogTitle}</DialogTitle>
						<DialogDescription>{dialogDescription}</DialogDescription>
					</DialogHeader>
					<DialogFooter className="flex justify-end gap-2">
						<Button
							variant="outline"
							className="cursor-pointer"
							onClick={() => setDeleteDialog({ open: false })}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							className="cursor-pointer"
							onClick={handleConfirmDelete}
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
