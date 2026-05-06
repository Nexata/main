import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
	AnimatePresence,
	motion,
	useAnimationFrame,
	useInView,
	useMotionValue,
} from 'framer-motion';
import {
	ArrowRight,
	ArrowUp,
	Brain,
	Calendar,
	Check,
	ChevronDown,
	ClipboardList,
	FileText,
	Link,
	Lock,
	LogIn,
	Mail,
	MessageCircle,
	MessageSquare,
	Paperclip,
	Quote,
	Rocket,
	Search,
	Shield,
	Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Footer } from '@/components/footer/footer';
import { Navbar } from '@/components/navbar/navbar';
import RegisterTenantModal from '@/components/register-tenant/register-tenant.modal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { usePersistedLanguage } from '@/hooks/use-sync-language';
import {
	DINAMIC_DATA_SOURCES,
	STORAGE_DATA_SOURCES,
} from '@/lib/available-sources';
import type { Language } from '@/lib/user';
import {
	'home.cta.demo' as home_cta_demo,
	'home.cta.start' as home_cta_start,
	'home.cta.subtitle' as home_cta_subtitle,
	'home.cta.title' as home_cta_title,
	'home.features.item_1_desc' as home_features_item_1_desc,
	'home.features.item_1_title' as home_features_item_1_title,
	'home.features.item_2_desc' as home_features_item_2_desc,
	'home.features.item_2_title' as home_features_item_2_title,
	'home.features.item_3_desc' as home_features_item_3_desc,
	'home.features.item_3_title' as home_features_item_3_title,
	'home.features.item_4_desc' as home_features_item_4_desc,
	'home.features.item_4_title' as home_features_item_4_title,
	'home.features.item_5_desc' as home_features_item_5_desc,
	'home.features.item_5_title' as home_features_item_5_title,
	'home.features.item_6_desc' as home_features_item_6_desc,
	'home.features.item_6_title' as home_features_item_6_title,
	'home.features.title' as home_features_title,
	'home.hero.cta' as home_hero_cta,
	'home.hero.login' as home_hero_login,
	'home.hero.scroll_label' as home_hero_scroll_label,
	'home.hero.subtitle' as home_hero_subtitle,
	'home.hero.tagline' as home_hero_tagline,
	'home.hero.title' as home_hero_title,
	'home.hero.trust_no_card' as home_hero_trust_no_card,
	'home.hero.trust_permissions' as home_hero_trust_permissions,
	'home.hero.trust_setup' as home_hero_trust_setup,
	'home.hero.works_with' as home_hero_works_with,
	'home.intro.body' as home_intro_body,
	'home.intro.body2' as home_intro_body2,
	'home.intro.stat_connect' as home_intro_stat_connect,
	'home.intro.stat_faster' as home_intro_stat_faster,
	'home.intro.stat_integrations' as home_intro_stat_integrations,
	'home.intro.stat_permissions' as home_intro_stat_permissions,
	'home.intro.step_1_desc' as home_intro_step_1_desc,
	'home.intro.step_1_title' as home_intro_step_1_title,
	'home.intro.step_2_desc' as home_intro_step_2_desc,
	'home.intro.step_2_title' as home_intro_step_2_title,
	'home.intro.step_3_desc' as home_intro_step_3_desc,
	'home.intro.step_3_title' as home_intro_step_3_title,
	'home.intro.step_4_desc' as home_intro_step_4_desc,
	'home.intro.step_4_title' as home_intro_step_4_title,
	'home.intro.title' as home_intro_title,
	'home.meta.description' as home_meta_description,
	'home.meta.title' as home_meta_title,
	'home.nexy.ask_placeholder' as home_nexy_ask_placeholder,
	'home.nexy.feature_1_desc' as home_nexy_feature_1_desc,
	'home.nexy.feature_1_title' as home_nexy_feature_1_title,
	'home.nexy.feature_2_desc' as home_nexy_feature_2_desc,
	'home.nexy.feature_2_title' as home_nexy_feature_2_title,
	'home.nexy.feature_3_desc' as home_nexy_feature_3_desc,
	'home.nexy.feature_3_title' as home_nexy_feature_3_title,
	'home.nexy.feature_4_desc' as home_nexy_feature_4_desc,
	'home.nexy.feature_4_title' as home_nexy_feature_4_title,
	'home.nexy.feature_5_desc' as home_nexy_feature_5_desc,
	'home.nexy.feature_5_title' as home_nexy_feature_5_title,
	'home.nexy.online' as home_nexy_online,
	'home.nexy.subtitle' as home_nexy_subtitle,
	'home.nexy.title' as home_nexy_title,
	'home.sources.subtitle' as home_sources_subtitle,
	'home.sources.title' as home_sources_title,
	'home.usecases.case_prefix' as home_usecases_case_prefix,
	'home.usecases.challenge_label' as home_usecases_challenge_label,
	'home.usecases.challenge_short' as home_usecases_challenge_short,
	'home.usecases.item_1_problem' as home_usecases_item_1_problem,
	'home.usecases.item_1_solution' as home_usecases_item_1_solution,
	'home.usecases.item_1_title' as home_usecases_item_1_title,
	'home.usecases.item_2_problem' as home_usecases_item_2_problem,
	'home.usecases.item_2_solution' as home_usecases_item_2_solution,
	'home.usecases.item_2_title' as home_usecases_item_2_title,
	'home.usecases.item_3_problem' as home_usecases_item_3_problem,
	'home.usecases.item_3_solution' as home_usecases_item_3_solution,
	'home.usecases.item_3_title' as home_usecases_item_3_title,
	'home.usecases.item_4_problem' as home_usecases_item_4_problem,
	'home.usecases.item_4_solution' as home_usecases_item_4_solution,
	'home.usecases.item_4_title' as home_usecases_item_4_title,
	'home.usecases.item_5_problem' as home_usecases_item_5_problem,
	'home.usecases.item_5_solution' as home_usecases_item_5_solution,
	'home.usecases.item_5_title' as home_usecases_item_5_title,
	'home.usecases.next' as home_usecases_next,
	'home.usecases.prev' as home_usecases_prev,
	'home.usecases.solution_label' as home_usecases_solution_label,
	'home.usecases.solution_short' as home_usecases_solution_short,
	'home.usecases.title' as home_usecases_title,
	'home.why.testimonial_1_quote' as home_why_testimonial_1_quote,
	'home.why.testimonial_1_role' as home_why_testimonial_1_role,
	'home.why.testimonial_2_quote' as home_why_testimonial_2_quote,
	'home.why.testimonial_2_role' as home_why_testimonial_2_role,
	'home.why.testimonial_3_quote' as home_why_testimonial_3_quote,
	'home.why.testimonial_3_role' as home_why_testimonial_3_role,
	'home.why.title' as home_why_title,
	'navbar.nav_features' as navbar_nav_features,
	'navbar.nav_home' as navbar_nav_home,
	'navbar.nav_nexy' as navbar_nav_nexy,
	'navbar.nav_platform' as navbar_nav_platform,
	'navbar.nav_use_cases' as navbar_nav_use_cases,
} from '@/paraglide/messages.js';

export const Route = createFileRoute('/_public/home')({
	component: Home,
	head: () => ({
		meta: [
			{ title: home_meta_title() },
			{ name: 'description', content: home_meta_description() },
			{ property: 'og:title', content: home_meta_title() },
			{ property: 'og:description', content: home_meta_description() },
			{ property: 'og:url', content: 'https://nexata.app/home' },
			{ name: 'twitter:title', content: home_meta_title() },
			{ name: 'twitter:description', content: home_meta_description() },
		],
		links: [{ rel: 'canonical', href: 'https://nexata.app/home' }],
	}),
});

// -------------------------------- ANIMATIONS --------------------------------

const fadeUp = {
	initial: { opacity: 0, y: 24 },
	whileInView: { opacity: 1, y: 0 },
	viewport: { once: true },
	transition: { duration: 0.5, ease: 'easeOut' },
};

// -------------------------------- MAIN COMPONENT --------------------------------

export default function Home() {
	const navigate = useNavigate();
	const [language, setLanguage] = usePersistedLanguage();
	const [registerOpen, setRegisterOpen] = useState(false);

	const lc = { locale: language };

	const navSections = [
		{ id: 'hero', label: navbar_nav_home({}, lc) },
		{ id: 'intro', label: navbar_nav_platform({}, lc) },
		{ id: 'nexy', label: navbar_nav_nexy({}, lc) },
		{ id: 'usecases', label: navbar_nav_use_cases({}, lc) },
		{ id: 'features', label: navbar_nav_features({}, lc) },
	];

	const nexyFeatures = [
		{
			icon: Search,
			title: home_nexy_feature_1_title({}, lc),
			desc: home_nexy_feature_1_desc({}, lc),
		},
		{
			icon: Mail,
			title: home_nexy_feature_2_title({}, lc),
			desc: home_nexy_feature_2_desc({}, lc),
		},
		{
			icon: Calendar,
			title: home_nexy_feature_3_title({}, lc),
			desc: home_nexy_feature_3_desc({}, lc),
		},
		{
			icon: MessageSquare,
			title: home_nexy_feature_4_title({}, lc),
			desc: home_nexy_feature_4_desc({}, lc),
		},
		{
			icon: FileText,
			title: home_nexy_feature_5_title({}, lc),
			desc: home_nexy_feature_5_desc({}, lc),
		},
	];

	const usecaseItems = [
		{
			title: home_usecases_item_1_title({}, lc),
			problem: home_usecases_item_1_problem({}, lc),
			solution: home_usecases_item_1_solution({}, lc),
		},
		{
			title: home_usecases_item_2_title({}, lc),
			problem: home_usecases_item_2_problem({}, lc),
			solution: home_usecases_item_2_solution({}, lc),
		},
		{
			title: home_usecases_item_3_title({}, lc),
			problem: home_usecases_item_3_problem({}, lc),
			solution: home_usecases_item_3_solution({}, lc),
		},
		{
			title: home_usecases_item_4_title({}, lc),
			problem: home_usecases_item_4_problem({}, lc),
			solution: home_usecases_item_4_solution({}, lc),
		},
		{
			title: home_usecases_item_5_title({}, lc),
			problem: home_usecases_item_5_problem({}, lc),
			solution: home_usecases_item_5_solution({}, lc),
		},
	];

	const featureItems = [
		{
			icon: Search,
			title: home_features_item_1_title({}, lc),
			desc: home_features_item_1_desc({}, lc),
		},
		{
			icon: Link,
			title: home_features_item_2_title({}, lc),
			desc: home_features_item_2_desc({}, lc),
		},
		{
			icon: Zap,
			title: home_features_item_3_title({}, lc),
			desc: home_features_item_3_desc({}, lc),
		},
		{
			icon: ClipboardList,
			title: home_features_item_4_title({}, lc),
			desc: home_features_item_4_desc({}, lc),
		},
		{
			icon: Lock,
			title: home_features_item_5_title({}, lc),
			desc: home_features_item_5_desc({}, lc),
		},
		{
			icon: MessageCircle,
			title: home_features_item_6_title({}, lc),
			desc: home_features_item_6_desc({}, lc),
		},
	];

	const introSteps = [
		{
			title: home_intro_step_1_title({}, lc),
			desc: home_intro_step_1_desc({}, lc),
		},
		{
			title: home_intro_step_2_title({}, lc),
			desc: home_intro_step_2_desc({}, lc),
		},
		{
			title: home_intro_step_3_title({}, lc),
			desc: home_intro_step_3_desc({}, lc),
		},
		{
			title: home_intro_step_4_title({}, lc),
			desc: home_intro_step_4_desc({}, lc),
		},
	];

	const introStats = [
		{ value: '10x', label: home_intro_stat_faster({}, lc) },
		{ value: '+8', label: home_intro_stat_integrations({}, lc) },
		{ value: '< 1min', label: home_intro_stat_connect({}, lc) },
		{ value: '100%', label: home_intro_stat_permissions({}, lc) },
	];

	const testimonials = [
		{
			role: home_why_testimonial_1_role({}, lc),
			quote: home_why_testimonial_1_quote({}, lc),
		},
		{
			role: home_why_testimonial_2_role({}, lc),
			quote: home_why_testimonial_2_quote({}, lc),
		},
		{
			role: home_why_testimonial_3_role({}, lc),
			quote: home_why_testimonial_3_quote({}, lc),
		},
	];

	const allSources = [...DINAMIC_DATA_SOURCES, ...STORAGE_DATA_SOURCES];

	const scrollToSection = (id: string) => {
		const el = document.getElementById(id);
		if (el) el.scrollIntoView({ behavior: 'smooth' });
	};

	return (
		<div className="min-h-screen w-full bg-background text-foreground flex flex-col relative">
			{/* -------------------- Navbar -------------------- */}
			<Navbar
				language={language}
				onLanguageChange={setLanguage}
				navSections={navSections}
				mobileMenuSections={navSections}
				onScrollToSection={scrollToSection}
				onLogoClick={() => scrollToSection('hero')}
				showMobileLogin
			/>

			{/* -------------------- Content -------------------- */}
			<main className="flex flex-col">
				{/* ===== Hero ===== */}
				<section
					id="hero"
					className="flex flex-col items-center justify-center text-center pt-32 pb-28 px-6 w-full bg-gradient-to-b from-primary/10 via-primary/5 to-background relative overflow-hidden"
				>
					{/* Dot grid texture */}
					<div
						className="absolute inset-0 pointer-events-none"
						style={{
							backgroundImage:
								'radial-gradient(circle, var(--color-border) 1px, transparent 1px)',
							backgroundSize: '28px 28px',
							opacity: 0.6,
						}}
					/>

					{/* Decorative glows */}
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/[0.07] blur-3xl pointer-events-none" />
					<div className="absolute -top-24 -left-24 w-[380px] h-[380px] rounded-full bg-primary/[0.06] blur-3xl pointer-events-none" />
					<div className="absolute -bottom-16 -right-16 w-[300px] h-[300px] rounded-full bg-accent/[0.06] blur-3xl pointer-events-none" />

					{/* Content */}
					<div className="flex flex-col items-center gap-6 max-w-2xl relative z-10">
						{/* Announcement badge */}
						<motion.div
							initial={{ opacity: 0, y: -12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0 }}
						></motion.div>

						{/* Logo with pulse ring */}
						<motion.div
							initial={{ opacity: 0, scale: 0.85 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
							className="relative flex items-center justify-center"
						>
							<motion.div
								animate={{ scale: [1, 1.22, 1], opacity: [0.25, 0.08, 0.25] }}
								transition={{
									duration: 3.5,
									repeat: Infinity,
									ease: 'easeInOut',
								}}
								className="absolute w-28 h-28 rounded-full bg-primary/20 pointer-events-none"
							/>
							<img
								src="/nexata_logo.png"
								alt="Nexata"
								width={88}
								height={88}
								className="object-contain relative z-10"
							/>
						</motion.div>

						{/* Title */}
						<motion.h1
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6, delay: 0.2 }}
							className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight tracking-tight"
						>
							{home_hero_title({}, lc)}
						</motion.h1>

						{/* Tagline */}
						<motion.p
							initial={{ opacity: 0, y: 14 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.3 }}
							className="text-base sm:text-lg text-primary font-medium"
						>
							{home_hero_tagline({}, lc)}
						</motion.p>

						{/* Subtitle */}
						<motion.p
							initial={{ opacity: 0, y: 14 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.35 }}
							className="text-muted-foreground text-base sm:text-lg max-w-xl"
						>
							{home_hero_subtitle({}, lc)}
						</motion.p>

						{/* CTA Buttons */}
						<motion.div
							initial={{ opacity: 0, y: 14 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.45 }}
							className="flex flex-col sm:flex-row gap-3 mt-2"
						>
							<Button
								size="lg"
								className="relative gap-2 overflow-hidden bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 group"
								onClick={() => setRegisterOpen(true)}
							>
								<span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 ease-in-out pointer-events-none" />
								<Rocket className="w-4 h-4" />
								{home_hero_cta({}, lc)}
								<ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="gap-2"
								onClick={() => navigate({ to: '/login' })}
							>
								<LogIn className="w-4 h-4" />
								{home_hero_login({}, lc)}
							</Button>
						</motion.div>

						{/* Trust strip */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.6, delay: 0.55 }}
							className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground"
						>
							<span className="flex items-center gap-1.5">
								<Shield className="w-3 h-3 text-primary/60" />
								{home_hero_trust_no_card({}, lc)}
							</span>
							<span className="hidden sm:inline opacity-30">·</span>
							<span className="flex items-center gap-1.5">
								<Zap className="w-3 h-3 text-primary/60" />
								{home_hero_trust_setup({}, lc)}
							</span>
							<span className="hidden sm:inline opacity-30">·</span>
							<span className="flex items-center gap-1.5">
								<Lock className="w-3 h-3 text-primary/60" />
								{home_hero_trust_permissions({}, lc)}
							</span>
						</motion.div>

						{/* Integration pills */}
						<motion.div
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.65 }}
							className="flex items-center justify-center gap-1.5"
						>
							<span className="text-xs text-muted-foreground/50 font-medium">
								{home_hero_works_with({}, lc)}
							</span>
							{allSources.slice(0, 5).map((src) => (
								<div
									key={src.id}
									title={src.name}
									className="flex items-center justify-center w-7 h-7 rounded-full border border-border bg-card/70 backdrop-blur-sm"
								>
									<img
										src={src.icon}
										alt={src.name}
										className="w-4 h-4 object-contain"
									/>
								</div>
							))}
							<div className="flex items-center justify-center rounded-full border border-border bg-card/70 px-2 py-0.5 backdrop-blur-sm">
								<span className="text-xs text-muted-foreground font-medium">
									+{allSources.length - 5}
								</span>
							</div>
						</motion.div>
					</div>

					{/* Scroll cue */}
					<motion.button
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.6, delay: 1.0 }}
						onClick={() => scrollToSection('intro')}
						className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors z-10 cursor-pointer"
						aria-label={home_hero_scroll_label({}, lc)}
					>
						<motion.div
							animate={{ y: [0, 5, 0] }}
							transition={{
								duration: 1.8,
								repeat: Infinity,
								ease: 'easeInOut',
							}}
						>
							<ChevronDown className="w-5 h-5" />
						</motion.div>
					</motion.button>
				</section>

				{/* ===== Intro / What is Nexata ===== */}
				<section id="intro" className="relative overflow-hidden py-20">
					{/* Decorative bg */}
					<div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary/[0.05] blur-3xl pointer-events-none -translate-y-1/3 translate-x-1/3" />
					<div className="absolute bottom-0 left-0 w-[380px] h-[380px] rounded-full bg-accent/[0.04] blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/3" />
					<div className="relative z-10 px-6 max-w-5xl mx-auto space-y-12">
						{/* Title */}
						<motion.div {...fadeUp} className="text-center">
							<h2 className="text-3xl sm:text-4xl font-bold text-foreground">
								{home_intro_title({}, lc)}
							</h2>
						</motion.div>

						{/* Text + Stat cards */}
						<motion.div
							{...fadeUp}
							className="grid md:grid-cols-2 gap-10 items-center"
						>
							<div className="space-y-4 text-left">
								<p className="text-lg text-muted-foreground leading-relaxed">
									{home_intro_body({}, lc)}
								</p>
								<p className="text-muted-foreground leading-relaxed">
									{home_intro_body2({}, lc)}
								</p>
							</div>

							<div className="grid grid-cols-2 gap-3">
								{introStats.map((stat, i) => (
									<motion.div
										key={stat.label}
										initial={{ opacity: 0, scale: 0.9 }}
										whileInView={{ opacity: 1, scale: 1 }}
										viewport={{ once: true }}
										transition={{
											duration: 0.3,
											delay: i * 0.08,
											ease: 'easeOut',
										}}
										className="rounded-xl border border-border bg-card p-5 flex flex-col gap-1 text-center"
									>
										<span className="text-3xl font-bold text-primary">
											{stat.value}
										</span>
										<span className="text-xs text-muted-foreground leading-snug">
											{stat.label}
										</span>
									</motion.div>
								))}
							</div>
						</motion.div>

						{/* Stepper desktop */}
						<div className="hidden sm:block">
							<IntroStepper steps={introSteps} />
						</div>

						{/* Stepper mobile */}
						<div className="sm:hidden space-y-4">
							{introSteps.map((step, i) => (
								<motion.div
									key={step.title}
									initial={{ opacity: 0, x: -16 }}
									whileInView={{ opacity: 1, x: 0 }}
									viewport={{ once: true }}
									transition={{
										duration: 0.4,
										delay: i * 0.1,
										ease: 'easeOut',
									}}
									className="flex gap-4 text-left"
								>
									<div className="flex flex-col items-center gap-1 shrink-0">
										<span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm">
											{i + 1}
										</span>
										{i < introSteps.length - 1 && (
											<div className="w-px flex-1 min-h-6 bg-border" />
										)}
									</div>
									<div className="pb-4">
										<h3 className="text-base font-semibold text-foreground mb-1">
											{step.title}
										</h3>
										<p className="text-muted-foreground text-sm">{step.desc}</p>
									</div>
								</motion.div>
							))}
						</div>
					</div>
				</section>

				{/* ===== Data Sources Carousel ===== */}
				<section className="relative overflow-hidden py-16 text-center space-y-10">
					{/* Crosshatch grid */}
					<div
						className="absolute inset-0 pointer-events-none"
						style={{
							backgroundImage:
								'linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)',
							backgroundSize: '40px 40px',
							opacity: 0.3,
						}}
					/>
					{/* Fade edges to background */}
					<div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-background to-transparent pointer-events-none" />
					<div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent pointer-events-none" />
					{/* Center horizontal glow */}
					<div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-32 bg-gradient-to-r from-background via-primary/[0.06] to-background pointer-events-none" />
					<motion.div {...fadeUp} className="relative z-10 space-y-3 px-6">
						<h2 className="text-3xl sm:text-4xl font-bold text-foreground">
							{home_sources_title({}, lc)}
						</h2>
						<p className="text-muted-foreground text-lg max-w-xl mx-auto">
							{home_sources_subtitle({}, lc)}
						</p>
					</motion.div>

					<div className="relative z-10">
						<SourcesMarquee sources={allSources} />
					</div>
				</section>

				{/* ===== Meet Nexy ===== */}
				<section
					id="nexy"
					className="relative overflow-hidden px-6 py-20 bg-gradient-to-b from-primary/8 via-primary/[0.04] to-background"
				>
					{/* Side glows */}
					<div className="absolute left-0 top-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-primary/[0.06] blur-3xl pointer-events-none -translate-x-1/2" />
					<div className="absolute right-0 bottom-0 w-[300px] h-[300px] rounded-full bg-accent/[0.05] blur-3xl pointer-events-none translate-x-1/3 translate-y-1/4" />
					{/* Concentric rings decoration */}
					<div className="absolute right-[-140px] top-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full border border-primary/[0.07] pointer-events-none" />
					<div className="absolute right-[-100px] top-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full border border-primary/[0.05] pointer-events-none" />
					<div className="absolute right-[-60px] top-1/2 -translate-y-1/2 w-[240px] h-[240px] rounded-full border border-primary/[0.04] pointer-events-none" />
					<div className="relative z-10 max-w-6xl mx-auto space-y-12">
						<motion.div
							{...fadeUp}
							className="text-center max-w-3xl mx-auto space-y-4"
						>
							<h2 className="text-3xl sm:text-4xl font-bold text-foreground">
								{home_nexy_title({}, lc)}
							</h2>
							<p className="text-lg text-muted-foreground">
								{home_nexy_subtitle({}, lc)}
							</p>
						</motion.div>

						<motion.div {...fadeUp}>
							<NexyShowcase
								features={nexyFeatures}
								onlineLabel={home_nexy_online({}, lc)}
								askPlaceholder={home_nexy_ask_placeholder({}, lc)}
								language={language}
							/>
						</motion.div>
					</div>
				</section>

				{/* ===== Use Cases ===== */}
				<section
					id="usecases"
					className="relative overflow-hidden px-6 py-20 bg-gradient-to-br from-muted/30 via-background to-background"
				>
					{/* Diagonal stripe texture */}
					<div
						className="absolute inset-0 pointer-events-none"
						style={{
							backgroundImage:
								'repeating-linear-gradient(135deg, transparent, transparent 48px, var(--color-border) 48px, var(--color-border) 49px)',
							opacity: 0.18,
						}}
					/>
					{/* Top-right glow */}
					<div className="absolute top-0 right-0 w-[460px] h-[460px] rounded-full bg-primary/[0.05] blur-3xl pointer-events-none -translate-y-1/4 translate-x-1/4" />
					{/* Bottom-left accent */}
					<div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-accent/[0.04] blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/4" />
					<div className="relative z-10 max-w-6xl mx-auto space-y-12">
						<motion.div {...fadeUp} className="text-center">
							<h2 className="text-3xl sm:text-4xl font-bold text-foreground">
								{home_usecases_title({}, lc)}
							</h2>
						</motion.div>
						<motion.div {...fadeUp}>
							<UseCasesInteractive
								items={usecaseItems}
								challengeLabel={home_usecases_challenge_label({}, lc)}
								solutionLabel={home_usecases_solution_label({}, lc)}
								casePrefix={home_usecases_case_prefix({}, lc)}
								challengeShort={home_usecases_challenge_short({}, lc)}
								solutionShort={home_usecases_solution_short({}, lc)}
								prevLabel={home_usecases_prev({}, lc)}
								nextLabel={home_usecases_next({}, lc)}
							/>
						</motion.div>
					</div>
				</section>

				{/* ===== Features ===== */}
				<section id="features" className="relative overflow-hidden py-20">
					{/* Dot grid */}
					<div
						className="absolute inset-0 pointer-events-none"
						style={{
							backgroundImage:
								'radial-gradient(circle, var(--color-border) 1px, transparent 1px)',
							backgroundSize: '28px 28px',
							opacity: 0.4,
						}}
					/>
					{/* Fade top & bottom into background */}
					<div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-background to-transparent pointer-events-none" />
					<div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background to-transparent pointer-events-none" />
					{/* Center glow */}
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[640px] rounded-full bg-primary/[0.04] blur-3xl pointer-events-none" />
					<div className="relative z-10 px-6 max-w-6xl mx-auto space-y-12">
						<motion.div {...fadeUp} className="text-center">
							<h2 className="text-3xl sm:text-4xl font-bold text-foreground">
								{home_features_title({}, lc)}
							</h2>
						</motion.div>
						<motion.div {...fadeUp}>
							<FeaturesBento items={featureItems} />
						</motion.div>
					</div>
				</section>

				{/* ===== Why Choose Nexata / Testimonials ===== */}
				<section className="relative overflow-hidden px-6 py-20 bg-gradient-to-b from-muted/40 to-background">
					{/* Subtle color overlay */}
					<div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-accent/[0.03] pointer-events-none" />
					{/* Concentric rings */}
					<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[820px] h-[820px] rounded-full border border-border/40 pointer-events-none" />
					<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-border/25 pointer-events-none" />
					<div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full border border-border/15 pointer-events-none" />
					<div className="relative z-10 max-w-6xl mx-auto space-y-12">
						<motion.h2
							{...fadeUp}
							className="text-3xl sm:text-4xl font-bold text-foreground text-center"
						>
							{home_why_title({}, lc)}
						</motion.h2>
						<motion.div {...fadeUp}>
							<TestimonialsShowcase testimonials={testimonials} />
						</motion.div>
					</div>
				</section>

				{/* ===== Final CTA ===== */}
				<section className="relative overflow-hidden px-6 py-24 text-center bg-gradient-to-b from-primary/10 via-primary/5 to-background">
					{/* Dot grid */}
					<div
						className="absolute inset-0 pointer-events-none"
						style={{
							backgroundImage:
								'radial-gradient(circle, var(--color-border) 1px, transparent 1px)',
							backgroundSize: '28px 28px',
							opacity: 0.5,
						}}
					/>
					{/* Central glow */}
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.08] blur-3xl pointer-events-none" />
					<div className="absolute -top-24 right-1/4 w-[280px] h-[280px] rounded-full bg-accent/[0.06] blur-3xl pointer-events-none" />
					{/* Top accent line */}
					<div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-2/3 max-w-xs bg-gradient-to-r from-transparent via-primary/50 to-transparent pointer-events-none" />
					<motion.div
						{...fadeUp}
						className="relative z-10 max-w-2xl mx-auto space-y-6"
					>
						<h2 className="text-3xl sm:text-4xl font-bold text-foreground">
							{home_cta_title({}, lc)}
						</h2>
						<p className="text-muted-foreground text-lg">
							{home_cta_subtitle({}, lc)}
						</p>
						<div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
							<Button
								size="lg"
								className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
								onClick={() => setRegisterOpen(true)}
							>
								<Rocket className="w-4 h-4" />
								{home_cta_start({}, lc)}
								<ArrowRight className="w-4 h-4" />
							</Button>
							<Button
								size="lg"
								variant="outline"
								onClick={() => scrollToSection('nexy')}
							>
								{home_cta_demo({}, lc)}
							</Button>
						</div>
					</motion.div>
				</section>

				{/* ===== Footer ===== */}
				<Footer language={language} />
			</main>

			{/* -------------------- Registration Modal -------------------- */}
			<RegisterTenantModal
				open={registerOpen}
				onOpenChange={setRegisterOpen}
				language={language}
			/>
		</div>
	);
}

// -------------------------------- SOURCES MARQUEE --------------------------------

function SourceIcon({
	source,
}: {
	source: { id: string; name: string; icon: string };
}) {
	return (
		<motion.div
			className="flex flex-col items-center mx-5 sm:mx-8 w-14 sm:w-16 shrink-0 cursor-default"
			whileHover="hovered"
			initial="idle"
		>
			{/* Icon with glow */}
			<div className="relative flex items-center justify-center">
				<motion.div
					variants={{
						idle: { opacity: 0, scale: 0.6 },
						hovered: { opacity: 1, scale: 1.4 },
					}}
					transition={{ duration: 0.2 }}
					className="absolute w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/25 blur-lg pointer-events-none"
				/>
				<motion.img
					src={source.icon}
					alt={source.name}
					variants={{
						idle: { scale: 1, y: 0 },
						hovered: { scale: 1.2, y: -4 },
					}}
					transition={{ duration: 0.2, ease: 'easeOut' }}
					className="relative w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-lg z-10"
				/>
			</div>
			{/* Name */}
			<motion.span
				variants={{
					idle: { opacity: 0.55 },
					hovered: { opacity: 1 },
				}}
				transition={{ duration: 0.15 }}
				className="text-xs text-foreground mt-2 font-semibold leading-tight text-center"
			>
				{source.name}
			</motion.span>
		</motion.div>
	);
}

function SourcesMarquee({
	sources,
}: {
	sources: { id: string; name: string; icon: string }[];
}) {
	const trackRef = useRef<HTMLDivElement>(null);
	const xVal = useMotionValue(0);
	const isPausedRef = useRef(false);
	const singleWidthRef = useRef(0);

	// Measure one set's actual pixel width after mount
	useEffect(() => {
		const measure = () => {
			if (trackRef.current) {
				const w = trackRef.current.scrollWidth / 2;
				if (w > 0) singleWidthRef.current = w;
			}
		};
		measure();
		const t = setTimeout(measure, 120);
		return () => clearTimeout(t);
	}, []);

	// Frame-by-frame drive — no CSS keyframes, no reset on re-render
	useAnimationFrame((_, delta) => {
		if (isPausedRef.current || singleWidthRef.current === 0) return;
		const SPEED = 50; // px/s
		const move = (SPEED * Math.min(delta, 100)) / 1000; // cap delta to avoid tab-switch jumps
		let next = xVal.get() - move;
		if (next <= -singleWidthRef.current) next += singleWidthRef.current;
		xVal.set(next);
	});

	return (
		<div
			className="relative w-full overflow-hidden py-4"
			onMouseEnter={() => {
				isPausedRef.current = true;
			}}
			onMouseLeave={() => {
				isPausedRef.current = false;
			}}
		>
			<div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
			<div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
			<motion.div
				ref={trackRef}
				className="flex"
				style={{ x: xVal, width: 'max-content' }}
			>
				{[...sources, ...sources].map((source, i) => (
					<SourceIcon key={`${source.id}-${i}`} source={source} />
				))}
			</motion.div>
		</div>
	);
}

function IntroStepper({ steps }: { steps: { title: string; desc: string }[] }) {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: '-100px' });
	const [active, setActive] = useState(-1);

	useEffect(() => {
		if (!isInView) return;
		steps.forEach((_, i) => {
			setTimeout(() => setActive(i), i * 400);
		});
	}, [isInView, steps]);

	return (
		<div ref={ref} className="relative">
			{/* Línea de fondo */}
			<div className="absolute top-5 left-[calc(12.5%+16px)] right-[calc(12.5%+16px)] h-px bg-border" />

			{/* Línea de progreso animada */}
			<motion.div
				className="absolute top-5 left-[calc(12.5%+16px)] h-px bg-primary origin-left"
				initial={{ scaleX: 0 }}
				animate={{ scaleX: isInView ? 1 : 0 }}
				transition={{ duration: 1.4, delay: 0.2, ease: 'easeInOut' }}
				style={{ right: 'calc(12.5% + 16px)' }}
			/>

			{/* Steps */}
			<div className="grid grid-cols-4 gap-4">
				{steps.map((step, i) => {
					const done = active >= i;
					return (
						<motion.div
							key={step.title}
							initial={{ opacity: 0, y: 16 }}
							animate={done ? { opacity: 1, y: 0 } : {}}
							transition={{ duration: 0.4, ease: 'easeOut' }}
							className="flex flex-col items-center text-center gap-3"
						>
							{/* Círculo */}
							<motion.span
								animate={
									done
										? {
												backgroundColor: 'hsl(var(--primary))',
												color: 'hsl(var(--primary-foreground))',
												scale: 1.1,
											}
										: {
												backgroundColor: 'hsl(var(--muted))',
												color: 'hsl(var(--muted-foreground))',
												scale: 1,
											}
								}
								transition={{ duration: 0.3 }}
								className="flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold shadow-sm z-10 relative"
							>
								{i + 1}
							</motion.span>

							<div>
								<h3
									className={`text-sm font-semibold transition-colors duration-300 ${
										done ? 'text-foreground' : 'text-muted-foreground'
									}`}
								>
									{step.title}
								</h3>
								<p
									className={`text-xs mt-1 leading-relaxed transition-colors duration-300 ${
										done ? 'text-muted-foreground' : 'text-muted-foreground/40'
									}`}
								>
									{step.desc}
								</p>
							</div>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}

type ChatMsg =
	| { kind: 'user'; text: string }
	| { kind: 'tool'; icon: string; label: string; detail: string }
	| { kind: 'assistant'; text: string }
	| { kind: 'assistant-list'; intro: string; items: string[] };

type ChatDemo = { messages: ChatMsg[] };

const NEXY_CHAT_DEMOS: ChatDemo[] = [
	{
		// 1 user → 1 tool → 1 assistant
		messages: [
			{
				kind: 'user',
				text: 'Donde esta el contrato con el cliente Acme de enero?',
			},
			{
				kind: 'tool',
				icon: '/datasource_icons/gdrive.png',
				label: 'Contrato_Acme_v3.pdf',
				detail: 'Google Drive · Clientes / Acme · modificado 14 ene',
			},
			{
				kind: 'assistant',
				text: 'Encontré 2 versiones del contrato Acme. La más reciente es Contrato_Acme_v3.pdf, en Drive > Clientes > Acme. ¿Querés ver el historial de cambios?',
			},
		],
	},
	{
		// 1 user → 2 tools → 1 assistant
		messages: [
			{
				kind: 'user',
				text: 'Que se habló sobre el presupuesto del proyecto Alpha?',
			},
			{
				kind: 'tool',
				icon: '/datasource_icons/gmail.png',
				label: '3 emails encontrados',
				detail: 'Gmail · hilo con Paula · 3 mar',
			},
			{
				kind: 'tool',
				icon: '/datasource_icons/gdrive.png',
				label: 'budget_alpha_final.xlsx',
				detail: 'Google Drive · adjunto del hilo',
			},
			{
				kind: 'assistant',
				text: 'En el hilo con Paula del 3 mar se acordó un presupuesto de $42.000. El archivo adjunto tiene el desglose por área. También hay una nota en Calendar del 5 mar.',
			},
		],
	},
	{
		// multi-turn: user → tool → assistant → user → tool → assistant
		messages: [
			{
				kind: 'user',
				text: 'Cuando es la proxima reunion con el equipo de diseño?',
			},
			{
				kind: 'tool',
				icon: '/datasource_icons/gcalendar.png',
				label: 'Sync Diseño Q2',
				detail: 'Google Calendar · mañana 10:00 AM · 1 hora',
			},
			{
				kind: 'assistant',
				text: 'Mañana a las 10:00 AM con Marcos, Sofía y Laura. Dura 1 hora.',
			},
			{ kind: 'user', text: 'Hay agenda preparada?' },
			{
				kind: 'tool',
				icon: '/datasource_icons/gdrive.png',
				label: 'Agenda_Sync_Q2.docx',
				detail: 'Google Drive · vinculado al evento',
			},
			{
				kind: 'assistant',
				text: 'Sí, encontré la agenda. Incluye revisión de mockups, feedback Q1, roadmap Q2 y notas de la reunión anterior.',
			},
		],
	},
	{
		// 1 user → 1 tool → assistant con lista
		messages: [
			{ kind: 'user', text: 'Como proceso una factura de proveedor nuevo?' },
			{
				kind: 'tool',
				icon: '/datasource_icons/gdrive.png',
				label: 'Proceso_Facturas_v2.pdf',
				detail: 'Google Drive · Finanzas · actualizado hace 2 semanas',
			},
			{
				kind: 'assistant-list',
				intro: 'El proceso tiene 4 pasos:',
				items: [
					'Solicitar los datos fiscales al proveedor',
					'Dar de alta en el sistema ERP con código único',
					'Enviar la factura a Finanzas para validación',
					'Confirmar recepción y registrar la fecha de pago',
				],
			},
		],
	},
	{
		// 1 user → 2 tools → 1 assistant (resumen)
		messages: [
			{ kind: 'user', text: 'Resumi el informe trimestral Q1 2024' },
			{
				kind: 'tool',
				icon: '/datasource_icons/gdrive.png',
				label: 'Informe_Q1_2024.pdf',
				detail: 'Google Drive · 24 páginas analizadas',
			},
			{
				kind: 'tool',
				icon: '/datasource_icons/gdrive.png',
				label: 'Presentacion_Q1_Board.pptx',
				detail: 'Google Drive · 18 slides procesadas',
			},
			{
				kind: 'assistant',
				text: 'El Q1 2024 muestra un crecimiento del 18% en ingresos. Hitos clave: expansión LATAM (+3 países), lanzamiento del producto B y reducción del 12% en costos operativos.',
			},
		],
	},
];

const NEXY_CHAT_DEMOS_EN: ChatDemo[] = [
	{
		messages: [
			{ kind: 'user', text: 'Where is the Acme client contract from January?' },
			{
				kind: 'tool',
				icon: '/datasource_icons/gdrive.png',
				label: 'Contract_Acme_v3.pdf',
				detail: 'Google Drive · Clients / Acme · modified Jan 14',
			},
			{
				kind: 'assistant',
				text: 'I found 2 versions of the Acme contract. The most recent is Contract_Acme_v3.pdf, in Drive > Clients > Acme. Would you like to see the change history?',
			},
		],
	},
	{
		messages: [
			{
				kind: 'user',
				text: 'What was discussed about the Alpha project budget?',
			},
			{
				kind: 'tool',
				icon: '/datasource_icons/gmail.png',
				label: '3 emails found',
				detail: 'Gmail · thread with Paula · Mar 3',
			},
			{
				kind: 'tool',
				icon: '/datasource_icons/gdrive.png',
				label: 'budget_alpha_final.xlsx',
				detail: 'Google Drive · email attachment',
			},
			{
				kind: 'assistant',
				text: "In Paula's thread from Mar 3, a $42,000 budget was agreed. The attached file has the full breakdown by area. There's also a Calendar note from Mar 5.",
			},
		],
	},
	{
		messages: [
			{ kind: 'user', text: 'When is the next meeting with the design team?' },
			{
				kind: 'tool',
				icon: '/datasource_icons/gcalendar.png',
				label: 'Design Sync Q2',
				detail: 'Google Calendar · tomorrow 10:00 AM · 1 hour',
			},
			{
				kind: 'assistant',
				text: 'Tomorrow at 10:00 AM with Marcos, Sofia and Laura. It lasts 1 hour.',
			},
			{ kind: 'user', text: 'Is there a prepared agenda?' },
			{
				kind: 'tool',
				icon: '/datasource_icons/gdrive.png',
				label: 'Agenda_Sync_Q2.docx',
				detail: 'Google Drive · linked to the event',
			},
			{
				kind: 'assistant',
				text: 'Yes, I found the agenda doc. It covers mockup review, Q1 feedback, Q2 roadmap and notes from the previous meeting.',
			},
		],
	},
	{
		messages: [
			{ kind: 'user', text: 'How do I process a new vendor invoice?' },
			{
				kind: 'tool',
				icon: '/datasource_icons/gdrive.png',
				label: 'Invoice_Process_v2.pdf',
				detail: 'Google Drive · Finance · updated 2 weeks ago',
			},
			{
				kind: 'assistant-list',
				intro: 'The process has 4 steps:',
				items: [
					'Request fiscal data from the vendor',
					'Register in the ERP with a unique code',
					'Send invoice to Finance for validation',
					'Confirm receipt and record the payment date',
				],
			},
		],
	},
	{
		messages: [
			{ kind: 'user', text: 'Summarize the Q1 2024 quarterly report' },
			{
				kind: 'tool',
				icon: '/datasource_icons/gdrive.png',
				label: 'Report_Q1_2024.pdf',
				detail: 'Google Drive · 24 pages analyzed',
			},
			{
				kind: 'tool',
				icon: '/datasource_icons/gdrive.png',
				label: 'Presentation_Q1_Board.pptx',
				detail: 'Google Drive · 18 slides processed',
			},
			{
				kind: 'assistant',
				text: 'Q1 2024 shows 18% revenue growth. Key highlights: LATAM expansion (+3 countries), product B launch, and a 12% reduction in operational costs.',
			},
		],
	},
];

function NexyShowcase({
	features,
	onlineLabel,
	askPlaceholder,
	language,
}: {
	features: { icon: typeof Search; title: string; desc: string }[];
	onlineLabel: string;
	askPlaceholder: string;
	language: Language;
}) {
	const [active, setActive] = useState(0);
	const demos = language === 'en' ? NEXY_CHAT_DEMOS_EN : NEXY_CHAT_DEMOS;

	return (
		<div className="grid lg:grid-cols-2 gap-6 items-start">
			{/* Columna izquierda: lista de features */}
			<div className="flex flex-col gap-2">
				{features.map((feat, i) => {
					const Icon = feat.icon;
					const isActive = active === i;
					return (
						<button
							key={feat.title}
							onClick={() => setActive(i)}
							className={`w-full text-left flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer
                ${
									isActive
										? 'border-primary/30 bg-primary/5'
										: 'border-transparent hover:border-border hover:bg-foreground/[0.02]'
								}`}
						>
							<div
								className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors duration-200
                  ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
							>
								<Icon className="w-4 h-4" />
							</div>
							<div>
								<p
									className={`text-sm font-semibold transition-colors duration-200 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}
								>
									{feat.title}
								</p>
								<p
									className={`text-xs mt-0.5 leading-relaxed transition-colors duration-200 ${isActive ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}
								>
									{feat.desc}
								</p>
							</div>
						</button>
					);
				})}
			</div>

			{/* Columna derecha: chat mock */}
			<div className="lg:sticky lg:top-24">
				<AnimatePresence mode="wait">
					<motion.div
						key={active}
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -12 }}
						transition={{ duration: 0.25, ease: 'easeOut' }}
						className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col"
						style={{ height: 460 }}
					>
						{/* Header */}
						<div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
							<img
								src="/nexata_logo.png"
								alt="Nexy"
								className="w-6 h-6 object-contain"
							/>
							<span className="text-sm font-semibold text-foreground">
								Nexy
							</span>
							<span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
								<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
								{onlineLabel}
							</span>
						</div>

						{/* Messages */}
						<div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5">
							{demos[active].messages.map((msg, idx) => {
								const delay = idx * 0.12;
								if (msg.kind === 'user') {
									return (
										<div key={idx} className="flex justify-end">
											<motion.div
												initial={{ opacity: 0, y: 6 }}
												animate={{ opacity: 1, y: 0 }}
												transition={{ duration: 0.22, delay, ease: 'easeOut' }}
												className="break-words rounded-2xl rounded-tr-sm px-3 py-2 text-sm max-w-[82%] bg-muted text-foreground"
											>
												{msg.text}
											</motion.div>
										</div>
									);
								}
								if (msg.kind === 'tool') {
									return (
										<motion.div
											key={idx}
											initial={{ opacity: 0, y: 6 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.22, delay, ease: 'easeOut' }}
											className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5"
										>
											<div className="flex items-center gap-2.5">
												<img
													src={msg.icon}
													alt="source"
													className="h-4 w-4 shrink-0 object-contain"
												/>
												<div className="flex-1 min-w-0">
													<p className="text-xs font-semibold text-foreground truncate">
														{msg.label}
													</p>
													<p className="text-[10px] text-muted-foreground leading-tight">
														{msg.detail}
													</p>
												</div>
												<Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
											</div>
										</motion.div>
									);
								}
								if (msg.kind === 'assistant') {
									return (
										<motion.div
											key={idx}
											initial={{ opacity: 0, y: 6 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.22, delay, ease: 'easeOut' }}
											className="max-w-[85%] px-1 py-0.5 text-sm text-foreground leading-relaxed"
										>
											{msg.text}
										</motion.div>
									);
								}
								if (msg.kind === 'assistant-list') {
									return (
										<motion.div
											key={idx}
											initial={{ opacity: 0, y: 6 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ duration: 0.22, delay, ease: 'easeOut' }}
											className="max-w-[88%] space-y-1.5 px-1 py-0.5"
										>
											<p className="text-sm text-foreground">{msg.intro}</p>
											<ul className="space-y-1">
												{msg.items.map((item, j) => (
													<li
														key={j}
														className="flex items-start gap-2 text-sm text-muted-foreground"
													>
														<span className="text-primary font-bold shrink-0 leading-5">
															{j + 1}.
														</span>
														{item}
													</li>
												))}
											</ul>
										</motion.div>
									);
								}
								return null;
							})}
						</div>

						{/* Input — réplica exacta MessageInput compacto */}
						<div className="px-4 pb-4 shrink-0">
							<div
								className="relative w-full border bg-muted shadow-sm px-2 py-2 flex items-center gap-2"
								style={{ borderRadius: 999 }}
							>
								{/* Brain icon — mismo que MessageInput */}
								<div className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground shrink-0">
									<Brain className="h-5 w-5" />
								</div>

								{/* Placeholder */}
								<span className="flex-1 text-sm text-muted-foreground/50 select-none leading-5 py-2">
									{askPlaceholder}
								</span>

								{/* Paperclip + ArrowUp — mismo que MessageInput */}
								<div className="flex items-center gap-1">
									<div className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground">
										<Paperclip className="h-5 w-5" />
									</div>
									<div className="h-8 w-8 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 opacity-40">
										<ArrowUp className="h-5 w-5" />
									</div>
								</div>
							</div>
						</div>
					</motion.div>
				</AnimatePresence>
			</div>
		</div>
	);
}

// -------------------------------- USE CASES --------------------------------

const USE_CASE_ICONS_MAP = [Search, Mail, FileText, Calendar, ClipboardList];

function UseCasesInteractive({
	items,
	challengeLabel,
	solutionLabel,
	casePrefix,
	challengeShort,
	solutionShort,
	prevLabel,
	nextLabel,
}: {
	items: { title: string; problem: string; solution: string }[];
	challengeLabel: string;
	solutionLabel: string;
	casePrefix: string;
	challengeShort: string;
	solutionShort: string;
	prevLabel: string;
	nextLabel: string;
}) {
	const [active, setActive] = useState(0);

	return (
		<div className="space-y-8">
			{/* ===== DESKTOP ===== */}
			<div className="hidden lg:flex lg:flex-col gap-10">
				{/* — Horizontal process-flow navigator — */}
				<div className="relative flex items-start justify-between">
					{/* Track: background line */}
					<div className="absolute top-6 left-[5%] right-[5%] h-px bg-border pointer-events-none" />
					{/* Track: progress line */}
					<motion.div
						className="absolute top-6 left-[5%] h-px bg-primary pointer-events-none origin-left"
						style={{ right: '5%' }}
						animate={{ scaleX: active / Math.max(items.length - 1, 1) }}
						transition={{ duration: 0.5, ease: 'easeInOut' }}
					/>

					{items.map((uc, i) => {
						const Icon = USE_CASE_ICONS_MAP[i];
						const isActive = active === i;
						const isPast = active > i;
						return (
							<button
								key={uc.title}
								type="button"
								onClick={() => setActive(i)}
								className="relative z-10 flex flex-col items-center gap-2.5 group cursor-pointer flex-1"
							>
								{/* Solid bg-background cover keeps the track line hidden behind the icon */}
								<div className="relative flex items-center justify-center">
									<div className="absolute w-[52px] h-[52px] bg-background rounded-2xl pointer-events-none" />
									<motion.div
										animate={isActive ? { scale: 1.12 } : { scale: 1 }}
										transition={{ duration: 0.2 }}
										className={`relative w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-200 ${
											isActive
												? 'border-primary bg-primary text-primary-foreground shadow-[0_0_0_5px_hsl(var(--primary)/0.12)]'
												: isPast
													? 'border-primary/50 bg-primary/10 text-primary'
													: 'border-border bg-background text-muted-foreground group-hover:border-primary/30 group-hover:text-foreground'
										}`}
									>
										{isPast ? (
											<Check className="w-4 h-4" />
										) : (
											<Icon className="w-4 h-4" />
										)}
									</motion.div>
								</div>
								<span
									className={`text-[11px] font-medium text-center leading-tight max-w-[88px] transition-colors duration-200 ${
										isActive
											? 'text-foreground font-semibold'
											: 'text-muted-foreground group-hover:text-foreground'
									}`}
								>
									{uc.title}
								</span>
							</button>
						);
					})}
				</div>

				{/* — Detail card: split Challenge / Solution — */}
				<AnimatePresence mode="wait">
					<motion.div
						key={active}
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -16 }}
						transition={{ duration: 0.28, ease: 'easeOut' }}
						className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm"
					>
						{/* Card header */}
						<div className="flex items-center gap-4 px-8 py-5 border-b border-border bg-muted/20">
							{(() => {
								const Icon = USE_CASE_ICONS_MAP[active];
								return (
									<div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
										<Icon className="w-5 h-5 text-primary" />
									</div>
								);
							})()}
							<div>
								<p className="text-[11px] font-bold text-primary/60 uppercase tracking-widest">
									{casePrefix} {String(active + 1).padStart(2, '0')} /{' '}
									{items.length}
								</p>
								<h3 className="text-base font-semibold text-foreground leading-tight mt-0.5">
									{items[active].title}
								</h3>
							</div>
							{/* Dot navigation */}
							<div className="ml-auto flex items-center gap-2">
								{items.map((_, i) => (
									<button
										key={`dot-${i}`}
										type="button"
										onClick={() => setActive(i)}
										className={`rounded-full transition-all duration-300 ${
											active === i
												? 'w-5 h-2 bg-primary'
												: 'w-2 h-2 bg-border hover:bg-muted-foreground'
										}`}
									/>
								))}
							</div>
						</div>

						{/* Two-column body */}
						<div className="grid grid-cols-2 divide-x divide-border">
							{/* Challenge */}
							<div className="p-8">
								<div className="flex items-center gap-2.5 mb-5">
									<div className="w-6 h-6 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
										<span className="text-[11px] font-black text-destructive leading-none">
											!
										</span>
									</div>
									<span className="text-xs font-bold uppercase tracking-widest text-destructive/70">
										{challengeLabel}
									</span>
								</div>
								<p className="text-sm text-muted-foreground leading-relaxed">
									{items[active].problem}
								</p>
							</div>

							{/* Solution */}
							<div className="p-8 bg-primary/[0.025]">
								<div className="flex items-center gap-2.5 mb-5">
									<div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
										<Check className="w-3 h-3 text-primary" />
									</div>
									<span className="text-xs font-bold uppercase tracking-widest text-primary">
										{solutionLabel}
									</span>
								</div>
								<p className="text-sm text-foreground leading-relaxed">
									{items[active].solution}
								</p>
							</div>
						</div>
					</motion.div>
				</AnimatePresence>
			</div>

			{/* ===== MOBILE: single card with pill tabs + prev/next ===== */}
			<div className="lg:hidden space-y-4">
				{/* Numbered pill tabs */}
				<div className="flex gap-2 justify-center flex-wrap">
					{items.map((_uc, i) => {
						const isActive = active === i;
						const isPast = active > i;
						return (
							<button
								key={`tab-${i}`}
								type="button"
								onClick={() => setActive(i)}
								className={`flex items-center justify-center w-9 h-9 rounded-full border text-xs font-bold transition-all duration-200 ${
									isActive
										? 'border-primary bg-primary text-primary-foreground shadow-sm'
										: isPast
											? 'border-primary/40 bg-primary/5 text-primary/70'
											: 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
								}`}
							>
								{isPast ? (
									<Check className="w-3.5 h-3.5" />
								) : (
									String(i + 1).padStart(2, '0')
								)}
							</button>
						);
					})}
				</div>

				{/* Single animated card */}
				<AnimatePresence mode="wait">
					<motion.div
						key={active}
						initial={{ opacity: 0, x: 16 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -16 }}
						transition={{ duration: 0.22, ease: 'easeOut' }}
						className="rounded-2xl border border-border bg-card overflow-hidden"
					>
						{/* Card header */}
						{(() => {
							const Icon = USE_CASE_ICONS_MAP[active];
							return (
								<div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b border-border">
									<div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
										<Icon className="w-3.5 h-3.5 text-primary" />
									</div>
									<h3 className="text-sm font-semibold text-foreground flex-1 leading-tight">
										{items[active].title}
									</h3>
								</div>
							);
						})()}

						<div className="p-4 space-y-2">
							{/* Challenge */}
							<div className="rounded-xl bg-destructive/5 border border-destructive/10 p-3">
								<div className="flex items-center gap-1.5 mb-2">
									<div className="w-4 h-4 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
										<span className="text-[9px] font-black text-destructive">
											!
										</span>
									</div>
									<span className="text-[10px] font-bold uppercase tracking-widest text-destructive/70">
										{challengeShort}
									</span>
								</div>
								<p className="text-sm text-muted-foreground leading-relaxed">
									{items[active].problem}
								</p>
							</div>

							{/* Arrow connector */}
							<div className="flex justify-center py-0.5">
								<ArrowRight className="w-3.5 h-3.5 text-border rotate-90" />
							</div>

							{/* Solution */}
							<div className="rounded-xl bg-primary/5 border border-primary/15 p-3">
								<div className="flex items-center gap-1.5 mb-2">
									<div className="w-4 h-4 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
										<Check className="w-2.5 h-2.5 text-primary" />
									</div>
									<span className="text-[10px] font-bold uppercase tracking-widest text-primary">
										{solutionShort}
									</span>
								</div>
								<p className="text-sm text-foreground leading-relaxed">
									{items[active].solution}
								</p>
							</div>
						</div>
					</motion.div>
				</AnimatePresence>

				{/* Prev / Next */}
				<div className="flex items-center justify-between px-1">
					<Button
						variant="outline"
						size="sm"
						disabled={active === 0}
						onClick={() => setActive((p) => Math.max(0, p - 1))}
						className="gap-1.5 text-xs"
					>
						<ArrowRight className="w-3.5 h-3.5 rotate-180" />
						{prevLabel}
					</Button>
					<span className="text-xs text-muted-foreground font-mono tabular-nums">
						{active + 1} / {items.length}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={active === items.length - 1}
						onClick={() => setActive((p) => Math.min(items.length - 1, p + 1))}
						className="gap-1.5 text-xs"
					>
						{nextLabel}
						<ArrowRight className="w-3.5 h-3.5" />
					</Button>
				</div>
			</div>
		</div>
	);
}

// -------------------------------- FEATURES BENTO --------------------------------

function FeaturesBento({
	items,
}: {
	items: { icon: typeof Search; title: string; desc: string }[];
}) {
	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			{items.map((feat, i) => {
				const Icon = feat.icon;
				return (
					<motion.div
						key={feat.title}
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.4, delay: i * 0.07, ease: 'easeOut' }}
						whileHover={{ y: -4, transition: { duration: 0.2 } }}
						className="group"
					>
						<Card className="relative h-full p-6 border border-border hover:border-primary/30 transition-all duration-300 overflow-hidden bg-card hover:shadow-lg">
							{/* Decorative number */}
							<span className="absolute top-4 right-4 text-6xl font-black text-foreground/[0.04] leading-none select-none pointer-events-none">
								{String(i + 1).padStart(2, '0')}
							</span>

							{/* Hover glow */}
							<div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

							{/* Icon */}
							<div className="relative w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
								<Icon className="w-5 h-5 text-primary" />
							</div>

							{/* Content */}
							<div className="relative">
								<h3 className="text-base font-semibold text-foreground mb-2">
									{feat.title}
								</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">
									{feat.desc}
								</p>
							</div>
						</Card>
					</motion.div>
				);
			})}
		</div>
	);
}

// -------------------------------- TESTIMONIALS --------------------------------

function TestimonialsShowcase({
	testimonials,
}: {
	testimonials: { role: string; quote: string }[];
}) {
	const [active, setActive] = useState(0);

	useEffect(() => {
		const timer = setInterval(() => {
			setActive((prev) => (prev + 1) % testimonials.length);
		}, 4500);
		return () => clearInterval(timer);
	}, [testimonials.length]);

	return (
		<div className="space-y-6">
			{/* Desktop: 3 cards, center elevated */}
			<div className="hidden lg:grid lg:grid-cols-3 gap-6 items-center">
				{testimonials.map((t, i) => {
					const isCenter = i === 1;
					return (
						<motion.div
							key={t.role}
							initial={{ opacity: 0, y: 24 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5, delay: i * 0.12 }}
							className={`relative rounded-2xl border p-6 flex flex-col gap-4 overflow-hidden transition-all duration-300 ${
								isCenter
									? 'border-primary/40 bg-gradient-to-b from-primary/5 to-card shadow-xl scale-[1.04] z-10'
									: 'border-border bg-card hover:border-primary/20 hover:shadow-md'
							}`}
						>
							<Quote className="w-9 h-9 text-primary/20 shrink-0" />
							<p className="text-sm text-foreground leading-relaxed italic flex-1">
								{t.quote}
							</p>
							<div className="flex items-center gap-3 pt-3 border-t border-border">
								<div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
									<span className="text-sm font-bold text-primary">
										{t.role.charAt(0)}
									</span>
								</div>
								<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
									{t.role}
								</p>
							</div>
						</motion.div>
					);
				})}
			</div>

			{/* Mobile/Tablet: auto-carousel */}
			<div className="lg:hidden">
				<AnimatePresence mode="wait">
					<motion.div
						key={active}
						initial={{ opacity: 0, x: 24 }}
						animate={{ opacity: 1, x: 0 }}
						exit={{ opacity: 0, x: -24 }}
						transition={{ duration: 0.3, ease: 'easeOut' }}
						className="rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/5 to-card p-6 flex flex-col gap-4 overflow-hidden"
					>
						<Quote className="w-8 h-8 text-primary/20 shrink-0" />
						<p className="text-sm text-foreground leading-relaxed italic">
							{testimonials[active].quote}
						</p>
						<div className="flex items-center gap-3 pt-3 border-t border-border">
							<div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
								<span className="text-sm font-bold text-primary">
									{testimonials[active].role.charAt(0)}
								</span>
							</div>
							<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								{testimonials[active].role}
							</p>
						</div>
					</motion.div>
				</AnimatePresence>
				{/* Navigation dots */}
				<div className="flex justify-center gap-2 mt-4">
					{testimonials.map((_, i) => (
						<button
							key={`dot-${i}`}
							type="button"
							onClick={() => setActive(i)}
							className={`transition-all duration-300 rounded-full ${
								active === i
									? 'w-6 h-2 bg-primary'
									: 'w-2 h-2 bg-border hover:bg-muted-foreground'
							}`}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
