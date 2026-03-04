import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  Settings as SettingsIcon,
  RefreshCcw,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { format } from "date-fns";
import { useEffect, useState } from 'react';
import { ConfirmDeleteCredentialModal } from '@/components/credentials/credential-delete-modal';
import { infoToast } from '@/components/info-toast/info-toast';
import { SourceRow } from '@/components/sources/source-row';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import { useMe } from '@/lib/user';
import { useDeleteFiles, useIngestFiles, useSearchFiles } from "@/lib/file";
import type { SearchFilesParams, SearchFilesResult } from "@/lib/file";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-semibold tracking-tight">
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
							onClick={() => navigate({ to: '/chat' })}
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

// ---------------------------------------------
// Helpers
// ---------------------------------------------

function UserMini({ user }: { user: SearchFilesResult[number]["ownedBy"] }) {
  if (!user) return <span className="opacity-50 text-xs">system</span>;

  return (
    <div className="flex items-center gap-2 min-w-0">
      {user.pfpUrl ? (
        <img
          src={user.pfpUrl}
          className="w-7 h-7 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-7 h-7 rounded-full flex items-center justify-center bg-muted text-white shrink-0">
          {user.displayName?.[0]?.toUpperCase() ?? "?"}
        </div>
      )}

      <div className="min-w-0">
        <div className="text-sm font-medium truncate">
          {user.displayName}
        </div>
        <div className="text-xs opacity-60 truncate">{user.email}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------
// Section
// ---------------------------------------------

export function FilesManagementSection() {
  const [filters, setFilters] = useState<SearchFilesParams>({ page: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { data: files = [], isLoading, refetch } = useSearchFiles(filters);

  const ingestMutation = useIngestFiles();
  const deleteMutation = useDeleteFiles();

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === files.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map((f) => f.id)));
    }
  };

  const nextPage = () =>
    setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }));

  const prevPage = () =>
    setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }));

  const handleMassDelete = async () => {
    await deleteMutation.mutateAsync({ ids: [...selected] });
    setSelected(new Set());
    setConfirmDeleteOpen(false);
    refetch();
  };

  const handleMassRefresh = async () => {
    await ingestMutation.mutateAsync({ files: "mass", metadata: null });
    refetch();
  };

  const SkeletonRows = () =>
    Array.from({ length: 6 }).map((_, i) => (
      <TableRow key={i} className="h-12">
        {Array.from({ length: 7 }).map((__, j) => (
          <TableCell key={j}>
            <div className="h-3 w-full rounded bg-muted animate-pulse" />
          </TableCell>
        ))}
      </TableRow>
    ));

  const empty = !isLoading && files.length === 0;

  return (
    <Card className="bg-sidebar">
      <CardContent className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">File Management</h2>
          <p className="text-sm text-muted-foreground">
            Search, update, and manage ingested files.
          </p>
        </div>

        <Separator />

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 opacity-60" />
            <Input
              placeholder="Search files…"
              className="pl-8"
              onChange={(e) =>
                setFilters((f) => ({ ...f, query: e.target.value, page: 1 }))
              }
            />
          </div>

          {selected.size > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleMassRefresh}
                className="gap-2"
              >
                <RefreshCcw className="w-4 h-4" /> Refresh
              </Button>

              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmDeleteOpen(true)}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            </>
          )}
        </div>

        {/* Table */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>
                  <Checkbox
                    checked={
                      files.length > 0 && selected.size === files.length
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Ingested</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading && <SkeletonRows />}

              {empty && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="flex flex-col items-center py-10 text-center">
                      <FileText className="w-6 h-6 opacity-40 mb-2" />
                      <div className="text-sm font-medium">
                        No files found
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Try adjusting your filters.
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!isLoading &&
                !empty &&
                files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(file.id)}
                        onCheckedChange={() => toggleSelect(file.id)}
                      />
                    </TableCell>

                    <TableCell className="font-medium">
                      {file.name}
                    </TableCell>

                    <TableCell>
                      <UserMini user={file.ownedBy} />
                    </TableCell>

                    <TableCell>{file.provider}</TableCell>

                    <TableCell>{file.type ?? "—"}</TableCell>

                    <TableCell>
                      {format(new Date(file.ingestedAt), "PPP")}
                    </TableCell>

                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleMassRefresh()}
                              >
                                <RefreshCcw className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Refresh</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setSelected(new Set([file.id]));
                                  setConfirmDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>

            <TableFooter className="bg-muted/50">
              <TableRow>
                <TableCell colSpan={5}>
                  Page {filters.page ?? 1}
                </TableCell>
                <TableCell colSpan={2}>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={prevPage}
                      disabled={(filters.page ?? 1) === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={nextPage}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>

        {/* Help text */}
        <p className="text-xs text-muted-foreground">
          Use filters to locate files quickly. Select multiple rows to perform
          batch operations like refresh or deletion.
        </p>
      </CardContent>

      {/* Confirm delete */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete files?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Selected files will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMassDelete} variant={'destructive'}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
