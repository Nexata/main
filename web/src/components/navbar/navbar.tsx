import { useState } from 'react';
import { LogIn, Menu, X } from 'lucide-react';
import { IoMoon, IoSunny } from 'react-icons/io5';
import { useNavigate } from '@tanstack/react-router';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { LanguageSelector } from '@/components/language-selector/language-selector';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Language } from '@/lib/user';
import {
	'navbar.login' as navbar_login,
	'navbar.toggle_theme' as navbar_toggle_theme,
} from '@/paraglide/messages.js';

// -------------------------------- TYPES --------------------------------

type NavSection = { id: string; label: string };

type NavbarProps = {
	language: Language;
	onLanguageChange: (lang: Language) => void;
	navSections?: NavSection[];
	mobileMenuSections?: NavSection[];
	onScrollToSection?: (id: string) => void;
	onLogoClick: () => void;
	showLogoText?: boolean;
	showMobileLogin?: boolean;
};

// -------------------------------- COMPONENT --------------------------------

export function Navbar({
	language,
	onLanguageChange,
	navSections,
	mobileMenuSections,
	onScrollToSection,
	onLogoClick,
	showLogoText = false,
	showMobileLogin = false,
}: NavbarProps) {
	const navigate = useNavigate();
	const { theme, setTheme } = useTheme();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
	const hasMobileMenu =
		(mobileMenuSections && mobileMenuSections.length > 0) || showMobileLogin;

	return (
		<nav className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-foreground/5">
			<div className="flex justify-between items-center px-4 sm:px-6 lg:px-8 py-4">
				{/* Left: logo + desktop nav links */}
				<div className="flex items-center gap-6">
					<div
						className="flex items-center gap-3 cursor-pointer"
						onClick={onLogoClick}
					>
						<img
							src="/nexata_logo.png"
							alt="Nexata"
							className={`${showLogoText ? 'w-8 h-8' : 'w-9 h-9'} object-contain`}
						/>
						{showLogoText && (
							<span className="text-sm font-semibold text-foreground hidden sm:inline">
								Nexata
							</span>
						)}
					</div>

					{navSections && navSections.length > 0 && (
						<div className="hidden md:flex items-center gap-1">
							{navSections.map((sec) => (
								<button
									key={sec.id}
									onClick={() => onScrollToSection?.(sec.id)}
									className="cursor-pointer text-sm font-medium text-muted-foreground px-3 py-1.5 rounded-md transition-colors hover:text-foreground hover:bg-foreground/5"
								>
									{sec.label}
								</button>
							))}
						</div>
					)}
				</div>

				{/* Right: language selector, theme toggle, login, hamburger */}
				<div className="flex items-center gap-4">
					<LanguageSelector value={language} onChange={onLanguageChange} />

					<Tooltip>
						<TooltipTrigger>
							<span
								className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors text-lg"
								onClick={toggleTheme}
							>
								{theme === 'dark' ? <IoSunny /> : <IoMoon />}
							</span>
						</TooltipTrigger>
						<TooltipContent side="bottom">
							{navbar_toggle_theme({}, { locale: language })}
						</TooltipContent>
					</Tooltip>

					<Button
						variant="ghost"
						size="sm"
						className="hidden sm:inline-flex gap-1.5"
						onClick={() => navigate({ to: '/login' })}
					>
						<LogIn className="w-3.5 h-3.5" />
						{navbar_login({}, { locale: language })}
					</Button>

					{hasMobileMenu && (
						<button
							className="md:hidden cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
							onClick={() => setMobileMenuOpen((v) => !v)}
						>
							{mobileMenuOpen ? (
								<X className="w-5 h-5" />
							) : (
								<Menu className="w-5 h-5" />
							)}
						</button>
					)}
				</div>
			</div>

			{/* Mobile dropdown menu */}
			{mobileMenuOpen && hasMobileMenu && (
				<div className="md:hidden border-t border-foreground/5 bg-background/95 backdrop-blur-xl px-4 pb-4 pt-2 flex flex-col gap-1">
					{mobileMenuSections?.map((sec) => (
						<button
							key={sec.id}
							onClick={() => {
								onScrollToSection?.(sec.id);
								setMobileMenuOpen(false);
							}}
							className="cursor-pointer text-sm font-medium text-muted-foreground px-3 py-2 rounded-md transition-colors hover:text-foreground hover:bg-foreground/5 text-left"
						>
							{sec.label}
						</button>
					))}
					{showMobileLogin && (
						<Button
							variant="ghost"
							size="sm"
							className="sm:hidden justify-start gap-1.5 mt-1"
							onClick={() => {
								navigate({ to: '/login' });
								setMobileMenuOpen(false);
							}}
						>
							<LogIn className="w-3.5 h-3.5" />
							{navbar_login({}, { locale: language })}
						</Button>
					)}
				</div>
			)}
		</nav>
	);
}


