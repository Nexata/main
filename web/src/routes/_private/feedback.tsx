'use client';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Bug,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
  TriangleAlert,
  X,
  FileText,
  Pencil
} from 'lucide-react';
import {
  useListFeedback,
  useCreateFeedback,
  useDeleteFeedback,
  type FeedbackList,
  type FeedbackType,
  type FeedbackStatus,
  FEEDBACK_STATUS_OPTIONS,
  useUpdateFeedback,
} from '@/lib/feedback';
import { infoToast } from '@/components/info-toast/info-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { FilePreview } from '@/components/ui/file-preview';
import UserSection from '@/components/user-section/user-section';
import type { Language, Me } from '@/lib/user';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  'feedback.title' as feedback_title,
  'feedback.subtitle' as feedback_subtitle,
  'feedback.back_to_chat' as feedback_back_to_chat,
  'feedback.filters.type' as feedback_filters_type,
  'feedback.filters.status' as feedback_filters_status,
  'feedback.filters.all' as feedback_filters_all,
  'feedback.filters.clear' as feedback_filters_clear,
  'feedback.create' as feedback_create,
  'feedback.empty' as feedback_empty,
  'feedback.pagination.previous' as feedback_pagination_previous,
  'feedback.pagination.next' as feedback_pagination_next,
  'feedback.pagination.page_of' as feedback_pagination_page_of,
  'feedback.modal.view_title' as feedback_modal_view_title,
  'feedback.modal.create_title' as feedback_modal_create_title,
  'feedback.modal.view_description' as feedback_modal_view_description,
  'feedback.modal.create_description' as feedback_modal_create_description,
  'feedback.modal.comment_label' as feedback_modal_comment_label,
  'feedback.modal.comment_placeholder' as feedback_modal_comment_placeholder,
  'feedback.modal.no_content' as feedback_modal_no_content,
  'feedback.modal.no_files' as feedback_modal_no_files,
  'feedback.modal.saved_files' as feedback_modal_saved_files,
  'feedback.modal.remove_file' as feedback_modal_remove_file,
  'feedback.modal.select_category' as feedback_modal_select_category,
  'feedback.modal.type_required' as feedback_modal_type_required,
  'feedback.modal.team_response' as feedback_modal_team_response,
  'feedback.modal.no_response' as feedback_modal_no_response,
  'feedback.modal.send' as feedback_modal_send,
  'feedback.modal.update' as feedback_modal_update,
  'feedback.modal.loading_create_title' as feedback_modal_loading_create_title,
  'feedback.modal.loading_create_desc' as feedback_modal_loading_create_desc,
  'feedback.modal.loading_update_title' as feedback_modal_loading_update_title,
  'feedback.modal.loading_update_desc' as feedback_modal_loading_update_desc,
  'feedback.modal.success_create_title' as feedback_modal_success_create_title,
  'feedback.modal.success_create_desc' as feedback_modal_success_create_desc,
  'feedback.modal.success_update_title' as feedback_modal_success_update_title,
  'feedback.modal.success_update_desc' as feedback_modal_success_update_desc,
  'feedback.modal.error_title' as feedback_modal_error_title,
  'feedback.modal.error_desc' as feedback_modal_error_desc,
  'feedback.delete.title' as feedback_delete_title,
  'feedback.delete.description' as feedback_delete_description,
  'feedback.delete.loading_title' as feedback_delete_loading_title,
  'feedback.delete.loading_desc' as feedback_delete_loading_desc,
  'feedback.delete.success_title' as feedback_delete_success_title,
  'feedback.delete.success_desc' as feedback_delete_success_desc,
  'feedback.delete.error_title' as feedback_delete_error_title,
  'feedback.delete.error_desc' as feedback_delete_error_desc,
  'feedback.actions.view' as feedback_actions_view,
  'feedback.actions.edit' as feedback_actions_edit,
  'feedback.actions.delete' as feedback_actions_delete,
  'common.cancel' as common_cancel,
  'common.delete' as common_delete,
  'feedback.types.bug_report' as feedback_type_bug_report,
  'feedback.types.feature_request' as feedback_type_feature_request,
  'feedback.types.question' as feedback_type_question,
  'feedback.types.other' as feedback_type_other,
  'feedback.statuses.pending' as feedback_status_pending,
  'feedback.statuses.in_review' as feedback_status_in_review,
  'feedback.statuses.wontfix' as feedback_status_wontfix,
  'feedback.statuses.solved' as feedback_status_solved,
} from '@/paraglide/messages.js';

export const Route = createFileRoute('/_private/feedback')({
  component: FeedbackPage,
});

const ITEMS_PER_PAGE = 5;

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug_report: feedback_type_bug_report(),
  feature_request: feedback_type_feature_request(),
  question: feedback_type_question(),
  other: feedback_type_other(),
};

const TYPE_COLORS: Record<FeedbackType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  bug_report: 'destructive',
  feature_request: 'secondary',
  question: 'default',
  other: 'outline',
};

const TYPE_ICONS: Record<FeedbackType, any> = {
  bug_report: Bug,
  feature_request: Lightbulb,
  question: HelpCircle,
  other: Circle,
};

const STATUS_ICONS: Record<FeedbackStatus, any> = {
  pending: Clock,
  in_review: Eye,
  wontfix: X,
  solved: CheckCircle2,
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  pending: feedback_status_pending(),
  in_review: feedback_status_in_review(),
  wontfix: feedback_status_wontfix(),
  solved: feedback_status_solved(),
};

type FeedbackItem = FeedbackList[number];

export default function FeedbackPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<FeedbackItem | null>(null);
  const [editing, setEditing] = useState<FeedbackItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const { data, isLoading } = useListFeedback({
    type: filterType === 'all' ? undefined : (filterType as FeedbackType),
    status: filterStatus === 'all' ? undefined : (filterStatus as FeedbackStatus),
  });

  useEffect(() => setPage(0), [filterType, filterStatus]);

  const paginated = useMemo(() => {
    if (!data) return { items: [], totalPages: 0 };

    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    const start = page * ITEMS_PER_PAGE;

    return { items: data.slice(start, start + ITEMS_PER_PAGE), totalPages };
  }, [data, page]);

  return (
    <>
      <div className="flex flex-col gap-6 px-3 py-4 max-w-screen-2xl mx-auto">

        {/* HEADER */}
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-semibold">{feedback_title()}</h1>
            <p className="text-sm text-muted-foreground">{feedback_subtitle()}</p>
          </div>

          <div className="flex gap-2">
            <Button
            variant="outline"
            onClick={() => navigate({ to: '/chat' })}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {feedback_back_to_chat()}
            </Button>
          </div>
        </header>

        <Separator />

        {/* LIST CONTAINER */}
        <Card className="bg-sidebar">
          <CardContent className="p-6">
            {/* FILTERS */}
            <div className="flex flex-wrap items-end gap-4 border-b pb-4">
              {/* TYPE FILTER */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">{feedback_filters_type()}</span>

                <Select value={filterType} onValueChange={(v) => setFilterType(v ?? 'all')}>
                  <SelectTrigger className="w-52">
                    <SelectValue>
                      {filterType !== 'all' ? (
                        <Badge variant={TYPE_COLORS[filterType as FeedbackType]}>
                          {TYPE_LABELS[filterType as FeedbackType]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          {feedback_filters_all()}
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">
                      <span className="text-muted-foreground">
                        {feedback_filters_all()}
                      </span>
                    </SelectItem>

                    {Object.entries(TYPE_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        <Badge variant={TYPE_COLORS[k as FeedbackType]}>
                          {label}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* STATUS FILTER */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">{feedback_filters_status()}</span>

                <Select
                  value={filterStatus}
                  onValueChange={(v) => setFilterStatus(v ?? 'all')}
                >
                  <SelectTrigger className="w-52">
                    <SelectValue>
                      {filterStatus !== 'all' ? (() => {
                        const Icon = STATUS_ICONS[filterStatus as FeedbackStatus];

                        return (
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1"
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {STATUS_LABELS[filterStatus as FeedbackStatus]}
                          </Badge>
                        );
                      })() : (
                        <span className="text-muted-foreground">
                          {feedback_filters_all()}
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">
                      <span className="text-muted-foreground">
                        {feedback_filters_all()}
                      </span>
                    </SelectItem>

                    {FEEDBACK_STATUS_OPTIONS.map((s) => {
                      const Icon = STATUS_ICONS[s];

                      return (
                        <SelectItem key={s} value={s}>
                          <Badge
                            variant="outline"
                            className="flex items-center gap-1"
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {STATUS_LABELS[s]}
                          </Badge>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* CLEAR FILTERS */}
              <AnimatePresence mode="wait">
                {(filterType !== 'all' || filterStatus !== 'all') && (
                  <motion.div
                    key="clear-filters"
                    initial={{ opacity: 0, scale: 0.8, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -4 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="cursor-pointer mb-0.5"
                            onClick={() => {
                              setFilterType('all');
                              setFilterStatus('all');
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {feedback_filters_clear()}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CREATE BUTTON */}
              <div className="ml-auto">
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {feedback_create()}
                </Button>
              </div>
        </div>

            {isLoading && <SkeletonList />}

            {!isLoading && !data?.length && <EmptyState />}

            {!isLoading && paginated.items.length > 0 && (
              <FeedbackList
                items={paginated.items}
                onView={setSelected}
                onDelete={setDeleteId}
                onEdit={setEditing}
              />
            )}

            {/* Pagination */}
            {paginated.totalPages > 1 && (
              <Pagination
                page={page}
                total={paginated.totalPages}
                onChange={setPage}
              />
            )}

          </CardContent>
        </Card>
      </div>

      <FeedbackModal
        mode={editing ? 'edit' : selected ? 'view' : 'create'}
        feedback={editing || selected}
        open={createOpen || !!selected || !!editing}
        onClose={() => {
          setCreateOpen(false);
          setSelected(null);
          setEditing(null);
        }}
      />

      <DeleteModal
        id={deleteId}
        onClose={() => setDeleteId(null)}
      />
    </>
  );
}

/* ================================================= */

function FeedbackList({
  items,
  onView,
  onDelete,
  onEdit
}: {
  items: FeedbackItem[];
  onView: (f: FeedbackItem) => void;
  onDelete: (id: string) => void;
  onEdit: (f: FeedbackItem) => void;
}) {
  return (
    <div className="space-y-2 pt-4">
      <AnimatePresence>
        {items.map((item) => {
          const TypeIcon = TYPE_ICONS[item.type];
          const StatusIcon = STATUS_ICONS[item.status];

          const me: Me = {
            id: item.user.id,
            email: item.user.email,
            displayName: item.user.displayName,
            pfpUrl: item.user.pfpUrl,
            isAdmin: false,
            language: 'es' as Language,
            hasApiKey: false,
            devices: [],
            messageCount: 0,
          };

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-4 border rounded-xl px-5 py-2 hover:bg-muted/40 transition-colors"
            >
              {/* USER SECTION */}
              <UserSection
                me={me}
                collapsed={false}
                disableClick
                disableHoverScale
              />

              {/* CONTENT */}
              <div className="flex-1 min-w-0 space-y-2">

                <div className="flex gap-2 flex-wrap">
                  <Badge
                    variant={TYPE_COLORS[item.type]}
                    className="flex items-center gap-1"
                  >
                    <TypeIcon className="h-3.5 w-3.5" />
                    {TYPE_LABELS[item.type]}
                  </Badge>

                  <Badge
                    variant="outline"
                    className="flex items-center gap-1"
                  >
                    <StatusIcon className="h-3.5 w-3.5" />
                    {STATUS_LABELS[item.status]}
                  </Badge>
                </div>

                {/* COMMENT PREVIEW */}
                <p className="text-sm text-muted-foreground truncate">
                  {item.comment}
                </p>
              </div>

              {/* ACTIONS */}
              <div className="flex gap-2 shrink-0 items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Button
                        size="icon"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => onView(item)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {feedback_actions_view()}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => onEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {feedback_actions_edit()}
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="cursor-pointer"
                        onClick={() => onDelete(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {feedback_actions_delete()}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ================================================= */

function SkeletonList() {
  return (
    <div className="space-y-3 animate-pulse mt-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-muted rounded-lg" />
      ))}
    </div>
  );
}

/* ================================================= */

function EmptyState() {
  return (
    <div className="text-center py-12">
      <MessageSquare className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
      <p className="text-muted-foreground">
        {feedback_empty()}
      </p>
    </div>
  );
}

/* ================================================= */

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex justify-between pt-4">
      <Button
        variant="outline"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        {feedback_pagination_previous()}
      </Button>

      <span className="text-sm">
        {feedback_pagination_page_of({ current: page + 1, total})}
      </span>

      <Button
        variant="outline"
        disabled={page + 1 >= total}
        onClick={() => onChange(page + 1)}
      >
        {feedback_pagination_next()}
      </Button>
    </div>
  );
}

/* ================================================= */

type FeedbackModalProps = {
  mode: 'view' | 'create' | 'edit';
  feedback: FeedbackItem | null;
  open: boolean;
  onClose: () => void;
};

function FeedbackModal({
  mode,
  feedback,
  open,
  onClose,
}: FeedbackModalProps) {
  const createFeedback = useCreateFeedback();
  const updateFeedback = useUpdateFeedback();
  const readonly = mode === 'view';
  const editing = mode === 'edit';

  const [removeUrls, setRemoveUrls] = useState<string[]>([]);
  const [type, setType] = useState<FeedbackType | ''>(feedback?.type ?? '');
  const [comment, setComment] = useState(feedback?.comment ?? '');
  const [files, setFiles] = useState<File[]>([]);
  const [typeError, setTypeError] = useState(false);

  useEffect(() => {
    if (!open) {
      setComment('');
      setType('');
      setFiles([]);
      setRemoveUrls([]);
      setTypeError(false);
      return;
    }

    if (feedback) {
      setComment(feedback.comment);
      setType(feedback.type);
    }
  }, [feedback, open]);

  const formatDate = (d?: Date | string | null) => {
    if (!d) return '';
    const date = new Date(d);
    return new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const removeFile = (file: File) => {
    setFiles((prev) => prev.filter((f) => f !== file));
  };

  const submit = async () => {
    if (!type) {
      setTypeError(true);
      return;
    }

    if (!comment.trim()) return;

    onClose();

    const toast = infoToast.loading({
      title: editing
        ? feedback_modal_loading_update_title()
        : feedback_modal_loading_create_title(),
      description: editing
        ? feedback_modal_loading_update_desc()
        : feedback_modal_loading_create_desc(),
    });

    try {
      if (editing && feedback) {
        await updateFeedback(feedback.id, {
          type,
          comment,
          files,
          removeFileUrls: removeUrls,
        });

        infoToast.success(toast, {
          title: feedback_modal_success_update_title(),
          description: feedback_modal_success_update_desc(),
        });
      } else {
        await createFeedback({
          type,
          comment,
          files,
        });

        infoToast.success(toast, {
          title: feedback_modal_success_create_title(),
          description: feedback_modal_success_create_desc(),
        });
      }

      setFiles([]);
      setComment('');
      setType('');
      setRemoveUrls([]);
    } catch {
      infoToast.error(toast, {
        title: feedback_modal_error_title(),
        description: feedback_modal_error_desc(),
      });
    }
  };

  const visibleFiles = files.slice(0, 2);
  const extraCount = files.length - 2;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="
          w-[92vw] sm:w-[75vw] lg:w-[55vw]
          min-w-[92vw] sm:min-w-[75vw] lg:min-w-[55vw]
          max-h-[85vh]
          flex flex-col
        "
      >
        {/* HEADER + BODY */}
        <div className="px-6 pt-6 pb-4 flex flex-col gap-6 overflow-y-auto">

          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-semibold">
              {readonly ? feedback_modal_view_title() : editing ? feedback_modal_create_title() : feedback_modal_create_title()}
            </DialogTitle>

            <p className="text-sm text-muted-foreground">
              {readonly ? feedback_modal_view_description() : feedback_modal_create_description()}
            </p>
          </DialogHeader>

          <Separator />

          {/* COMMENT */}
          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium">
              {feedback_modal_comment_label()}
            </label>

            {readonly ? (
              <div
                className="
                  border rounded-md
                  px-4 py-3
                  bg-muted/30
                  text-sm
                  whitespace-pre-wrap
                  leading-relaxed
                "
              >
                {comment?.trim() || feedback_modal_no_content()}
              </div>
            ) : (
              <Textarea
                placeholder={feedback_modal_comment_placeholder()}
                className="min-h-36 resize-y"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            )}
          </div>

          {/* FILES + DATE — VIEW MODE */}
          {readonly && feedback && (
            <div className="flex items-center justify-between gap-6">

              {/* FILES */}
              <div className="flex flex-wrap items-center gap-2">

                {feedback.fileUrls?.length ? (
                  feedback.fileUrls.map((url, i) => {
                    const fileName =
                      decodeURIComponent(
                        new URL(url).pathname.split('/').pop() ||
                        `archivo-${i + 1}`
                      );

                    return (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="
                          inline-flex items-center gap-1.5
                          text-md
                          font-medium
                          hover:underline
                          transition-colors
                        "
                        title={fileName}
                      >
                        <FileText className="w-4 h-4" />
                        <span className="truncate max-w-40">
                          {fileName}
                        </span>
                      </a>
                    );
                  })
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {feedback_modal_no_files()}
                  </span>
                )}

              </div>

              {/* DATE */}
              <div className="text-xs text-muted-foreground shrink-0">
                {formatDate(feedback.createdAt)}
              </div>

            </div>
          )}

          {/* TYPE + FILES + SAVED URLS */}
          {!readonly && (
            <div className="flex flex-col gap-1">

              {/* TYPE */}
              <label className="text-sm font-medium">
                Tipo <span className="text-destructive">*</span>
              </label>

              <div className="flex items-center gap-3">

                <Select<string>
                  value={type}
                  onValueChange={(v) => {
                    setType(v as FeedbackType);
                    setTypeError(false);
                  }}
                >
                  <SelectTrigger
                    className={`w-56 ${
                      typeError
                        ? 'border-destructive focus:ring-destructive'
                        : ''
                    }`}
                  >
                    <SelectValue>
                      {type ? (
                        <Badge variant={TYPE_COLORS[type]}>
                          {TYPE_LABELS[type]}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          {feedback_modal_select_category()}
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>

                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        <Badge variant={TYPE_COLORS[k as FeedbackType]}>
                          {label}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* ADJUNTAR */}
                <Button
                  variant="secondary"
                  className="cursor-pointer shrink-0"
                  onClick={() =>
                    document.getElementById('file-input')?.click()
                  }
                >
                  <Paperclip className="mr-2 h-4 w-4" />
                  Adjuntar
                </Button>

                <input
                  id="file-input"
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => addFiles(e.target.files)}
                />

                {/* PREVIEWS */}
                <div className="flex items-center gap-2 ml-2 min-h-12">
                  <AnimatePresence mode="popLayout">
                    {visibleFiles.map((file) => (
                      <motion.div
                        key={`${file.name}-${file.lastModified}`}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{
                          opacity: 0,
                          scale: 0.85,
                          transition: { duration: 0.18 },
                        }}
                      >
                        <FilePreview
                          file={file}
                          onRemove={() => removeFile(file)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {extraCount > 0 && (
                    <div className="text-xs bg-muted px-2 py-1 rounded-md">
                      +{extraCount}
                    </div>
                  )}
                </div>
              </div>

              {/* ERROR */}
              {typeError && (
                <span className="text-xs text-destructive">
                  {feedback_modal_type_required()}
                </span>
              )}

              {/* SAVED FILES — AHORA PEGADO */}
              {editing && feedback?.fileUrls?.length! > 0 && (
                <div className="flex flex-col gap-2 mt-1">

                  <label className="text-sm font-medium text-muted-foreground">
                    {feedback_modal_saved_files()}
                  </label>

                  <div className="flex flex-wrap items-center gap-3">

                    {feedback?.fileUrls!.map((url, i) => {
                      if (removeUrls.includes(url)) return null;

                      const fileName = decodeURIComponent(
                        new URL(url).pathname.split('/').pop() ||
                          `archivo-${i + 1}`
                      );

                      return (
                        <div
                          key={url}
                          className="
                            inline-flex items-center gap-1.5
                            text-sm font-medium
                            hover:underline
                            cursor-pointer
                            group
                          "
                          title={feedback_modal_remove_file()}
                          onClick={() =>
                            setRemoveUrls((p) => [...p, url])
                          }
                        >
                          <FileText className="w-4 h-4 shrink-0" />

                          <span className="truncate max-w-40">
                            {fileName}
                          </span>

                          <span
                            className="
                              ml-1 text-muted-foreground
                              group-hover:text-destructive
                              transition
                            "
                          >
                            ✕
                          </span>
                        </div>
                      );
                    })}

                  </div>
                </div>
              )}

            </div>
          )}

          {/* RESPONSE */}
          {readonly && feedback && (
            <>
              <Separator />

              <div className="flex flex-col gap-3">

                <label className="text-sm font-medium mb-2">
                  {feedback_modal_team_response()}
                </label>

                {feedback.response ? (
                  <div className="border rounded-lg p-4 bg-muted/40 whitespace-pre-wrap text-sm leading-relaxed">
                    {feedback.response}
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 text-sm text-muted-foreground text-center">
                    {feedback_modal_no_response()}
                  </div>
                )}

              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <DialogFooter className="px-6 py-4 gap-2">
          <Button
            variant="destructive"
            onClick={onClose}
          >
            {common_cancel()}
          </Button>

          {!readonly && (
            <Button variant="outline" onClick={submit}>
              {editing ? feedback_modal_update() : feedback_modal_send()}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================= */

function DeleteModal({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const deleteFeedback = useDeleteFeedback();

  const confirm = async () => {
    if (!id) return;

    // cerrar modal inmediatamente
    onClose();

    const toast = infoToast.loading({
      title: feedback_delete_loading_title(),
      description: feedback_delete_loading_desc(),
    });

    try {
      await deleteFeedback(id);

      infoToast.success(toast, {
        title: feedback_delete_success_title(),
        description: feedback_delete_success_desc(),
      });
    } catch {
      infoToast.error(toast, {
        title: feedback_delete_error_title(),
        description: feedback_delete_error_desc(),
      });
    }
  };

  return (
    <Dialog open={!!id} onOpenChange={onClose}>
      <DialogContent>

        <DialogHeader className="space-y-3">

          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-destructive" />
            {feedback_delete_title()}
          </DialogTitle>

          <p className="text-sm text-muted-foreground">
            {feedback_delete_description()}
          </p>

        </DialogHeader>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            {common_cancel()}
          </Button>

          <Button variant="destructive" onClick={confirm}>
            {common_delete()}
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
