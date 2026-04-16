import { useState, useEffect, useMemo, createContext, useContext } from "react";
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileImage,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

// ─── Types ───────────────────────────────────────────────────────────

type TreeNode = {
  name: string;
  annotation?: string;
  isDirectory: boolean;
  children: TreeNode[];
  depth: number;
};

type DirectoryTreeProps = {
  content: string;
};

// ─── Detection ───────────────────────────────────────────────────────

/**
 * Detects whether a block of text is a directory tree by looking for
 * Unicode box-drawing branch characters (├ and └).
 */
export function isDirectoryTree(text: string): boolean {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return false;

  let branchLineCount = 0;
  let fileSystemLineCount = 0;
  let branchFileSystemLineCount = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();
    const hasBranch = trimmedLine.includes("\u251C") || trimmedLine.includes("\u2514");
    const rawName = hasBranch
      ? trimmedLine.replace(/^[\u2502\s]*[\u251C\u2514][\u2500\s]*/, "").trim()
      : trimmedLine;
    const looksLikeFileSystem =
      /\/$/.test(rawName) ||
      /\/\s+\(.+\)$/.test(rawName) ||
      /\.[a-zA-Z0-9]{1,8}(?:\s|$)/.test(rawName);

    if (hasBranch) {
      branchLineCount++;
    }

    if (looksLikeFileSystem) {
      fileSystemLineCount++;
      if (hasBranch) {
        branchFileSystemLineCount++;
      }
    }
  }

  return branchLineCount >= 2 && fileSystemLineCount >= 2 && branchFileSystemLineCount >= 1;
}

// ─── Parser ──────────────────────────────────────────────────────────

/**
 * Finds the position of the first branch character (├ or └) in a line.
 * Returns -1 if no branch character is found (root line).
 */
function findBranchPosition(line: string): number {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === "\u251C" || line[i] === "\u2514") return i;
  }
  return -1;
}

/**
 * Parses the raw name extracted from a tree line, determining whether
 * it's a directory or file, and extracting any annotation.
 *
 * Rules:
 * - `Name/` → directory "Name"
 * - `Name/ (annotation text)` → directory "Name" with annotation
 * - `Name (something)/` → directory "Name (something)" (parens are part of name)
 * - `file.ext` → file "file.ext"
 */
function parseNameAndAnnotation(rawName: string): {
  name: string;
  isDirectory: boolean;
  annotation: string | undefined;
} {
  // Pattern: "DirName/ (annotation text)"
  // The slash must come before the annotation parentheses
  const annotatedDirMatch = rawName.match(/^(.+\/)\s+\((.+)\)$/);
  if (annotatedDirMatch && annotatedDirMatch[1] && annotatedDirMatch[2]) {
    return {
      name: annotatedDirMatch[1].slice(0, -1),
      isDirectory: true,
      annotation: annotatedDirMatch[2],
    };
  }

  // Plain directory: ends with /
  if (rawName.endsWith("/")) {
    return { name: rawName.slice(0, -1), isDirectory: true, annotation: undefined };
  }

  // File (no trailing slash)
  return { name: rawName, isDirectory: false, annotation: undefined };
}

/**
 * Parses a directory-tree text block into a nested TreeNode structure.
 *
 * Uses character positions to determine depth: each indentation level
 * in standard `tree` output is 4 characters wide (`│   ` or `    `).
 * Root lines (no branch chars) are depth 0, and lines with branches
 * get depth = (prefix_length / 4) + 1.
 */
function parseDirectoryTree(text: string): TreeNode[] {
  const lines = text.split("\n");
  const roots: TreeNode[] = [];
  const stack: { node: TreeNode; depth: number }[] = [];

  for (const rawLine of lines) {
    if (rawLine.trim().length === 0) continue;

    const branchPos = findBranchPosition(rawLine);
    let depth: number;
    let rawName: string;

    if (branchPos === -1) {
      // Root line (no branch characters)
      rawName = rawLine.trim();
      depth = 0;

      // Skip purely decorative lines (only box-drawing chars and spaces)
      if (/^[\u2500\u2502\u251C\u2514\u253C\u2524\u2510\u2518\u250C\u252C\s]+$/.test(rawName)) {
        continue;
      }
    } else {
      // Calculate depth from the prefix width before the branch char
      const prefix = rawLine.substring(0, branchPos);
      depth = Math.round(prefix.length / 4) + 1;

      // Skip past ── and spaces after the branch character to reach the name
      let nameStart = branchPos + 1;
      while (
        nameStart < rawLine.length &&
        (rawLine[nameStart] === "\u2500" || rawLine[nameStart] === " ")
      ) {
        nameStart++;
      }
      rawName = rawLine.substring(nameStart).trim();
    }

    if (!rawName) continue;

    const { name, isDirectory, annotation } = parseNameAndAnnotation(rawName);

    const node: TreeNode = {
      name,
      annotation,
      isDirectory,
      children: [],
      depth,
    };

    // Pop stack until we find the parent (a node with strictly lesser depth)
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      const parent = stack[stack.length - 1]!.node;
      parent.children.push(node);
      parent.isDirectory = true;
    }

    stack.push({ node, depth });
  }

  return roots;
}

// ─── Expand/Collapse Context ─────────────────────────────────────────

type TreeControlContextValue = {
  /** Incremented to signal "expand all" */
  expandSignal: number;
  /** Incremented to signal "collapse all" */
  collapseSignal: number;
};

const TreeControlContext = createContext<TreeControlContextValue>({
  expandSignal: 0,
  collapseSignal: 0,
});

// ─── File type icons ─────────────────────────────────────────────────

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return <FileText className="size-3.5 sm:size-4 text-red-500/80 dark:text-red-400/80 shrink-0" />;
    case "doc":
    case "docx":
      return <FileText className="size-3.5 sm:size-4 text-blue-500/80 dark:text-blue-400/80 shrink-0" />;
    case "xls":
    case "xlsx":
      return <FileSpreadsheet className="size-3.5 sm:size-4 text-emerald-500/80 dark:text-emerald-400/80 shrink-0" />;
    case "ppt":
    case "pptx":
      return <Presentation className="size-3.5 sm:size-4 text-orange-500/80 dark:text-orange-400/80 shrink-0" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return <FileImage className="size-3.5 sm:size-4 text-violet-500/80 dark:text-violet-400/80 shrink-0" />;
    default:
      return <File className="size-3.5 sm:size-4 text-muted-foreground/60 shrink-0" />;
  }
}

// ─── Tree Node Component ─────────────────────────────────────────────

function TreeNodeItem({ node, depth }: { node: TreeNode; depth: number }) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const { expandSignal, collapseSignal } = useContext(TreeControlContext);

  // React to expand/collapse all signals
  useEffect(() => {
    if (expandSignal > 0 && node.isDirectory) setIsOpen(true);
  }, [expandSignal, node.isDirectory]);

  useEffect(() => {
    if (collapseSignal > 0 && node.isDirectory) setIsOpen(false);
  }, [collapseSignal, node.isDirectory]);

  const hasChildren = node.children.length > 0;

  if (!node.isDirectory) {
    // File node — non-interactive row
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 py-1 sm:py-[3px] rounded-md transition-colors duration-100",
          "hover:bg-muted/30",
          depth > 0 && "ml-3 sm:ml-4",
        )}
      >
        {/* Indent spacer */}
        {depth > 0 && (
          <span
            className="shrink-0"
            style={{ width: `${(depth - 1) * 16}px` }}
          />
        )}

        {/* Spacer where chevron would be */}
        <span className="shrink-0 w-3.5" />

        {/* Icon */}
        {getFileIcon(node.name)}

        {/* Name */}
        <span className="text-xs sm:text-sm text-foreground/75 truncate min-w-0">
          {node.name}
        </span>
      </div>
    );
  }

  // Directory node — collapsible
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          depth > 0 && "ml-3 sm:ml-4",
          depth > 0 && "border-l border-border/40",
        )}
      >
        <CollapsibleTrigger
          className={cn(
            "flex items-center gap-1.5 w-full py-1 sm:py-[3px] px-1.5 sm:px-2 rounded-md transition-colors duration-100 select-none",
            "cursor-pointer hover:bg-muted/60",
            "group/node",
          )}
        >
          {/* Indent spacer */}
          {depth > 0 && (
            <span
              className="shrink-0"
              style={{ width: `${(depth - 1) * 16}px` }}
            />
          )}

          {/* Chevron */}
          <ChevronRight
            className={cn(
              "size-3 sm:size-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200",
              isOpen && "rotate-90",
            )}
          />

          {/* Folder icon */}
          {isOpen ? (
            <FolderOpen className="size-3.5 sm:size-4 text-amber-500/80 dark:text-amber-400/80 shrink-0" />
          ) : (
            <Folder className="size-3.5 sm:size-4 text-amber-500/80 dark:text-amber-400/80 shrink-0" />
          )}

          {/* Name */}
          <span className="text-xs sm:text-sm font-medium text-foreground/90 truncate min-w-0 text-left">
            {node.name}/
          </span>

          {/* Annotation */}
          {node.annotation && (
            <span className="hidden sm:inline text-xs text-muted-foreground/50 truncate ml-0.5 font-normal">
              ({node.annotation})
            </span>
          )}

          {/* Child count badge when collapsed */}
          {!isOpen && hasChildren && (
            <span className="ml-auto text-[10px] font-mono text-muted-foreground/40 bg-muted/50 px-1.5 py-0.5 rounded shrink-0">
              {node.children.length}
            </span>
          )}
        </CollapsibleTrigger>

        {/* Mobile-only annotation tooltip (visible on small screens where inline annotation is hidden) */}
        {node.annotation && (
          <span className="sm:hidden text-[10px] text-muted-foreground/40 pl-8 -mt-0.5 mb-0.5 block truncate">
            ({node.annotation})
          </span>
        )}

        {/* Children */}
        <CollapsibleContent>
          {hasChildren && (
            <div className="pl-1">
              {node.children.map((child, i) => (
                <TreeNodeItem
                  key={`${child.name}-${i}`}
                  node={child}
                  depth={depth + 1}
                />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Utilities ───────────────────────────────────────────────────────

function countItems(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (node.children.length > 0) {
      count += countItems(node.children);
    }
  }
  return count;
}

function countDirectories(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.isDirectory) count++;
    if (node.children.length > 0) {
      count += countDirectories(node.children);
    }
  }
  return count;
}

function countFiles(nodes: TreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (!node.isDirectory) count++;
    if (node.children.length > 0) {
      count += countFiles(node.children);
    }
  }
  return count;
}

// ─── Main Component ──────────────────────────────────────────────────

export function DirectoryTree({ content }: DirectoryTreeProps) {
  const tree = useMemo(() => parseDirectoryTree(content), [content]);
  const [expandSignal, setExpandSignal] = useState(0);
  const [collapseSignal, setCollapseSignal] = useState(0);

  if (tree.length === 0) return null;

  const firstNode = tree[0]!;
  const isSingleRoot = tree.length === 1 && firstNode.isDirectory;
  const rootName = isSingleRoot ? firstNode.name : undefined;
  const displayNodes = isSingleRoot ? firstNode.children : tree;
  const rootNode = isSingleRoot ? firstNode : undefined;

  const totalItems = countItems(tree);
  const dirCount = countDirectories(displayNodes);
  const fileCount = countFiles(displayNodes);

  const hasFolders = dirCount > 0;

  return (
    <TreeControlContext.Provider value={{ expandSignal, collapseSignal }}>
      <div className="my-4 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        {/* Header */}
        <div className="flex h-11 items-center justify-between border-b border-border/40 bg-muted/30 px-3 sm:px-4 gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <FolderOpen className="size-4 text-amber-500/80 dark:text-amber-400/80 shrink-0" />
            <span className="text-sm font-medium text-foreground/80 truncate">
              {rootName ?? "Directory"}
            </span>
            {rootNode?.annotation && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="hidden sm:inline text-xs text-muted-foreground/50 truncate" />
                  }
                >
                  ({rootNode.annotation})
                </TooltipTrigger>
                <TooltipContent>{rootNode.annotation}</TooltipContent>
              </Tooltip>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Summary */}
            <span className="hidden sm:block text-[10px] font-mono text-muted-foreground/35 select-none">
              {dirCount > 0 && `${dirCount} dir${dirCount !== 1 ? "s" : ""}`}
              {dirCount > 0 && fileCount > 0 && ", "}
              {fileCount > 0 && `${fileCount} file${fileCount !== 1 ? "s" : ""}`}
              {dirCount === 0 && fileCount === 0 && `${totalItems} items`}
            </span>

            {/* Mobile summary */}
            <span className="sm:hidden text-[10px] font-mono text-muted-foreground/35 select-none">
              {totalItems}
            </span>

            {/* Expand/Collapse toggle */}
            {hasFolders && (
              <>
                <div className="h-3 w-px bg-border/40" />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          // Toggle: if we last expanded, now collapse, and vice versa
                          if (expandSignal > collapseSignal) {
                            setCollapseSignal((s) => s + 1);
                          } else {
                            setExpandSignal((s) => s + 1);
                          }
                        }}
                      />
                    }
                  >
                    <ChevronsUpDown className="size-3 text-muted-foreground/50" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {expandSignal > collapseSignal ? "Collapse all" : "Expand all"}
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        {/* Tree content */}
        <ScrollArea className="max-h-[420px]">
          <div className="py-2 px-1 sm:px-1.5">
            {displayNodes.map((node, i) => (
              <TreeNodeItem
                key={`${node.name}-${i}`}
                node={node}
                depth={0}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </TreeControlContext.Provider>
  );
}
