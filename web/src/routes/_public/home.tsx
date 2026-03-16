import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import {
	ArrowRight,
	Calendar,
	ClipboardList,
	FileText,
	Link,
	Lock,
	LogIn,
	Mail,
	Menu,
	MessageCircle,
	MessageSquare,
	Quote,
	Rocket,
	Search,
	X,
	Zap,
} from 'lucide-react';
import { useState } from 'react';
import { IoMoon, IoSunny } from 'react-icons/io5';
import RegisterTenantModal from '@/components/register-tenant/register-tenant.modal';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from '@/components/ui/select';
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip';
import { LANGUAGE_OPTIONS } from '@/hooks/use-sync-language';
import {
	DINAMIC_DATA_SOURCES,
	STORAGE_DATA_SOURCES,
} from '@/lib/available-sources';
import type { Language } from '@/lib/user';

export const Route = createFileRoute('/_public/home')({
	component: Home,
});

// -------------------------------- CONTENT --------------------------------

type LangContent = {
	nav: { sections: { id: string; label: string }[] };
	hero: {
		title: string;
		tagline: string;
		subtitle: string;
		login: string;
		cta: string;
	};
	intro: {
		title: string;
		body: string;
		body2: string;
		steps: { title: string; desc: string }[];
	};
	sources: { title: string; subtitle: string };
	nexy: {
		title: string;
		subtitle: string;
		features: { icon: typeof Search; title: string; desc: string }[];
	};
	usecases: {
		title: string;
		items: { title: string; problem: string; solution: string }[];
	};
	features: {
		title: string;
		items: { icon: typeof Search; title: string; desc: string }[];
	};
	why: {
		title: string;
		testimonials: { role: string; quote: string }[];
	};
	cta: { title: string; subtitle: string; start: string; demo: string };
	footer: { tagline: string };
};

const CONTENT_ES: LangContent = {
	nav: {
		sections: [
			{ id: 'hero', label: 'Inicio' },
			{ id: 'intro', label: 'Plataforma' },
			{ id: 'nexy', label: 'Nexy' },
			{ id: 'usecases', label: 'Casos de uso' },
			{ id: 'features', label: 'Funciones' },
		],
	},
	hero: {
		title: 'Tu conocimiento empresarial, una pregunta de distancia',
		tagline: 'Potenciado por Nexy, tu asistente de conocimiento',
		subtitle:
			'Conecta. Busca. Encuentra. Un unico punto de acceso para todo el conocimiento de tu empresa, potenciado por inteligencia artificial.',
		login: 'Iniciar Sesion',
		cta: 'Empezar Gratis',
	},
	intro: {
		title: 'El nexo de tu conocimiento empresarial',
		body: 'Nexata es una plataforma de conocimiento empresarial disenada para resolver la fragmentacion de informacion que sufren las empresas modernas.',
		body2:
			'En lugar de saltar entre Google Drive, Gmail, Dropbox, calendarios y otros sistemas, Nexata unifica todos estos servicios en un unico buscador inteligente que entiende el contexto y devuelve respuestas precisas, no solo resultados.',
		steps: [
			{
				title: 'Conecta',
				desc: 'Vincula tus fuentes de trabajo (Google Workspace, Microsoft 365, Dropbox) en minutos.',
			},
			{
				title: 'Indexa',
				desc: 'La IA procesa y organiza automaticamente tus documentos, emails y eventos.',
			},
			{
				title: 'Busca con inteligencia',
				desc: "Hace preguntas naturales como 'Cuando enviamos el presupuesto al cliente X?'",
			},
			{
				title: 'Obtene respuestas',
				desc: 'Resultados instantaneos con contexto completo, citas exactas y enlaces directos.',
			},
		],
	},
	sources: {
		title: 'Fuentes de datos conectables',
		subtitle:
			'Conecta tus herramientas favoritas y empieza a unificar tu conocimiento empresarial en segundos.',
	},
	nexy: {
		title: 'Conoce a Nexy',
		subtitle:
			'El asistente inteligente que habla el idioma de tus datos. Mientras otras herramientas solo indexan archivos, Nexy comprende contexto, relaciones y significado.',
		features: [
			{
				icon: Search,
				title: 'Busqueda Semantica',
				desc: 'Encontra documentos por concepto, no solo por palabra clave exacta.',
			},
			{
				icon: Mail,
				title: 'Sintesis Multi-fuente',
				desc: 'Conecta informacion de correos, archivos y eventos en una respuesta unificada.',
			},
			{
				icon: Calendar,
				title: 'Contexto Temporal',
				desc: 'Consulta eventos, plazos y cronologias vinculadas a tu documentacion.',
			},
			{
				icon: MessageSquare,
				title: 'Conversacion Natural',
				desc: 'Hace preguntas en lenguaje cotidiano. Nexy interpreta intencion, no solo comandos.',
			},
			{
				icon: FileText,
				title: 'Lectura Asistida',
				desc: 'Solicita resumenes, extraccion de datos especificos o comparativas entre versiones.',
			},
		],
	},
	usecases: {
		title: 'Casos de uso',
		items: [
			{
				title: 'Busqueda Inteligente de Documentos',
				problem:
					'Un equipo de ventas necesita encontrar rapidamente el ultimo contrato modificado con un cliente especifico entre miles de archivos.',
				solution:
					"Busca: 'contrato cliente XYZ modificado en enero'. Obtene: El documento exacto con historial de versiones. De 20 minutos a 10 segundos.",
			},
			{
				title: 'Recuperacion de Contexto de Emails',
				problem:
					'Un gerente necesita recordar que se acordo en un email de hace 3 meses sobre un cambio de alcance.',
				solution:
					"Busca: 'cambio alcance proyecto dashboard febrero'. Obtene: El email especifico con el hilo completo y attachments.",
			},
			{
				title: 'Gestion de Conocimiento Onboarding',
				problem:
					'Un nuevo empleado necesita aprender procesos y documentacion sin molestar al equipo.',
				solution:
					"Pregunta: 'Como proceso facturas de proveedores?' Obtene: Guias, procedimientos y referencias. Autonomia desde el dia 1.",
			},
			{
				title: 'Integracion de Calendario y Documentos',
				problem:
					'Prepararse para una reunion requiere buscar manualmente emails, documentos y notas.',
				solution:
					"Busca: 'preparacion reunion cliente ABC de manana'. Obtene: Documentos relevantes, emails y notas previas.",
			},
			{
				title: 'Compliance y Auditoria',
				problem:
					'Se necesita encontrar documentacion de auditoria o cumplimiento rapidamente.',
				solution:
					"Busca: 'documentos fiscales 2024 o contratos con clausula NDA'. Obtene: Listado completo con filtros avanzados.",
			},
		],
	},
	features: {
		title: 'Caracteristicas principales',
		items: [
			{
				icon: Search,
				title: 'Busqueda Semantica',
				desc: 'Entiende consultas en lenguaje natural, no solo palabras clave exactas.',
			},
			{
				icon: Link,
				title: 'Conectores Multiples',
				desc: 'Google Drive, Gmail, Google Calendar, Dropbox, Microsoft 365.',
			},
			{
				icon: Zap,
				title: 'Respuestas Instantaneas',
				desc: 'Resultados en segundos, no minutos de navegacion por carpetas.',
			},
			{
				icon: ClipboardList,
				title: 'Contexto Completo',
				desc: 'Cada resultado incluye metadatos, fechas, participantes y enlaces directos.',
			},
			{
				icon: Lock,
				title: 'Seguridad Empresarial',
				desc: 'Acceso controlado por permisos y scopes especificos por usuario.',
			},
			{
				icon: MessageCircle,
				title: 'Asistente IA Integrado',
				desc: 'Nexy, tu asistente que conversa con tu conocimiento empresarial.',
			},
		],
	},
	why: {
		title: 'Por que elegir Nexata?',
		testimonials: [
			{
				role: 'Director de Operaciones',
				quote:
					'Antes de Nexy, buscar informacion era una expedicion. Ahora es una conversacion.',
			},
			{
				role: 'Legal Corporativo',
				quote:
					'Nexy conecto un mail de hace 8 meses con una presentacion actual que resolvio un conflicto contractual. Eso no lo hace una busqueda normal.',
			},
			{
				role: 'Manager de TI',
				quote:
					'Implementacion en minutos, no meses. Conectores nativos sin configuracion compleja. Control total de permisos.',
			},
		],
	},
	cta: {
		title: 'No es busqueda. Es inteligencia.',
		subtitle:
			'Descubri lo que tu empresa ya sabe. Conecta tu primera fuente gratis y empieza a encontrar la informacion que importa.',
		start: 'Empezar Gratis',
		demo: 'Solicitar Demo',
	},
	footer: {
		tagline: 'Tu conocimiento empresarial, unificado.',
	},
};

const CONTENT_EN: LangContent = {
	nav: {
		sections: [
			{ id: 'hero', label: 'Home' },
			{ id: 'intro', label: 'Platform' },
			{ id: 'nexy', label: 'Nexy' },
			{ id: 'usecases', label: 'Use Cases' },
			{ id: 'features', label: 'Features' },
		],
	},
	hero: {
		title: 'Your enterprise knowledge, one question away',
		tagline: 'Powered by Nexy, your knowledge assistant',
		subtitle:
			"Connect. Search. Find. A single access point for all your company's knowledge, powered by artificial intelligence.",
		login: 'Log In',
		cta: 'Start Free',
	},
	intro: {
		title: 'The nexus of your enterprise knowledge',
		body: 'Nexata is an enterprise knowledge platform designed to solve the information fragmentation that modern businesses suffer from.',
		body2:
			'Instead of jumping between Google Drive, Gmail, Dropbox, calendars, and other systems, Nexata unifies all these services into a single intelligent search engine that understands context and delivers precise answers — not just results.',
		steps: [
			{
				title: 'Connect',
				desc: 'Link your work sources (Google Workspace, Microsoft 365, Dropbox) in minutes.',
			},
			{
				title: 'Index',
				desc: 'AI automatically processes and organizes your documents, emails, and events.',
			},
			{
				title: 'Search intelligently',
				desc: "Ask natural questions like 'When did we send the budget to client X?'",
			},
			{
				title: 'Get answers',
				desc: 'Instant results with full context, exact citations, and direct links.',
			},
		],
	},
	sources: {
		title: 'Connectable data sources',
		subtitle:
			'Connect your favorite tools and start unifying your enterprise knowledge in seconds.',
	},
	nexy: {
		title: 'Meet Nexy',
		subtitle:
			'The intelligent assistant that speaks the language of your data. While other tools only index files, Nexy understands context, relationships, and meaning.',
		features: [
			{
				icon: Search,
				title: 'Semantic Search',
				desc: 'Find documents by concept, not just exact keywords.',
			},
			{
				icon: Mail,
				title: 'Multi-source Synthesis',
				desc: 'Connect information from emails, files, and events into a unified answer.',
			},
			{
				icon: Calendar,
				title: 'Temporal Context',
				desc: 'Query events, deadlines, and timelines linked to your documentation.',
			},
			{
				icon: MessageSquare,
				title: 'Natural Conversation',
				desc: 'Ask questions in everyday language. Nexy interprets intent, not just commands.',
			},
			{
				icon: FileText,
				title: 'Assisted Reading',
				desc: 'Request summaries, specific data extraction, or version comparisons.',
			},
		],
	},
	usecases: {
		title: 'Use cases',
		items: [
			{
				title: 'Intelligent Document Search',
				problem:
					'A sales team needs to quickly find the latest contract modified with a specific client among thousands of files.',
				solution:
					"Search: 'client XYZ contract modified in January'. Get: The exact document with version history. From 20 minutes to 10 seconds.",
			},
			{
				title: 'Email Context Recovery',
				problem:
					'A manager needs to recall what was agreed in an email 3 months ago about a scope change.',
				solution:
					"Search: 'scope change dashboard project February'. Get: The specific email with the complete thread and attachments.",
			},
			{
				title: 'Onboarding Knowledge Management',
				problem:
					'A new employee needs to learn processes and documentation without bothering the team.',
				solution:
					"Ask: 'How do I process vendor invoices?' Get: Guides, procedures, and references. Autonomy from day 1.",
			},
			{
				title: 'Calendar & Document Integration',
				problem:
					'Preparing for a meeting requires manually searching emails, documents, and notes.',
				solution:
					"Search: 'preparation for ABC client meeting tomorrow'. Get: Relevant documents, emails, and previous notes.",
			},
			{
				title: 'Compliance & Audit',
				problem: 'Audit or compliance documentation needs to be found quickly.',
				solution:
					"Search: 'fiscal documents 2024 or contracts with NDA clause'. Get: Complete listing with advanced filters.",
			},
		],
	},
	features: {
		title: 'Key features',
		items: [
			{
				icon: Search,
				title: 'Semantic Search',
				desc: 'Understands natural language queries, not just exact keywords.',
			},
			{
				icon: Link,
				title: 'Multiple Connectors',
				desc: 'Google Drive, Gmail, Google Calendar, Dropbox, Microsoft 365.',
			},
			{
				icon: Zap,
				title: 'Instant Answers',
				desc: 'Results in seconds, not minutes of browsing through folders.',
			},
			{
				icon: ClipboardList,
				title: 'Full Context',
				desc: 'Every result includes metadata, dates, participants, and direct links.',
			},
			{
				icon: Lock,
				title: 'Enterprise Security',
				desc: 'Access controlled by user-specific permissions and scopes.',
			},
			{
				icon: MessageCircle,
				title: 'Integrated AI Assistant',
				desc: 'Nexy, your assistant that converses with your enterprise knowledge.',
			},
		],
	},
	why: {
		title: 'Why choose Nexata?',
		testimonials: [
			{
				role: 'Operations Director',
				quote:
					"Before Nexy, searching for information was an expedition. Now it's a conversation.",
			},
			{
				role: 'Corporate Legal',
				quote:
					"Nexy connected an 8-month-old email with a current presentation that resolved a contractual conflict. A normal search doesn't do that.",
			},
			{
				role: 'IT Manager',
				quote:
					'Implementation in minutes, not months. Native connectors without complex configuration. Total permission control.',
			},
		],
	},
	cta: {
		title: "It's not search. It's intelligence.",
		subtitle:
			'Discover what your company already knows. Connect your first source for free and start finding the information that matters.',
		start: 'Start Free',
		demo: 'Request Demo',
	},
	footer: {
		tagline: 'Your enterprise knowledge, unified.',
	},
};

function getContent(language: Language): LangContent {
	return language === 'en' ? CONTENT_EN : CONTENT_ES;
}

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
	const { theme, setTheme } = useTheme();
	const [language, setLanguage] = useState<Language>(LANGUAGE_OPTIONS[0].value);
	const [registerOpen, setRegisterOpen] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
	const c = getContent(language);

	const scrollToSection = (id: string) => {
		const el = document.getElementById(id);
		if (el) el.scrollIntoView({ behavior: 'smooth' });
	};

	const allSources = [...DINAMIC_DATA_SOURCES, ...STORAGE_DATA_SOURCES];

	return (
		<div className="min-h-screen w-full bg-background text-foreground flex flex-col relative">
			{/* -------------------- Navbar -------------------- */}
			<nav className="fixed top-0 left-0 right-0 z-50 bg-background/60 backdrop-blur-xl border-b border-foreground/5">
				<div className="flex justify-between items-center px-4 sm:px-6 lg:px-8 py-4">
					<div className="flex items-center gap-6">
						<img
							src="/nexata_logo.png"
							alt="Nexata"
							className="w-9 h-9 object-contain cursor-pointer"
							onClick={() => scrollToSection('hero')}
						/>

						<div className="hidden md:flex items-center gap-1">
							{c.nav.sections.map((sec) => (
								<button
									key={sec.id}
									onClick={() => scrollToSection(sec.id)}
									className="cursor-pointer text-sm font-medium text-muted-foreground px-3 py-1.5 rounded-md transition-colors hover:text-foreground hover:bg-foreground/5"
								>
									{sec.label}
								</button>
							))}
						</div>
					</div>

					<div className="flex items-center gap-4">
						<LanguageSelector value={language} onChange={setLanguage} />
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
								{language === 'es' ? 'Cambiar tema' : 'Toggle theme'}
							</TooltipContent>
						</Tooltip>
						<Button
							variant="ghost"
							size="sm"
							className="hidden sm:inline-flex gap-1.5"
							onClick={() => navigate({ to: '/login' })}
						>
							<LogIn className="w-3.5 h-3.5" />
							{c.hero.login}
						</Button>

						{/* Mobile hamburger */}
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
					</div>
				</div>

				{/* Mobile menu dropdown */}
				{mobileMenuOpen && (
					<div className="md:hidden border-t border-foreground/5 bg-background/95 backdrop-blur-xl px-4 pb-4 pt-2 flex flex-col gap-1">
						{c.nav.sections.map((sec) => (
							<button
								key={sec.id}
								onClick={() => {
									scrollToSection(sec.id);
									setMobileMenuOpen(false);
								}}
								className="cursor-pointer text-sm font-medium text-muted-foreground px-3 py-2 rounded-md transition-colors hover:text-foreground hover:bg-foreground/5 text-left"
							>
								{sec.label}
							</button>
						))}
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
							{c.hero.login}
						</Button>
					</div>
				)}
			</nav>

			{/* -------------------- Content -------------------- */}
			<main className="flex flex-col">
				{/* ===== Hero ===== */}
				<section
					id="hero"
					className="flex flex-col items-center justify-center text-center pt-32 pb-20 px-6 w-full bg-gradient-to-b from-primary/10 via-primary/5 to-background relative overflow-hidden"
				>
					{/* Subtle background glow */}
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />

					<motion.div
						initial={{ opacity: 0, y: -20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6 }}
						className="flex flex-col items-center gap-5 max-w-2xl relative z-10"
					>
						<img
							src="/nexata_logo.png"
							alt="Nexata"
							width={100}
							height={100}
							className="object-contain"
						/>
						<h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight tracking-tight">
							{c.hero.title}
						</h1>
						<p className="text-base sm:text-lg text-primary font-medium">
							{c.hero.tagline}
						</p>
						<p className="text-muted-foreground text-base sm:text-lg max-w-xl">
							{c.hero.subtitle}
						</p>

						<div className="flex flex-col sm:flex-row gap-3 mt-4">
							<Button
								size="lg"
								className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
								onClick={() => setRegisterOpen(true)}
							>
								<Rocket className="w-4 h-4" />
								{c.hero.cta}
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="gap-2"
								onClick={() => navigate({ to: '/login' })}
							>
								<LogIn className="w-4 h-4" />
								{c.hero.login}
							</Button>
						</div>
					</motion.div>
				</section>

				{/* ===== Intro / What is Nexata ===== */}
				<section
					id="intro"
					className="px-6 py-20 max-w-5xl mx-auto text-center space-y-8"
				>
					<motion.div {...fadeUp}>
						<h2 className="text-3xl sm:text-4xl font-bold text-foreground">
							{c.intro.title}
						</h2>
						<p className="text-lg text-muted-foreground mt-4">{c.intro.body}</p>
						<p className="text-muted-foreground mt-2">{c.intro.body2}</p>
					</motion.div>

					<motion.div className="mt-8 grid sm:grid-cols-2 gap-5" {...fadeUp}>
						{c.intro.steps.map((step, i) => (
							<Card
								key={step.title}
								className="p-6 text-left hover:shadow-md transition-shadow bg-background border"
							>
								<div className="flex items-center gap-3 mb-2">
									<span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold">
										{i + 1}
									</span>
									<h3 className="text-lg font-semibold text-foreground">
										{step.title}
									</h3>
								</div>
								<p className="text-muted-foreground text-sm">{step.desc}</p>
							</Card>
						))}
					</motion.div>
				</section>

				{/* ===== Data Sources Carousel ===== */}
<section className="py-16 text-center space-y-10">
  <motion.div {...fadeUp} className="space-y-3 px-6">
    <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
      {c.sources.title}
    </h2>
    <p className="text-muted-foreground text-lg max-w-xl mx-auto">
      {c.sources.subtitle}
    </p>
  </motion.div>

  <div className="relative w-full overflow-hidden">
    {/* Fade edges */}
    <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
    <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

    <style>{`
      @keyframes marquee {
        0%   { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      .marquee-track {
        display: flex;
        width: max-content;
        animation: marquee 20s linear infinite;
      }
    `}</style>

    <div className="py-4">
      <div className="marquee-track">
        {[...allSources, ...allSources].map((source, i) => (
          <div
            key={`${source.id}-${i}`}
            className="flex flex-col items-center mx-5 sm:mx-8 w-14 sm:w-16 shrink-0"
          >
            <img
              src={source.icon}
              alt={source.name}
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded-lg"
            />
            <span className="text-xs text-muted-foreground mt-2 font-medium leading-tight text-center">
              {source.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
</section>

				{/* ===== Meet Nexy ===== */}
				<section
					id="nexy"
					className="px-6 py-20 bg-gradient-to-b from-primary/5 to-background"
				>
					<div className="max-w-6xl mx-auto space-y-12">
						<motion.div
							{...fadeUp}
							className="text-center max-w-3xl mx-auto space-y-4"
						>
							<h2 className="text-3xl sm:text-4xl font-bold text-foreground">
								{c.nexy.title}
							</h2>
							<p className="text-lg text-muted-foreground">{c.nexy.subtitle}</p>
						</motion.div>

						<motion.div
							{...fadeUp}
							className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
						>
							{c.nexy.features.map((feat) => {
								const Icon = feat.icon;
								return (
									<Card
										key={feat.title}
										className="p-6 hover:shadow-md transition-shadow bg-background/80 backdrop-blur-sm border"
									>
										<div className="flex items-center gap-3 mb-3">
											<div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10">
												<Icon className="w-4.5 h-4.5 text-primary" />
											</div>
											<h3 className="font-semibold text-foreground">
												{feat.title}
											</h3>
										</div>
										<p className="text-muted-foreground text-sm">{feat.desc}</p>
									</Card>
								);
							})}
						</motion.div>
					</div>
				</section>

				{/* ===== Use Cases ===== */}
				<section
					id="usecases"
					className="px-6 py-20 max-w-6xl mx-auto space-y-12"
				>
					<motion.h2
						className="text-3xl sm:text-4xl font-bold text-foreground text-center"
						{...fadeUp}
					>
						{c.usecases.title}
					</motion.h2>

					<motion.div {...fadeUp} className="grid md:grid-cols-2 gap-6">
						{c.usecases.items.map((uc) => (
							<Card
								key={uc.title}
								className="p-6 hover:shadow-md transition-shadow bg-background border"
							>
								<h3 className="text-lg font-semibold text-foreground mb-3">
									{uc.title}
								</h3>
								<p className="text-sm text-muted-foreground font-medium mb-1">
									{language === 'es' ? 'Problema:' : 'Problem:'}
								</p>
								<p className="text-muted-foreground text-sm mb-3">
									{uc.problem}
								</p>
								<p className="text-sm text-muted-foreground font-medium mb-1">
									{language === 'es'
										? 'Solucion con Nexata:'
										: 'Solution with Nexata:'}
								</p>
								<p className="text-muted-foreground text-sm">{uc.solution}</p>
							</Card>
						))}
					</motion.div>
				</section>

				{/* ===== Features ===== */}
				<section
					id="features"
					className="px-6 py-20 max-w-6xl mx-auto text-center space-y-12"
				>
					<motion.h2
						className="text-3xl sm:text-4xl font-bold text-foreground"
						{...fadeUp}
					>
						{c.features.title}
					</motion.h2>

					<motion.div {...fadeUp} className="grid md:grid-cols-3 gap-6">
						{c.features.items.map((feat) => {
							const Icon = feat.icon;
							return (
								<Card
									key={feat.title}
									className="p-6 hover:shadow-md transition-shadow bg-background border flex flex-col items-center text-center"
								>
									<div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
										<Icon className="w-5 h-5 text-primary" />
									</div>
									<h3 className="text-lg font-semibold text-foreground mb-2">
										{feat.title}
									</h3>
									<p className="text-muted-foreground text-sm">{feat.desc}</p>
								</Card>
							);
						})}
					</motion.div>
				</section>

				{/* ===== Why Choose Nexata / Testimonials ===== */}
				<section className="px-6 py-20 bg-gradient-to-b from-muted/30 to-background">
					<div className="max-w-6xl mx-auto space-y-12">
						<motion.h2
							className="text-3xl sm:text-4xl font-bold text-foreground text-center"
							{...fadeUp}
						>
							{c.why.title}
						</motion.h2>

						<motion.div {...fadeUp} className="grid md:grid-cols-3 gap-6">
							{c.why.testimonials.map((t) => (
								<Card
									key={t.role}
									className="p-6 hover:shadow-md transition-shadow bg-background border"
								>
									<Quote className="w-6 h-6 text-primary/40 mb-3" />
									<p className="text-foreground italic text-sm leading-relaxed mb-4">
										"{t.quote}"
									</p>
									<p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
										— {t.role}
									</p>
								</Card>
							))}
						</motion.div>
					</div>
				</section>

				{/* ===== Final CTA ===== */}
				<section className="px-6 py-24 text-center">
					<motion.div {...fadeUp} className="max-w-2xl mx-auto space-y-6">
						<h2 className="text-3xl sm:text-4xl font-bold text-foreground">
							{c.cta.title}
						</h2>
						<p className="text-muted-foreground text-lg">{c.cta.subtitle}</p>
						<div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
							<Button
								size="lg"
								className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
								onClick={() => setRegisterOpen(true)}
							>
								<Rocket className="w-4 h-4" />
								{c.cta.start}
								<ArrowRight className="w-4 h-4" />
							</Button>
							<Button
								size="lg"
								variant="outline"
								onClick={() => scrollToSection('nexy')}
							>
								{c.cta.demo}
							</Button>
						</div>
					</motion.div>
				</section>

				{/* ===== Footer ===== */}
				<footer className="border-t border-foreground/5 px-6 py-8">
					<div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<img
								src="/nexata_logo.png"
								alt="Nexata"
								className="w-7 h-7 object-contain"
							/>
							<span className="text-sm text-muted-foreground">
								{c.footer.tagline}
							</span>
						</div>
						<p className="text-xs text-muted-foreground">
							&copy; {new Date().getFullYear()} Nexata
						</p>
					</div>
				</footer>
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

// -------------------------------- LANGUAGE SELECTOR --------------------------------
function LanguageSelector({
	value,
	onChange,
}: {
	value: Language;
	onChange: (v: Language) => void;
}) {
	const current =
		LANGUAGE_OPTIONS.find((l) => l.value === value) ?? LANGUAGE_OPTIONS[0];

	return (
		<Select value={value} onValueChange={(v) => onChange(v as Language)}>
			<SelectTrigger
				className="
          h-8
          min-w-18
          px-2
          gap-2
          border-none
          bg-transparent
          hover:bg-muted/60
          flex items-center
        "
			>
				<Flag country={current.country} />
				<span className="hidden sm:inline text-xs font-medium uppercase text-foreground">
					{current.value}
				</span>
			</SelectTrigger>

			<SelectContent align="start" className="bg-background text-foreground">
				{LANGUAGE_OPTIONS.map((lang) => (
					<SelectItem key={lang.value} value={lang.value}>
						<div className="flex items-center gap-2">
							<Flag country={lang.country} />
							<span className="text-sm uppercase text-foreground">
								{lang.value}
							</span>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function Flag({ country }: { country: string }) {
	return (
		<span
			className={`fi fi-${country} rounded-sm shrink-0 inline-block`}
			style={{ width: 18, height: 12 }}
		/>
	);
}
