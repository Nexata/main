'use client';

import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Chat } from '@/components/ui/chat';
import type { Message } from '@/components/ui/chat-message';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { 'chat.meta.title' as chat_meta_title } from '@/paraglide/messages.js';

const MODELS = [
	{ id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
	{ id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B' },
];

export const Route = createFileRoute('/_private/chat')({
	component: NexataChat,
});

interface UIMessage {
	id: string;
	role: 'user' | 'assistant';
	parts: { type: 'text'; text: string }[];
	experimental_attachments?: {
		name: string;
		contentType: string;
		url: string;
	}[];
}

export function NexataChat() {
	useEffect(() => {
		document.title = chat_meta_title();
	}, []);

	const [selectedModel, setSelectedModel] = useState(MODELS[0]?.id);
	const [messages, setMessages] = useState<UIMessage[]>([]);
	const [input, setInput] = useState('');
	const [status, setStatus] = useState<'idle' | 'submitted' | 'streaming'>(
		'idle',
	);

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		setInput(e.target.value);
	};

	const mockSendMessage = async (userMessage: UIMessage) => {
		setStatus('submitted');

		// Añadimos un "mensaje de IA" vacío para mostrar loading y tipado
		const assistantMessage: UIMessage & { content: string } = {
			id: crypto.randomUUID(),
			role: 'assistant',
			content: '',
			parts: [{ type: 'text', text: '' }],
		};
		setMessages((prev) => [...prev, assistantMessage]);

		setStatus('streaming');

		// Simular "streaming" de texto, letra por letra
		const responseText = simulateResponse(userMessage.parts?.[0]?.text ?? '');
		let currentText = '';
		for (const char of responseText) {
			currentText += char;
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === assistantMessage.id
						? {
								...msg,
								content: currentText,
								parts: [{ type: 'text', text: currentText }],
							}
						: msg,
				),
			);
			await new Promise((r) => setTimeout(r, 30)); // velocidad de tipado
		}

		setStatus('idle');
	};

	const handleSubmit = async (
		event?: { preventDefault?: () => void },
		options?: { experimental_attachments?: FileList },
	) => {
		event?.preventDefault?.();

		if (!input.trim() && !options?.experimental_attachments?.length) return;

		const attachments = options?.experimental_attachments
			? fileListToAttachments(options.experimental_attachments)
			: undefined;

		const userMessage: UIMessage & { content: string } = {
			id: crypto.randomUUID(),
			role: 'user',
			content: input,
			parts: [{ type: 'text', text: input }],
			experimental_attachments: attachments,
		};

		setMessages((prev) => [...prev, userMessage]);
		setInput('');

		await mockSendMessage(userMessage);
	};

	const append = (message: { role: 'user'; content: string }) => {
		const userMessage: UIMessage & { content: string } = {
			id: crypto.randomUUID(),
			role: message.role,
			content: message.content,
			parts: [{ type: 'text', text: message.content }],
		};

		setMessages((prev) => [...prev, userMessage]);
		mockSendMessage(userMessage);
	};

	const isLoading = status === 'submitted' || status === 'streaming';

	function fileListToAttachments(fileList: FileList) {
		return Array.from(fileList).map((file) => ({
			name: file.name,
			contentType: file.type,
			url: URL.createObjectURL(file),
		}));
	}

	return (
		<div className="flex flex-col h-full w-full min-h-0">
			{/* Selector de modelo */}
			<div className="flex justify-end mb-2">
				<Select
					value={selectedModel}
					onValueChange={(val) => setSelectedModel(val || MODELS[0]?.id)}
				>
					<SelectTrigger className="w-[180px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{MODELS.map((model) => (
							<SelectItem key={model.id} value={model.id}>
								{model.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Chat y barra de input */}
			<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
				<Chat
					className="flex-1 min-h-0"
					messages={messages as Message[]}
					input={input}
					handleInputChange={handleInputChange}
					handleSubmit={handleSubmit}
					isGenerating={isLoading}
					stop={() => setStatus('idle')}
					append={append}
					suggestionsLabel="Hola Matias! Con que empezamos?"
					suggestions={[
						'What is the weather in San Francisco?',
						'Explain step-by-step how to solve this math problem: If x² + 6x + 9 = 25, what is x?',
						'Design a simple algorithm to find the longest palindrome in a string.',
					]}
				/>

				{/* Watermark abajo */}
				<div className="text-xs mt-1 w-full text-center text-muted-foreground">
					Nexata's Chat ®
				</div>
			</div>
		</div>
	);
}

/**
 * Simula una respuesta de AI, con markdown y emojis para probar render
 */
function simulateResponse(userText: string) {
	// Puedes devolver algo dinámico según el mensaje
	return `**Simulated AI Response**\n\nYou said: "${userText}"\n\n- Item 1\n- Item 2\n\n> This is a blockquote\n\nHere is some \`inline code\` and a code block:\n\`\`\`js\nconsole.log("Hello world")\n\`\`\`\n😊`;
}
