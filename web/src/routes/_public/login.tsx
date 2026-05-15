import { createFileRoute, redirect, useNavigate, useSearch } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { AlertTriangle, Rocket } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { IoLogoMicrosoft } from 'react-icons/io5';
import { SiDropbox } from 'react-icons/si';
import RegisterTenantModal from '@/components/register-tenant/register-tenant.modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { getStoredLanguage } from '@/hooks/use-sync-language';
import { isAuthenticated } from '@/lib/auth';
import {
	getDropboxLoginUrl,
	getGoogleLoginUrl,
	getMicrosoftLoginUrl,
} from '@/lib/oauth';
import type { Language } from '@/lib/user';
import {
	'login.auth_error.close' as login_auth_error_close,
	'login.auth_error.description' as login_auth_error_description,
	'login.auth_error.state_mismatch' as login_auth_error_state_mismatch,
	'login.auth_error.title' as login_auth_error_title,
	'login.auth_error.user_not_found' as login_auth_error_user_not_found,
	'login.create_tenant_button' as login_create_tenant_button,
	'login.create_tenant_prompt' as login_create_tenant_prompt,
	'login.meta.description' as login_meta_description,
	'login.meta.title' as login_meta_title,
	'login.oauth.dropbox' as login_oauth_dropbox,
	'login.oauth.google' as login_oauth_google,
	'login.oauth.microsoft' as login_oauth_microsoft,
	'login.subtitle' as login_subtitle,
	'login.title' as login_title,
} from '@/paraglide/messages.js';
import { isLocale, setLocale } from '@/paraglide/runtime';

export const Route = createFileRoute('/_public/login')({
	beforeLoad: () => {
		if (isAuthenticated()) {
			throw redirect({ to: '/chat', search: { id: undefined } });
		}
	},
	validateSearch: (search: Record<string, unknown>) => ({
		authError: typeof search.authError === 'string' ? search.authError : undefined,
	}),
	component: LoginPage,
	head: () => ({
		meta: [
			{ title: login_meta_title() },
			{ name: 'description', content: login_meta_description() },
			{ property: 'og:title', content: login_meta_title() },
			{ property: 'og:description', content: login_meta_description() },
			{ property: 'og:url', content: 'https://nexata.app/login' },
			{ name: 'twitter:title', content: login_meta_title() },
			{ name: 'twitter:description', content: login_meta_description() },
		],
		links: [{ rel: 'canonical', href: 'https://nexata.app/login' }],
	}),
});

function LoginPage() {
	const language = getStoredLanguage();
	const lc = { locale: language };
	const navigate = useNavigate();
	const { authError } = useSearch({ from: '/_public/login' });

	const [registerOpen, setRegisterOpen] = useState(false);
	const [errorOpen, setErrorOpen] = useState(Boolean(authError));

	useEffect(() => {
		const locale = language as unknown as string;
		if (isLocale(locale)) setLocale(locale, { reload: false });
	}, [language]);

	function getErrorMessage() {
		if (!authError) return login_auth_error_description({}, lc);
		if (authError.includes('state') || authError.includes('mismatch'))
			return login_auth_error_state_mismatch({}, lc);
		if (authError.includes('user') || authError.includes('not_found'))
			return login_auth_error_user_not_found({}, lc);
		return login_auth_error_description({}, lc);
	}

	function handleCloseError() {
		setErrorOpen(false);
		// Clear the authError param from the URL without re-triggering navigation
		navigate({ to: '/login', search: {}, replace: true });
	}

	return (
		<div className="min-h-screen flex items-center justify-center px-6 sm:px-0 bg-card sm:bg-background">
			<motion.div
				initial={{ opacity: 0, scale: 0.96 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.25, ease: 'easeOut' }}
				className="w-full sm:max-w-lg"
			>
				{/* Mobile: sin Card, solo contenido directo */}
				<div className="block sm:hidden">
					<LoginContent lc={lc} onOpenRegister={() => setRegisterOpen(true)} />
				</div>

				{/* Desktop: Card con bordes redondeados y más ancha */}
				<div className="hidden sm:block">
					<Card className="rounded-2xl border shadow-2xl shadow-black/10">
						<CardContent className="p-10">
							<LoginContent lc={lc} onOpenRegister={() => setRegisterOpen(true)} />
						</CardContent>
					</Card>
				</div>
			</motion.div>

			<RegisterTenantModal
				open={registerOpen}
				onOpenChange={setRegisterOpen}
				language={language}
			/>

			{/* OAuth error dialog */}
			<Dialog open={errorOpen} onOpenChange={setErrorOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="h-4 w-4 text-destructive" />
							{login_auth_error_title({}, lc)}
						</DialogTitle>
						<DialogDescription className="pt-1">
							{getErrorMessage()}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" className="cursor-pointer" onClick={handleCloseError}>
							{login_auth_error_close({}, lc)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function LoginContent({
	lc,
	onOpenRegister,
}: {
	lc: { locale: Language };
	onOpenRegister: () => void;
}) {
	return (
		<>
			{/* Logo */}
			<div className="flex items-center justify-center gap-4 mb-10 sm:mb-8">
				<img
					src="/nexata_logo.png"
					alt="Nexata"
					className="h-14 sm:h-10 w-auto object-contain"
				/>
			</div>

			{/* Title */}
			<h1 className="text-3xl sm:text-2xl font-semibold text-center mb-3 sm:mb-2">
				{login_title({}, lc)}
			</h1>
			<p className="text-base sm:text-sm text-muted-foreground text-center mb-10 sm:mb-6">
				{login_subtitle({}, lc)}
			</p>

			{/* OAuth Buttons */}
			<div className="flex flex-col gap-4 sm:gap-3">
				<Button
					variant="outline"
					className="h-13 sm:h-11 text-base sm:text-sm gap-3 cursor-pointer"
					onClick={async () => {
						const url = await getMicrosoftLoginUrl();
						window.location.href = url;
					}}
				>
					<IoLogoMicrosoft className="h-6 w-6 sm:h-5 sm:w-5 text-blue-500" />
					{login_oauth_microsoft({}, lc)}
				</Button>
				<Button
					variant="outline"
					className="h-13 sm:h-11 text-base sm:text-sm gap-3 cursor-pointer"
					onClick={async () => {
						const url = await getGoogleLoginUrl();
						window.location.href = url;
					}}
				>
					<FcGoogle className="h-6 w-6 sm:h-5 sm:w-5" />
					{login_oauth_google({}, lc)}
				</Button>
				<Button
					variant="outline"
					className="h-13 sm:h-11 text-base sm:text-sm gap-3 cursor-pointer"
					onClick={async () => {
						const url = await getDropboxLoginUrl();
						window.location.href = url;
					}}
				>
					<SiDropbox className="h-6 w-6 sm:h-5 sm:w-5 text-[#0061FF]" />
					{login_oauth_dropbox({}, lc)}
				</Button>
			</div>

			{/* Create tenant CTA */}
			<div className="mt-8 sm:mt-6 pt-6 sm:pt-5 border-t border-border flex flex-col items-center gap-3">
				<p className="text-sm text-muted-foreground text-center">
					{login_create_tenant_prompt({}, lc)}
				</p>
				<Button
					variant="default"
					className="gap-2 cursor-pointer"
					onClick={onOpenRegister}
				>
					<Rocket className="h-4 w-4" />
					{login_create_tenant_button({}, lc)}
				</Button>
			</div>
		</>
	);
}
