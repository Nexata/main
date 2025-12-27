import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import MarkdownRenderer from '@/components/ui/markdown-renderer';
import { MessageInput } from '@/components/ui/message-input';

export const Route = createFileRoute('/')({ component: Index });

const MD_TEST = `
## Test de markdown

*funciona?* _si_
`.trim();

function Index() {
	return (
		<div className="p-2">
			<Button>Welcome Home!</Button>
			<MarkdownRenderer>{MD_TEST}</MarkdownRenderer>
			<MessageInput isGenerating={false} value="hello"></MessageInput>
		</div>
	);
}
