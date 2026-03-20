import { createFileRoute, redirect } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { isLocale, setLocale } from '@/paraglide/runtime';
import { getStoredLanguage } from '@/hooks/use-sync-language';
import type { Language } from '@/lib/user';
import { FcGoogle } from 'react-icons/fc';
import { IoLogoMicrosoft } from 'react-icons/io5';
import { SiDropbox } from 'react-icons/si';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { isAuthenticated } from '@/lib/auth';
import {
	getDropboxLoginUrl,
	getGoogleLoginUrl,
	getMicrosoftLoginUrl,
} from '@/lib/oauth';
import {
	'login.meta.title' as login_meta_title,
	'login.oauth.dropbox' as login_oauth_dropbox,
	'login.oauth.google' as login_oauth_google,
	'login.oauth.microsoft' as login_oauth_microsoft,
	'login.subtitle' as login_subtitle,
	'login.title' as login_title,
} from '@/paraglide/messages.js';

export const Route = createFileRoute('/_public/login')({
	beforeLoad: () => {
		if (isAuthenticated()) {
			throw redirect({ to: '/chat', search: { id: undefined } });
		}
	},
	component: LoginPage,
});

function LoginPage() {
	const language = getStoredLanguage();
	const lc = { locale: language };

	useEffect(() => {
		const locale = language as unknown as string;
		if (isLocale(locale)) setLocale(locale, { reload: false });
		document.title = login_meta_title({}, lc);
	}, []);

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
					<LoginContent lc={lc} />
				</div>

				{/* Desktop: Card con bordes redondeados y más ancha */}
				<div className="hidden sm:block">
					<Card className="rounded-2xl border shadow-2xl shadow-black/10">
						<CardContent className="p-10">
							<LoginContent lc={lc} />
						</CardContent>
					</Card>
				</div>
			</motion.div>
		</div>
	);
}

function LoginContent({ lc }: { lc: { locale: Language } }) {
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
		</>
	);
}
