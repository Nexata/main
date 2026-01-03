import { createFileRoute, redirect } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import MarkdownRenderer from '@/components/ui/markdown-renderer';
import { MessageInput } from '@/components/ui/message-input';

export const Route = createFileRoute('/')({
	beforeLoad: () => {
		throw redirect({
			to: '/login',
		});
	},
});
