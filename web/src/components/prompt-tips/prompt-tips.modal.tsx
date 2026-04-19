import { Brain, FileSearch, Database, Mail, ClipboardList, MessageSquareText, Lightbulb, SplitSquareHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  "prompt_tips.title" as prompt_tips_title,
  "prompt_tips.description" as prompt_tips_description,
  "prompt_tips.brain_title" as prompt_tips_brain_title,
  "prompt_tips.brain_desc" as prompt_tips_brain_desc,
  "prompt_tips.context_title" as prompt_tips_context_title,
  "prompt_tips.context_desc" as prompt_tips_context_desc,
  "prompt_tips.ingestion_title" as prompt_tips_ingestion_title,
  "prompt_tips.ingestion_desc" as prompt_tips_ingestion_desc,
  "prompt_tips.credentials_title" as prompt_tips_credentials_title,
  "prompt_tips.credentials_desc" as prompt_tips_credentials_desc,
  "prompt_tips.output_title" as prompt_tips_output_title,
  "prompt_tips.output_desc" as prompt_tips_output_desc,
  "prompt_tips.one_thing_title" as prompt_tips_one_thing_title,
  "prompt_tips.one_thing_desc" as prompt_tips_one_thing_desc,
  "prompt_tips.examples_title" as prompt_tips_examples_title,
  "prompt_tips.examples_desc" as prompt_tips_examples_desc,
  "prompt_tips.decompose_title" as prompt_tips_decompose_title,
  "prompt_tips.decompose_desc" as prompt_tips_decompose_desc,
} from "@/paraglide/messages.js";

interface PromptTipsModalProps {
  open: boolean;
  onClose: () => void;
}

const tips = [
  { icon: Brain, title: prompt_tips_brain_title, desc: prompt_tips_brain_desc, color: "text-pink-500" },
  { icon: FileSearch, title: prompt_tips_context_title, desc: prompt_tips_context_desc, color: "text-blue-500" },
  { icon: Database, title: prompt_tips_ingestion_title, desc: prompt_tips_ingestion_desc, color: "text-emerald-500" },
  { icon: Mail, title: prompt_tips_credentials_title, desc: prompt_tips_credentials_desc, color: "text-amber-500" },
  { icon: ClipboardList, title: prompt_tips_output_title, desc: prompt_tips_output_desc, color: "text-violet-500" },
  { icon: MessageSquareText, title: prompt_tips_one_thing_title, desc: prompt_tips_one_thing_desc, color: "text-cyan-500" },
  { icon: Lightbulb, title: prompt_tips_examples_title, desc: prompt_tips_examples_desc, color: "text-yellow-500" },
  { icon: SplitSquareHorizontal, title: prompt_tips_decompose_title, desc: prompt_tips_decompose_desc, color: "text-rose-500" },
] as const;

export default function PromptTipsModal({ open, onClose }: PromptTipsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{prompt_tips_title()}</DialogTitle>
          <DialogDescription>{prompt_tips_description()}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-2">
          {tips.map(({ icon: Icon, title, desc, color }, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="mt-0.5 shrink-0">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-medium">{title()}</p>
                <p className="text-sm text-muted-foreground">{desc()}</p>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
