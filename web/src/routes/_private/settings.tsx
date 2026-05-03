import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { format } from 'date-fns';
import {
	ArrowLeft,
	CalendarIcon,
	CheckCircle,
	ChevronLeft,
	ChevronRight,
	ExternalLink,
	FileText,
	FolderSync,
	Info,
	RefreshCcw,
	Search,
	Settings as SettingsIcon,
	Trash2,
	Upload,
	X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ConfirmDeleteCredentialModal } from '@/components/credentials/credential-delete-modal';
import { infoToast } from '@/components/info-toast/info-toast';
import { SourceRow } from '@/components/sources/source-row';
import { StorageFileTree } from '@/components/sources/file-tree';
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
import { Switch } from '@/components/ui/switch';
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
	LEGAJOX_SOURCE,
	STORAGE_DATA_SOURCES,
} from '@/lib/available-sources';
import type { CredentialItem } from '@/lib/credential';
import {
	canManageCredential,
	deleteCredentialById,
	listCredentials,
} from '@/lib/credential';
import { extractErrorText } from '@/lib/error';
import type {
	ExternalDirListParams,
	ReIngestResult,
	SearchFilesParams,
	SearchFilesResult,
} from '@/lib/file';
import {
	deleteExternalDir,
	reIngestByProvider,
	updateExternalDir,
	updateFileAutoSync,
	useDeleteFiles,
	useExternalDirs,
	useIngestFiles,
	useSearchFiles,
} from '@/lib/file';
import { useMe, useMyTenant } from '@/lib/user';
import {
	'common.cancel' as common_cancel,
	'common.delete' as common_delete,
	'common.error' as common_error,
	'common.no_changes' as common_no_changes,
	'common.success' as common_success,
	'components.credentials.toast.delete.error' as components_credentials_toast_delete_error,
	'components.credentials.toast.delete.loading' as components_credentials_toast_delete_loading,
	'components.credentials.toast.delete.success' as components_credentials_toast_delete_success,
	'settings.actions.admin_panel' as settings_actions_admin_panel,
	'settings.actions.back_to_chat' as settings_actions_back_to_chat,
	'settings.dirs.actions.delete' as settings_dirs_actions_delete,
	'settings.dirs.delete_dialog.description_bulk' as settings_dirs_delete_dialog_description_bulk,
	'settings.dirs.delete_dialog.description_single' as settings_dirs_delete_dialog_description_single,
	'settings.dirs.delete_dialog.label_bulk' as settings_dirs_delete_dialog_label_bulk,
	'settings.dirs.delete_dialog.title_bulk' as settings_dirs_delete_dialog_title_bulk,
	'settings.dirs.delete_dialog.title_single' as settings_dirs_delete_dialog_title_single,
	'settings.dirs.description' as settings_dirs_description,
	'settings.dirs.empty.description' as settings_dirs_empty_description,
	'settings.dirs.empty.title' as settings_dirs_empty_title,
	'settings.dirs.filters.any_provider' as settings_dirs_filters_any_provider,
	'settings.dirs.pagination.no_results' as settings_dirs_pagination_no_results,
	'settings.dirs.pagination.page' as settings_dirs_pagination_page,
	'settings.dirs.pagination.page_count' as settings_dirs_pagination_page_count,
	'settings.dirs.selection.count' as settings_dirs_selection_count,
	'settings.dirs.table.actions' as settings_dirs_table_actions,
	'settings.dirs.table.auto_sync' as settings_dirs_table_auto_sync,
	'settings.dirs.table.credential' as settings_dirs_table_credential,
	'settings.dirs.table.modified' as settings_dirs_table_modified,
	'settings.dirs.table.name' as settings_dirs_table_name,
	'settings.dirs.table.provider' as settings_dirs_table_provider,
	'settings.dirs.title' as settings_dirs_title,
	'settings.dirs.toast.autosync_error' as settings_dirs_toast_autosync_error,
	'settings.dirs.toast.autosync_updated' as settings_dirs_toast_autosync_updated,
	'settings.dirs.toast.delete_error_desc' as settings_dirs_toast_delete_error_desc,
	'settings.dirs.toast.delete_loading' as settings_dirs_toast_delete_loading,
	'settings.dirs.toast.delete_success' as settings_dirs_toast_delete_success,
	'settings.dirs.toast.delete_success_desc' as settings_dirs_toast_delete_success_desc,
	'settings.dirs.tooltip.autosync_off' as settings_dirs_tooltip_autosync_off,
	'settings.dirs.tooltip.autosync_on' as settings_dirs_tooltip_autosync_on,
	'settings.dirs.tooltip.delete' as settings_dirs_tooltip_delete,
	'settings.dirs.tooltip.open_url' as settings_dirs_tooltip_open_url,
	'settings.files.actions.delete' as settings_files_actions_delete,
	'settings.files.actions.refresh' as settings_files_actions_refresh,
	'settings.files.actions.upload' as settings_files_actions_upload,
	'settings.files.active_filters.name' as settings_files_active_filters_name,
	'settings.files.active_filters.none' as settings_files_active_filters_none,
	'settings.files.active_filters.provider' as settings_files_active_filters_provider,
	'settings.files.active_filters.search' as settings_files_active_filters_search,
	'settings.files.active_filters.since' as settings_files_active_filters_since,
	'settings.files.active_filters.type' as settings_files_active_filters_type,
	'settings.files.delete_dialog.description_bulk' as settings_files_delete_dialog_description_bulk,
	'settings.files.delete_dialog.description_single' as settings_files_delete_dialog_description_single,
	'settings.files.delete_dialog.label_bulk' as settings_files_delete_dialog_label_bulk,
	'settings.files.delete_dialog.title_bulk' as settings_files_delete_dialog_title_bulk,
	'settings.files.delete_dialog.title_single' as settings_files_delete_dialog_title_single,
	'settings.files.description' as settings_files_description,
	'settings.files.empty.description' as settings_files_empty_description,
	'settings.files.empty.title' as settings_files_empty_title,
	'settings.files.filters.any_provider' as settings_files_filters_any_provider,
	'settings.files.filters.any_type' as settings_files_filters_any_type,
	'settings.files.filters.apply' as settings_files_filters_apply,
	'settings.files.filters.clear_all' as settings_files_filters_clear_all,
	'settings.files.filters.file_name' as settings_files_filters_file_name,
	'settings.files.filters.file_type' as settings_files_filters_file_type,
	'settings.files.filters.ingested_since' as settings_files_filters_ingested_since,
	'settings.files.filters.label' as settings_files_filters_label,
	'settings.files.filters.name_placeholder' as settings_files_filters_name_placeholder,
	'settings.files.filters.pick_date' as settings_files_filters_pick_date,
	'settings.files.filters.provider' as settings_files_filters_provider,
	'settings.files.filters.search_placeholder' as settings_files_filters_search_placeholder,
	'settings.files.filters.semantic_search' as settings_files_filters_semantic_search,
	'settings.files.pagination.no_results' as settings_files_pagination_no_results,
	'settings.files.pagination.page' as settings_files_pagination_page,
	'settings.files.pagination.page_count' as settings_files_pagination_page_count,
	'settings.files.selection.count' as settings_files_selection_count,
	'settings.files.table.actions' as settings_files_table_actions,
	'settings.files.table.auto_sync' as settings_files_table_auto_sync,
	'settings.files.table.ingested' as settings_files_table_ingested,
	'settings.files.table.name' as settings_files_table_name,
	'settings.files.table.ingested_by' as settings_files_table_ingested_by,
	'settings.files.table.provider' as settings_files_table_provider,
	'settings.files.table.type' as settings_files_table_type,
	'settings.files.table.updated_at' as settings_files_table_updated_at,
	'settings.files.title' as settings_files_title,
	'settings.files.toast.autosync_error' as settings_files_toast_autosync_error,
	'settings.files.toast.autosync_updated' as settings_files_toast_autosync_updated,
	'settings.files.toast.delete_error_desc' as settings_files_toast_delete_error_desc,
	'settings.files.toast.delete_loading' as settings_files_toast_delete_loading,
	'settings.files.toast.delete_success' as settings_files_toast_delete_success,
	'settings.files.toast.delete_success_desc' as settings_files_toast_delete_success_desc,
	'settings.files.toast.reingest_all_unmodified_desc' as settings_files_toast_reingest_all_unmodified_desc,
	'settings.files.toast.reingest_bulk_error_desc' as settings_files_toast_reingest_bulk_error_desc,
	'settings.files.toast.reingest_bulk_loading' as settings_files_toast_reingest_bulk_loading,
	'settings.files.toast.reingest_error_desc' as settings_files_toast_reingest_error_desc,
	'settings.files.toast.reingest_loading' as settings_files_toast_reingest_loading,
	'settings.files.toast.reingest_result_desc' as settings_files_toast_reingest_result_desc,
	'settings.files.toast.reingest_success_desc' as settings_files_toast_reingest_success_desc,
	'settings.files.toast.reingest_unmodified_desc' as settings_files_toast_reingest_unmodified_desc,
	'settings.files.toast.upload_error_desc' as settings_files_toast_upload_error_desc,
	'settings.files.toast.upload_loading' as settings_files_toast_upload_loading,
	'settings.files.toast.upload_success' as settings_files_toast_upload_success,
	'settings.files.toast.upload_success_desc' as settings_files_toast_upload_success_desc,
	'settings.files.tooltip.autosync_off' as settings_files_tooltip_autosync_off,
	'settings.files.tooltip.autosync_on' as settings_files_tooltip_autosync_on,
	'settings.files.tooltip.autosync_unavailable' as settings_files_tooltip_autosync_unavailable,
	'settings.files.tooltip.credential_owner' as settings_files_tooltip_credential_owner,
	'settings.files.tooltip.delete' as settings_files_tooltip_delete,
	'settings.files.tooltip.reingest' as settings_files_tooltip_reingest,
	'settings.files.user.system' as settings_files_user_system,
	'settings.meta.title' as settings_meta_title,
	'settings.sources.description' as settings_sources_description,
	'settings.sources.title' as settings_sources_title,
	'settings.sources.view_details' as settings_sources_view_details,
	'settings.storage.description' as settings_storage_description,
	'settings.storage.legajox_description' as settings_storage_legajox_description,
	'settings.storage.legajox_status' as settings_storage_legajox_status,
	'settings.storage.title' as settings_storage_title,
	'settings.subtitle' as settings_subtitle,
	'settings.title' as settings_title,
} from '@/paraglide/messages.js';

export const Route = createFileRoute('/_private/settings')({
	component: SettingsPage,
	head: () => ({
		meta: [
			{ title: settings_meta_title() },
			{ name: 'robots', content: 'noindex' },
		],
	}),
});

// ------------------------------- Settings Page ----------------------------------
function SettingsPage() {
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
				description:
					extractErrorText(err) ?? components_credentials_toast_delete_error(),
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

				<ExternalDirsSection />
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
		<Card className="bg-sidebar" data-tour="settings-sources">
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
	const { data: myTenant } = useMyTenant();
	const [expandedCredentialId, setExpandedCredentialId] = useState<
		string | null
	>(null);
	const [legajoxExpanded, setLegajoxExpanded] = useState(false);

	const canManage = (cred: CredentialItem) => canManageCredential(cred, me);

	const showLegajox = (() => {
		if (!me?.isAdmin || !myTenant?.slug) return false;
		const allowed = (import.meta.env.VITE_LEGAJOX_ALLOWED_SLUGS ?? '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		return allowed.includes(myTenant.slug);
	})();

	return (
		<Card className="bg-sidebar" data-tour="settings-storage">
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

					{showLegajox && (
						<div className="rounded-xl border p-3 space-y-3">
							<div className="flex items-center justify-between gap-x-4 gap-y-2 flex-wrap">
								<div className="flex items-center gap-3">
									<img
										src="/datasource_icons/legajox.svg"
										className="h-6 w-6 object-contain"
										alt="Legajox"
									/>
									<span className="font-medium">Legajox</span>
									<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
										<CheckCircle className="w-3 h-3" />
										{settings_storage_legajox_status()}
									</span>
								</div>
								<Button
									size="sm"
									variant="ghost"
									className="cursor-pointer"
									onClick={() => setLegajoxExpanded(!legajoxExpanded)}
								>
									{legajoxExpanded ? common_cancel() : settings_sources_view_details()}
								</Button>
							</div>
							{!legajoxExpanded && (
								<p className="text-xs text-muted-foreground">
									{settings_storage_legajox_description()}
								</p>
							)}
							{legajoxExpanded && (
								<StorageFileTree
									credentialId="legajox"
									source={LEGAJOX_SOURCE}
								/>
							)}
						</div>
					)}
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
	{ id: 'legajox', name: 'Legajox', icon: '/datasource_icons/legajox.svg' },
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

function getLegajoxUrl(id: string) {
	if (id.startsWith('http://') || id.startsWith('https://')) return id;
	return `https://app.legajox.com/${id.replace(/^\/+/, '')}`;
}

function getFileExternalUrl(file: SearchFilesResult[number]) {
	if (file.provider === 'legajox' && file.externalId)
		return getLegajoxUrl(file.externalId);

	return file.url;
}

function canToggleFileAutoSync(provider?: string | null) {
	return provider !== 'nexata' && provider !== 'legajox';
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
		return (
			<span className="text-xs text-muted-foreground italic">
				{settings_files_user_system()}
			</span>
		);
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
	const deleteMutation = useDeleteFiles();
	const ingestMutation = useIngestFiles();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleUpload = async () => {
		const selectedFiles = fileInputRef.current?.files;
		if (!selectedFiles || selectedFiles.length === 0) return;

		const count = String(selectedFiles.length);
		const toastId = infoToast.loading({
			title: settings_files_toast_upload_loading({ count }),
		});
		try {
			await ingestMutation.mutateAsync({
				files: selectedFiles,
			});
			refetch();
			infoToast.success(toastId, {
				title: settings_files_toast_upload_success(),
				description: settings_files_toast_upload_success_desc({ count }),
			});
		} catch (error) {
			infoToast.error(toastId, {
				title: common_error(),
				description:
					extractErrorText(error) ?? settings_files_toast_upload_error_desc(),
			});
		} finally {
			if (fileInputRef.current) fileInputRef.current.value = '';
		}
	};

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
			? [
					{
						key: 'query' as const,
						label: settings_files_active_filters_search({
							query: filters.query,
						}),
					},
				]
			: []),
		...(filters.name
			? [
					{
						key: 'name' as const,
						label: settings_files_active_filters_name({ name: filters.name }),
					},
				]
			: []),
		...(filters.provider
			? [
					{
						key: 'provider' as const,
						label: settings_files_active_filters_provider({
							provider: filters.provider,
						}),
					},
				]
			: []),
		...(filters.type
			? [
					{
						key: 'type' as const,
						label: settings_files_active_filters_type({
							type: getTypeOption(filters.type)?.label ?? filters.type,
						}),
					},
				]
			: []),
		...(filters.createdAt
			? [
					{
						key: 'createdAt' as const,
						label: settings_files_active_filters_since({
							date: filters.createdAt.split('T')[0]!,
						}),
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
				: settings_files_delete_dialog_label_bulk({
						count: deleteDialog.count,
					});
		const toastId = infoToast.loading({
			title: settings_files_toast_delete_loading({ label }),
		});
		try {
			await deleteMutation.mutateAsync({ ids });
			setSelected(new Set());
			setDeleteDialog({ open: false });
			refetch();
			infoToast.success(toastId, {
				title: settings_files_toast_delete_success(),
				description: settings_files_toast_delete_success_desc({ label }),
			});
		} catch (error) {
			infoToast.error(toastId, {
				title: common_error(),
				description:
					extractErrorText(error) ??
					settings_files_toast_delete_error_desc({ label }),
			});
		}
	};

	// CAMBIO 2: refresh unitario con infoToast
	const handleSingleRefresh = async (fileId: string) => {
		const file = files.find((f) => f.id === fileId);
		if (!file || file.provider === 'nexata' || !file.credential) return;

		const toastId = infoToast.loading({
			title: settings_files_toast_reingest_loading(),
		});
		try {
			const result: ReIngestResult = await reIngestByProvider(file.provider, {
				credentialId: file.credential.id,
				selection: [{ id: file.id, isDir: false }],
			});
			refetch();

			if (result.failed > 0) {
				infoToast.error(toastId, {
					title: common_error(),
					description: settings_files_toast_reingest_error_desc(),
				});
			} else if (result.ok > 0) {
				infoToast.success(toastId, {
					title: common_success(),
					description: settings_files_toast_reingest_success_desc(),
				});
			} else {
				infoToast.info(toastId, {
					title: common_no_changes(),
					description: settings_files_toast_reingest_unmodified_desc(),
				});
			}
		} catch (error) {
			infoToast.error(toastId, {
				title: common_error(),
				description:
					extractErrorText(error) ?? settings_files_toast_reingest_error_desc(),
			});
		}
	};

	// CAMBIO 2: refresh masivo con infoToast
	const handleMassRefresh = async () => {
		// Group selected files by provider + credentialId
		const groups = new Map<
			string,
			{ provider: string; credentialId: string; fileIds: string[] }
		>();
		for (const id of selected) {
			const file = files.find((f) => f.id === id);
			if (!file || file.provider === 'nexata' || !file.credential) continue;
			const key = `${file.provider}::${file.credential.id}`;
			const group = groups.get(key);
			if (group) {
				group.fileIds.push(file.id);
			} else {
				groups.set(key, {
					provider: file.provider,
					credentialId: file.credential.id,
					fileIds: [file.id],
				});
			}
		}

		if (groups.size === 0) return;

		const toastId = infoToast.loading({
			title: settings_files_toast_reingest_bulk_loading({
				count: String(selected.size),
			}),
		});
		try {
			const results = await Promise.all(
				[...groups.values()].map((g) =>
					reIngestByProvider(g.provider, {
						credentialId: g.credentialId,
						selection: g.fileIds.map((id) => ({ id, isDir: false })),
					}),
				),
			);
			refetch();

			// Aggregate results across all provider groups
			const totals = results.reduce<ReIngestResult>(
				(acc, r) => ({
					ok: acc.ok + r.ok,
					unmodified: acc.unmodified + r.unmodified,
					failed: acc.failed + r.failed,
				}),
				{ ok: 0, unmodified: 0, failed: 0 },
			);

			const desc = settings_files_toast_reingest_result_desc({
				ok: String(totals.ok),
				unmodified: String(totals.unmodified),
				failed: String(totals.failed),
			});

			if (totals.failed > 0) {
				infoToast.error(toastId, {
					title: common_error(),
					description: desc,
				});
			} else if (totals.ok > 0) {
				infoToast.success(toastId, {
					title: common_success(),
					description: desc,
				});
			} else {
				infoToast.info(toastId, {
					title: common_no_changes(),
					description: settings_files_toast_reingest_all_unmodified_desc(),
				});
			}
		} catch (error) {
			infoToast.error(toastId, {
				title: common_error(),
				description:
					extractErrorText(error) ??
					settings_files_toast_reingest_bulk_error_desc(),
			});
		}
	};

	const handleFileAutoSyncToggle = async (fileId: string, value: boolean) => {
		const file = files.find((f) => f.id === fileId);
		if (!file || !canToggleFileAutoSync(file.provider)) return;

		try {
			await updateFileAutoSync(fileId, value);
			refetch();
			infoToast.success({
				title: settings_files_toast_autosync_updated(),
			});
		} catch (error) {
			infoToast.error({
				title: common_error(),
				description:
					extractErrorText(error) ?? settings_files_toast_autosync_error(),
			});
		}
	};

	const SkeletonRows = () =>
		Array.from({ length: 6 }).map((_, i) => (
			<TableRow key={i} className="h-14">
				{Array.from({ length: 9 }).map((__, j) => (
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
			? settings_files_delete_dialog_title_single({
					name: deleteDialog.fileName,
				})
			: settings_files_delete_dialog_title_bulk({
					count: String(deleteDialog.count),
				});

	const dialogDescription = !deleteDialog.open
		? ''
		: deleteDialog.mode === 'single'
			? settings_files_delete_dialog_description_single({
					name: deleteDialog.fileName,
				})
			: settings_files_delete_dialog_description_bulk({
					count: String(deleteDialog.count),
				});

	return (
		<Card className="bg-sidebar" data-tour="settings-files">
			<CardContent className="p-6 space-y-5">
				{/* Header */}
				<div>
					<h2 className="text-lg font-semibold">{settings_files_title()}</h2>
					<p className="text-sm text-muted-foreground">
						{settings_files_description()}
					</p>
				</div>

				<Separator />

				{/* Filter panel */}
				<div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
					<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{settings_files_filters_label()}
					</p>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
						{/* Semantic search */}
						<div className="flex flex-col gap-1">
							<label className="text-xs font-medium text-muted-foreground">
								{settings_files_filters_semantic_search()}
							</label>
							<div className="relative">
								<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
								<Input
									placeholder={settings_files_filters_search_placeholder()}
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
								{settings_files_filters_file_name()}
							</label>
							<Input
								placeholder={settings_files_filters_name_placeholder()}
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
								{settings_files_filters_provider()}
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
									<SelectValue
										placeholder={settings_files_filters_any_provider()}
									>
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
								{settings_files_filters_file_type()}
							</label>
							<Select
								value={draft.type ?? ''}
								onValueChange={(v) =>
									setDraft((d) => ({ ...d, type: v || undefined }))
								}
							>
								<SelectTrigger className="h-9 min-h-9 px-3 py-1 text-sm w-full">
									<SelectValue placeholder={settings_files_filters_any_type()}>
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
								{settings_files_filters_ingested_since()}
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
												{settings_files_filters_pick_date()}
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
							<Search className="w-3.5 h-3.5" />{' '}
							{settings_files_filters_apply()}
						</Button>
						{activeFilters.length > 0 && (
							<Button
								size="sm"
								variant="ghost"
								onClick={clearAllFilters}
								className="cursor-pointer gap-1.5 text-muted-foreground"
							>
								<X className="w-3.5 h-3.5" />{' '}
								{settings_files_filters_clear_all()}
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
								{settings_files_active_filters_none()}
							</span>
						)}
					</div>

					<div className="flex items-center gap-2 shrink-0">
						{hasSelection && (
							<span className="text-xs text-muted-foreground">
								{settings_files_selection_count({
									count: String(selected.size),
								})}
							</span>
						)}
						<input
							type="file"
							ref={fileInputRef}
							multiple
							onChange={handleUpload}
							className="hidden"
						/>
						<Button
							size="sm"
							variant="default"
							onClick={() => fileInputRef.current?.click()}
							disabled={ingestMutation.isPending}
							className="gap-1.5 cursor-pointer"
						>
							<Upload className="w-3.5 h-3.5" />{' '}
							{settings_files_actions_upload()}
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={handleMassRefresh}
							disabled={!hasSelection}
							className="gap-1.5 cursor-pointer disabled:opacity-40"
						>
							<RefreshCcw className="w-3.5 h-3.5" />{' '}
							{settings_files_actions_refresh()}
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
							<Trash2 className="w-3.5 h-3.5" />{' '}
							{settings_files_actions_delete()}
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
									{settings_files_table_name()}
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									{settings_files_table_ingested_by()}
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									{settings_files_table_provider()}
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									{settings_files_table_type()}
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									{settings_files_table_ingested()}
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									{settings_files_table_updated_at()}
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider text-center">
									{settings_files_table_auto_sync()}
								</TableHead>
								<TableHead className="text-right font-semibold text-xs uppercase tracking-wider">
									{settings_files_table_actions()}
								</TableHead>
							</TableRow>
						</TableHeader>

						<TableBody>
							{isLoading && <SkeletonRows />}

							{empty && (
								<TableRow>
									<TableCell colSpan={9}>
										<div className="flex flex-col items-center py-14 text-center gap-2">
											<div className="rounded-full bg-muted p-3">
												<FileText className="w-5 h-5 text-muted-foreground" />
											</div>
											<p className="text-sm font-medium">
												{settings_files_empty_title()}
											</p>
											<p className="text-xs text-muted-foreground max-w-xs">
												{settings_files_empty_description()}
											</p>
										</div>
									</TableCell>
								</TableRow>
							)}

							{!isLoading &&
								!empty &&
								files.map((file) => {
									const externalUrl = getFileExternalUrl(file);
									const canAutoSync = canToggleFileAutoSync(file.provider);

									return (
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
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<div className="flex items-center gap-2 min-w-0 cursor-default">
															<div className="rounded-md bg-muted p-1.5 shrink-0">
																<FileText className="w-3.5 h-3.5 text-muted-foreground" />
															</div>
																		{externalUrl ? (
																			<a
																				href={externalUrl}
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
													</TooltipTrigger>
													<TooltipContent>{file.name}</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2 min-w-0">
												<UserMini user={file.ownedBy} />
												{file.credential && (
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 cursor-help" />
															</TooltipTrigger>
															<TooltipContent>
																<div className="text-center">
																	<p className="font-bold text-xs">
																		{settings_files_tooltip_credential_owner()}
																	</p>
																	<p className="text-xs">
																		{file.credential.email}
																	</p>
																</div>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												)}
											</div>
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
										<TableCell className="text-center">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<div className="inline-flex">
															<Switch
																checked={file.autoSync ?? false}
																disabled={!canAutoSync}
																onCheckedChange={(v) =>
																	handleFileAutoSyncToggle(file.id, v)
																}
																className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
															/>
														</div>
													</TooltipTrigger>
													<TooltipContent>
														{!canAutoSync
															? settings_files_tooltip_autosync_unavailable()
															: file.autoSync
																? settings_files_tooltip_autosync_on()
																: settings_files_tooltip_autosync_off()}
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
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
																className="h-8 w-8 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
																disabled={
																	file.provider === 'nexata' || !file.credential
																}
																onClick={() => handleSingleRefresh(file.id)}
															>
																<RefreshCcw className="w-3.5 h-3.5" />
															</Button>
														</TooltipTrigger>
														<TooltipContent>
															{settings_files_tooltip_reingest()}
														</TooltipContent>
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
														<TooltipContent>
															{settings_files_tooltip_delete()}
														</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											</div>
										</TableCell>
									</TableRow>
									);
								})}
						</TableBody>

						<TableFooter className="bg-muted/30">
							<TableRow>
								<TableCell colSpan={5}>
									<span className="text-xs text-muted-foreground">
										{files.length > 0
											? settings_files_pagination_page_count({
													count: String(files.length),
												})
											: settings_files_pagination_no_results()}
									</span>
								</TableCell>
								<TableCell colSpan={4}>
									<div className="flex items-center justify-end gap-2">
										<span className="text-xs text-muted-foreground">
											{settings_files_pagination_page({
												page: String(currentPage),
											})}
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
							{common_cancel()}
						</Button>

						<Button
							variant="destructive"
							className="cursor-pointer"
							onClick={handleConfirmDelete}
						>
							{common_delete()}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}

// --------------------------------------------------------------------------------
// ----------------------- External Directories Section ---------------------------
// --------------------------------------------------------------------------------

type DirDeleteDialogState =
	| { open: false }
	| { open: true; mode: 'single'; dirId: string; dirName: string }
	| { open: true; mode: 'bulk'; count: number; ids: string[] };

export function ExternalDirsSection() {
	const [filters, setFilters] = useState<ExternalDirListParams>({ page: 1 });
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [deleteDialog, setDeleteDialog] = useState<DirDeleteDialogState>({
		open: false,
	});
	const queryClient = useQueryClient();

	const { data: dirs = [], isLoading, refetch } = useExternalDirs(filters);

	const toggleSelect = (id: string) =>
		setSelected((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});

	const toggleSelectAll = () =>
		setSelected(
			selected.size === dirs.length
				? new Set()
				: new Set(dirs.map((d) => d.id)),
		);

	const nextPage = () =>
		setFilters((f) => ({ ...f, page: ((f?.page as number) ?? 1) + 1 }));
	const prevPage = () =>
		setFilters((f) => ({
			...f,
			page: Math.max(1, ((f?.page as number) ?? 1) - 1),
		}));

	const currentPage = (filters?.page as number) ?? 1;
	const hasSelection = selected.size > 0;
	const empty = !isLoading && dirs.length === 0;

	const handleDirAutoSyncToggle = async (dirId: string, value: boolean) => {
		try {
			await updateExternalDir(dirId, value);
			refetch();
			infoToast.success({
				title: settings_dirs_toast_autosync_updated(),
			});
		} catch (error) {
			infoToast.error({
				title: common_error(),
				description:
					extractErrorText(error) ?? settings_dirs_toast_autosync_error(),
			});
		}
	};

	const handleSingleDirRefresh = async (dirId: string) => {
		const dir = dirs.find((d) => d.id === dirId);
		if (!dir) return;

		const toastId = infoToast.loading({
			title: settings_files_actions_refresh(),
		});

		try {
			const result = await reIngestByProvider(dir.provider, {
				credentialId: dir.credentialId,
				selection: [{ id: dir.id, isDir: true }],
			});

			refetch();
			await queryClient.invalidateQueries({ queryKey: ['platform-files'] });

			if (result.failed > 0) {
				infoToast.error(toastId, {
					title: common_error(),
				});
			} else if (result.ok > 0) {
				infoToast.success(toastId, {
					title: common_success(),
				});
			} else {
				infoToast.info(toastId, {
					title: common_no_changes(),
				});
			}
		} catch (error) {
			infoToast.error(toastId, {
				title: common_error(),
				description: extractErrorText(error) ?? undefined,
			});
		}
	};

	const handleConfirmDeleteDir = async () => {
		if (!deleteDialog.open) return;
		const ids =
			deleteDialog.mode === 'single' ? [deleteDialog.dirId] : deleteDialog.ids;
		const label =
			deleteDialog.mode === 'single'
				? `"${deleteDialog.dirName}"`
				: settings_dirs_delete_dialog_label_bulk({
						count: String(
							deleteDialog.mode === 'bulk' ? deleteDialog.count : 1,
						),
					});
		const toastId = infoToast.loading({
			title: settings_dirs_toast_delete_loading({ label }),
		});
		try {
			await Promise.all(ids.map((id) => deleteExternalDir(id)));
			setSelected(new Set());
			setDeleteDialog({ open: false });
			refetch();
			await queryClient.invalidateQueries({ queryKey: ['platform-files'] });
			infoToast.success(toastId, {
				title: settings_dirs_toast_delete_success(),
				description: settings_dirs_toast_delete_success_desc({ label }),
			});
		} catch (error) {
			infoToast.error(toastId, {
				title: common_error(),
				description:
					extractErrorText(error) ??
					settings_dirs_toast_delete_error_desc({ label }),
			});
		}
	};

	const dialogTitle = !deleteDialog.open
		? ''
		: deleteDialog.mode === 'single'
			? settings_dirs_delete_dialog_title_single({
					name: deleteDialog.dirName,
				})
			: settings_dirs_delete_dialog_title_bulk({
					count: String(deleteDialog.count),
				});

	const dialogDescription = !deleteDialog.open
		? ''
		: deleteDialog.mode === 'single'
			? settings_dirs_delete_dialog_description_single({
					name: deleteDialog.dirName,
				})
			: settings_dirs_delete_dialog_description_bulk({
					count: String(deleteDialog.count),
				});

	const DirSkeletonRows = () =>
		Array.from({ length: 4 }).map((_, i) => (
			<TableRow key={i} className="h-14">
				{Array.from({ length: 7 }).map((__, j) => (
					<TableCell key={j}>
						<div className="h-3 w-full rounded bg-muted animate-pulse" />
					</TableCell>
				))}
			</TableRow>
		));

	return (
		<Card className="bg-sidebar" data-tour="settings-external-dirs">
			<CardContent className="p-6 space-y-5">
				{/* Header */}
				<div>
					<h2 className="text-lg font-semibold">{settings_dirs_title()}</h2>
					<p className="text-sm text-muted-foreground">
						{settings_dirs_description()}
					</p>
				</div>

				<Separator />

				{/* Filter + actions bar */}
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:h-9">
					<div className="flex items-center gap-3">
						{/* Provider filter */}
						<Select
							value={(filters?.provider as string) ?? ''}
							onValueChange={(v) =>
								setFilters((f) => ({
									...f,
									provider: (v ||
										undefined) as ExternalDirListParams['provider'],
									page: 1,
								}))
							}
						>
							<SelectTrigger className="h-9 min-h-9 px-3 py-1 text-sm w-[180px]">
								<SelectValue placeholder={settings_dirs_filters_any_provider()}>
									{filters?.provider
										? (() => {
												const opt = getProviderOption(
													filters.provider as string,
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
													filters.provider
												);
											})()
										: null}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{PROVIDER_OPTIONS.filter((o) => o.id !== 'nexata').map(
									(opt) => (
										<SelectItem key={opt.id} value={opt.id}>
											<div className="flex items-center gap-2">
												<img
													src={opt.icon}
													className="w-4 h-4 object-contain shrink-0"
												/>
												<span>{opt.name}</span>
											</div>
										</SelectItem>
									),
								)}
							</SelectContent>
						</Select>
					</div>

					<div className="flex items-center gap-2 shrink-0">
						{hasSelection && (
							<span className="text-xs text-muted-foreground">
								{settings_dirs_selection_count({
									count: String(selected.size),
								})}
							</span>
						)}
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
							<Trash2 className="w-3.5 h-3.5" />{' '}
							{settings_dirs_actions_delete()}
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
										checked={dirs.length > 0 && selected.size === dirs.length}
										onCheckedChange={toggleSelectAll}
									/>
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									{settings_dirs_table_name()}
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									{settings_dirs_table_provider()}
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									{settings_dirs_table_credential()}
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider">
									{settings_dirs_table_modified()}
								</TableHead>
								<TableHead className="font-semibold text-xs uppercase tracking-wider text-center">
									{settings_dirs_table_auto_sync()}
								</TableHead>
								<TableHead className="text-right font-semibold text-xs uppercase tracking-wider">
									{settings_dirs_table_actions()}
								</TableHead>
							</TableRow>
						</TableHeader>

						<TableBody>
							{isLoading && <DirSkeletonRows />}

							{empty && (
								<TableRow>
									<TableCell colSpan={7}>
										<div className="flex flex-col items-center py-14 text-center gap-2">
											<div className="rounded-full bg-muted p-3">
												<FolderSync className="w-5 h-5 text-muted-foreground" />
											</div>
											<p className="text-sm font-medium">
												{settings_dirs_empty_title()}
											</p>
											<p className="text-xs text-muted-foreground max-w-xs">
												{settings_dirs_empty_description()}
											</p>
										</div>
									</TableCell>
								</TableRow>
							)}

							{!isLoading &&
								!empty &&
								dirs.map((dir) => (
									<TableRow
										key={dir.id}
										className={`transition-colors ${selected.has(dir.id) ? 'bg-primary/5' : ''}`}
									>
										<TableCell>
											<Checkbox
												checked={selected.has(dir.id)}
												onCheckedChange={() => toggleSelect(dir.id)}
											/>
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2 min-w-0">
												<div className="rounded-md bg-muted p-1.5 shrink-0">
													<FolderSync className="w-3.5 h-3.5 text-muted-foreground" />
												</div>
												{dir.url ? (
													<a
														href={dir.url}
														target="_blank"
														rel="noopener noreferrer"
														className="text-sm font-medium truncate max-w-[220px] hover:underline"
													>
														{dir.name}
														<ExternalLink className="w-3 h-3 inline-block ml-1 align-baseline text-muted-foreground" />
													</a>
												) : (
													<span className="text-sm font-medium truncate max-w-[220px]">
														{dir.name}
													</span>
												)}
											</div>
										</TableCell>
										<TableCell>
											<ProviderBadge provider={dir.provider} />
										</TableCell>
										<TableCell>
											<span className="text-sm text-muted-foreground truncate">
												{dir.credentialEmail ?? '—'}
											</span>
										</TableCell>
										<TableCell>
											<span className="text-sm whitespace-nowrap">
												{format(new Date(dir.modifiedAt), 'MMM d, yyyy HH:mm')}
											</span>
										</TableCell>
										<TableCell className="text-center">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<div className="inline-flex">
															<Switch
																checked={dir.autoSync}
																onCheckedChange={(v) =>
																	handleDirAutoSyncToggle(dir.id, v)
																}
																className="cursor-pointer"
															/>
														</div>
													</TooltipTrigger>
													<TooltipContent>
														{dir.autoSync
															? settings_dirs_tooltip_autosync_on()
															: settings_dirs_tooltip_autosync_off()}
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</TableCell>
										<TableCell>
											<div className="flex justify-end gap-1">
												<TooltipProvider>
													<Tooltip>
														<TooltipTrigger asChild>
															<Button
																size="icon"
																variant="ghost"
																className="h-8 w-8 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
																onClick={() => handleSingleDirRefresh(dir.id)}
															>
																<RefreshCcw className="w-3.5 h-3.5" />
															</Button>
														</TooltipTrigger>
														<TooltipContent>
															{settings_files_actions_refresh()}
														</TooltipContent>
													</Tooltip>
													{dir.url && (
														<Tooltip>
															<TooltipTrigger asChild>
																<a
																	href={dir.url}
																	target="_blank"
																	rel="noopener noreferrer"
																>
																	<Button
																		size="icon"
																		variant="ghost"
																		className="h-8 w-8 cursor-pointer"
																	>
																		<ExternalLink className="w-3.5 h-3.5" />
																	</Button>
																</a>
															</TooltipTrigger>
															<TooltipContent>
																{settings_dirs_tooltip_open_url()}
															</TooltipContent>
														</Tooltip>
													)}
													<Tooltip>
														<TooltipTrigger asChild>
															<Button
																size="icon"
																variant="ghost"
																className="h-8 w-8 cursor-pointer text-destructive hover:text-destructive hover:bg-destructive/10"
																onClick={() =>
																	setDeleteDialog({
																		open: true,
																		mode: 'single',
																		dirId: dir.id,
																		dirName: dir.name,
																	})
																}
															>
																<Trash2 className="w-3.5 h-3.5" />
															</Button>
														</TooltipTrigger>
														<TooltipContent>
															{settings_dirs_tooltip_delete()}
														</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											</div>
										</TableCell>
									</TableRow>
								))}
						</TableBody>

						<TableFooter className="bg-muted/30">
							<TableRow>
								<TableCell colSpan={4}>
									<span className="text-xs text-muted-foreground">
										{dirs.length > 0
											? settings_dirs_pagination_page_count({
													count: String(dirs.length),
												})
											: settings_dirs_pagination_no_results()}
									</span>
								</TableCell>
								<TableCell colSpan={3}>
									<div className="flex items-center justify-end gap-2">
										<span className="text-xs text-muted-foreground">
											{settings_dirs_pagination_page({
												page: String(currentPage),
											})}
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
											disabled={dirs.length === 0}
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

			{/* Delete dialog */}
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
							{common_cancel()}
						</Button>

						<Button
							variant="destructive"
							className="cursor-pointer"
							onClick={handleConfirmDeleteDir}
						>
							{common_delete()}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	);
}
