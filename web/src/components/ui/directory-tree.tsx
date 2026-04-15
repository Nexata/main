import { useState, useCallback, useMemo } from "react";
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  FileSpreadsheet,
  Presentation,
  FileImage,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

const TREE_CHARS = /[├└│─┼┤┐┘┌┬]/;

export function isDirectoryTree(text: string): boolean {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return false;

  let treeLineCount = 0;
  for (const line of lines) {
    if (TREE_CHARS.test(line)) treeLineCount++;
  }

  return treeLineCount >= 2 && treeLineCount / lines.length > 0.3;
}

// ─── Parser ──────────────────────────────────────────────────────────

function parseDirectoryTree(text: string): TreeNode[] {
  const lines = text.split("\n");
  const roots: TreeNode[] = [];
  const stack: { node: TreeNode; indent: number }[] = [];

  for (const rawLine of lines) {
    if (rawLine.trim().length === 0) continue;

    // Measure the visual indent: count leading chars that are tree-drawing or spaces
    const treePrefix = rawLine.match(/^([\s│├└─┼┤┐┘┌┬]*)/)?.[0] ?? "";
    // The indent level is roughly the number of "│" or tree branch chars
    // Each level typically has "│   " (4 chars) or "├── " / "└── " patterns
    const indentLevel = computeIndentLevel(treePrefix);

    // Extract the actual name from the line
    const nameMatch = rawLine.match(/[├└│─┼┤]\s*(.+)$/);
    let name: string;

    if (nameMatch && nameMatch[1]) {
      name = nameMatch[1].trim();
    } else {
      // Root line (no tree chars at the start of meaningful content)
      name = rawLine.trim();
      // Skip lines that are purely decorative
      if (/^[─│├└┼┤\s]+$/.test(name)) continue;
    }

    // Remove trailing "/" for directory detection, but note it
    const isDirectory = name.endsWith("/");
    if (isDirectory) {
      name = name.slice(0, -1);
    }

    // Extract annotation in parentheses
    let annotation: string | undefined;
    const annotationMatch = name.match(/^(.+?)\s+\((.+)\)$/);
    if (annotationMatch && annotationMatch[1] && annotationMatch[2]) {
      name = annotationMatch[1];
      annotation = annotationMatch[2];
    }

    // Check if it has children (will be overridden if children appear later)
    const hasTreeCharsOnly = /^[─│├└┼┤\s]+$/.test(rawLine.trim());
    if (hasTreeCharsOnly) continue;

    const node: TreeNode = {
      name,
      annotation,
      isDirectory: isDirectory || false,
      children: [],
      depth: indentLevel,
    };

    // Pop from stack until we find the parent
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indentLevel) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      const parent = stack[stack.length - 1]!.node;
      parent.children.push(node);
      // Parent has children, so mark as directory
      parent.isDirectory = true;
    }

    stack.push({ node, indent: indentLevel });
  }

  return roots;
}

function computeIndentLevel(prefix: string): number {
  // Count how many "sections" of tree structure exist
  // Each level typically has patterns like "│   " or "    " (4 chars per level)
  let level = 0;
  let i = 0;
  while (i < prefix.length) {
    const ch = prefix[i];
    if (ch === "├" || ch === "└") {
      // This marks the current item's branch; stop counting
      break;
    } else if (ch === "│") {
      level++;
      // Skip the spaces after │
      i++;
      while (i < prefix.length && prefix[i] === " ") i++;
      continue;
    } else if (ch === " ") {
      // Count groups of spaces (typically 4) as a level
      let spaces = 0;
      while (i < prefix.length && prefix[i] === " ") {
        spaces++;
        i++;
      }
      if (spaces >= 2) level++;
      continue;
    }
    i++;
  }
  return level;
}

// ─── File type icons ─────────────────────────────────────────────────

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return <FileText className="size-4 text-red-500/80 dark:text-red-400/80 shrink-0" />;
    case "doc":
    case "docx":
      return <FileText className="size-4 text-blue-500/80 dark:text-blue-400/80 shrink-0" />;
    case "xls":
    case "xlsx":
      return <FileSpreadsheet className="size-4 text-emerald-500/80 dark:text-emerald-400/80 shrink-0" />;
    case "ppt":
    case "pptx":
      return <Presentation className="size-4 text-orange-500/80 dark:text-orange-400/80 shrink-0" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return <FileImage className="size-4 text-violet-500/80 dark:text-violet-400/80 shrink-0" />;
    default:
      return <File className="size-4 text-muted-foreground/60 shrink-0" />;
  }
}

// ─── Tree Node Component ─────────────────────────────────────────────

function TreeNodeItem({
  node,
  depth,
}: {
  node: TreeNode;
  depth: number;
}) {
  const [isOpen, setIsOpen] = useState(true);

  const toggle = useCallback(() => {
    if (node.isDirectory) setIsOpen((prev) => !prev);
  }, [node.isDirectory]);

  const hasChildren = node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center gap-1.5 py-[3px] px-2 rounded-md transition-colors duration-100 group/node",
          node.isDirectory
            ? "cursor-pointer hover:bg-muted/60"
            : "hover:bg-muted/30"
        )}
        onClick={toggle}
        role={node.isDirectory ? "button" : undefined}
        aria-expanded={node.isDirectory ? isOpen : undefined}
      >
        {/* Indent guides */}
        {depth > 0 && (
          <span
            className="shrink-0"
            style={{ width: `${(depth - 1) * 20}px` }}
          />
        )}

        {/* Expand/collapse chevron or spacer */}
        {node.isDirectory ? (
          <span className="shrink-0 text-muted-foreground/50">
            {isOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
          </span>
        ) : (
          <span className="shrink-0 w-3.5" />
        )}

        {/* Icon */}
        {node.isDirectory ? (
          isOpen ? (
            <FolderOpen className="size-4 text-amber-500/80 dark:text-amber-400/80 shrink-0" />
          ) : (
            <Folder className="size-4 text-amber-500/80 dark:text-amber-400/80 shrink-0" />
          )
        ) : (
          getFileIcon(node.name)
        )}

        {/* Name */}
        <span
          className={cn(
            "text-sm truncate",
            node.isDirectory
              ? "font-medium text-foreground/90"
              : "text-foreground/75"
          )}
        >
          {node.name}
          {node.isDirectory && "/"}
        </span>

        {/* Annotation */}
        {node.annotation && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="text-xs text-muted-foreground/50 truncate ml-1 font-normal" />
              }
            >
              ({node.annotation})
            </TooltipTrigger>
            <TooltipContent>{node.annotation}</TooltipContent>
          </Tooltip>
        )}

        {/* Child count badge for collapsed directories */}
        {node.isDirectory && !isOpen && hasChildren && (
          <span className="ml-auto text-[10px] font-mono text-muted-foreground/40 bg-muted/50 px-1.5 py-0.5 rounded">
            {node.children.length}
          </span>
        )}
      </div>

      {/* Children */}
      {node.isDirectory && isOpen && hasChildren && (
        <div
          className={cn(
            depth > 0 && "ml-[10px] border-l border-border/40"
          )}
        >
          {node.children.map((child, i) => (
            <TreeNodeItem
              key={`${child.name}-${i}`}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function DirectoryTree({ content }: DirectoryTreeProps) {
  const tree = useMemo(() => parseDirectoryTree(content), [content]);

  if (tree.length === 0) return null;

  const firstNode = tree[0]!;
  const isSingleRoot = tree.length === 1 && firstNode.isDirectory;
  const rootName = isSingleRoot ? firstNode.name : undefined;
  const displayNodes = isSingleRoot ? firstNode.children : tree;
  const rootNode = isSingleRoot ? firstNode : undefined;

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
      {/* Header */}
      <div className="flex h-11 items-center justify-between border-b border-border/40 bg-muted/30 px-4">
        <div className="flex items-center gap-2.5">
          <FolderOpen className="size-4 text-amber-500/80 dark:text-amber-400/80" />
          <span className="text-sm font-medium text-foreground/80">
            {rootName ?? "Directory"}
          </span>
          {rootNode?.annotation && (
            <span className="text-xs text-muted-foreground/50">
              ({rootNode.annotation})
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/35 select-none">
          {countItems(tree)} items
        </span>
      </div>

      {/* Tree content */}
      <div className="py-2 px-1 overflow-x-auto max-h-[500px] overflow-y-auto [scrollbar-width:thin]">
        {displayNodes.map((node, i) => (
          <TreeNodeItem
            key={`${node.name}-${i}`}
            node={node}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}

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
