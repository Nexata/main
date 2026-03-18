import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  ArrowUp,
  Brain,
  Calendar,
  Check,
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
  Zap,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import RegisterTenantModal from '@/components/register-tenant/register-tenant.modal';
import { Navbar } from '@/components/navbar/navbar';
import { Footer } from '@/components/footer/footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LANGUAGE_OPTIONS, usePersistedLanguage } from '@/hooks/use-sync-language';
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
	const [language, setLanguage] = usePersistedLanguage();
	const [registerOpen, setRegisterOpen] = useState(false);

	const c = getContent(language);

	const scrollToSection = (id: string) => {
		const el = document.getElementById(id);
		if (el) el.scrollIntoView({ behavior: 'smooth' });
	};

	const allSources = [...DINAMIC_DATA_SOURCES, ...STORAGE_DATA_SOURCES];

	return (
		<div className="min-h-screen w-full bg-background text-foreground flex flex-col relative">
			{/* -------------------- Navbar -------------------- */}
			<Navbar
				language={language}
				onLanguageChange={setLanguage}
				navSections={c.nav.sections}
				mobileMenuSections={c.nav.sections}
				onScrollToSection={scrollToSection}
				onLogoClick={() => scrollToSection('hero')}
				showMobileLogin
			/>

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
        <section id="intro" className="px-6 py-20 max-w-5xl mx-auto space-y-12">

          {/* Título centrado */}
          <motion.div {...fadeUp} className="text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              {c.intro.title}
            </h2>
          </motion.div>

          {/* Textos izquierda + Cards derecha */}
          <motion.div {...fadeUp} className="grid md:grid-cols-2 gap-10 items-center">
            {/* Textos */}
            <div className="space-y-4 text-left">
              <p className="text-lg text-muted-foreground leading-relaxed">
                {c.intro.body}
              </p>
              <p className="text-muted-foreground leading-relaxed">
                {c.intro.body2}
              </p>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: '10x', label: language === 'es' ? 'más rápido que búsqueda manual' : 'faster than manual search' },
                { value: '+8', label: language === 'es' ? 'integraciones disponibles' : 'available integrations' },
                { value: '< 1min', label: language === 'es' ? 'para conectar tu primera fuente' : 'to connect your first source' },
                { value: '100%', label: language === 'es' ? 'control de permisos por usuario' : 'per-user permission control' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.08, ease: 'easeOut' }}
                  className="rounded-xl border border-border bg-card p-5 flex flex-col gap-1 text-center"
                >
                  <span className="text-3xl font-bold text-primary">{stat.value}</span>
                  <span className="text-xs text-muted-foreground leading-snug">{stat.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Stepper desktop */}
          <div className="hidden sm:block">
            <IntroStepper steps={c.intro.steps} />
          </div>

          {/* Stepper mobile */}
          <div className="sm:hidden space-y-4">
            {c.intro.steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1, ease: 'easeOut' }}
                className="flex gap-4 text-left"
              >
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm">
                    {i + 1}
                  </span>
                  {i < c.intro.steps.length - 1 && (
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

            <motion.div {...fadeUp}>
              <NexyShowcase features={c.nexy.features} language={language} />
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
                    ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', scale: 1.1 }
                    : { backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', scale: 1 }
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

type ChatDemo = {
  user: string;
  reply: string;
  toolLabel: string;
  sources: { icon: string; label: string }[];
};

const NEXY_CHAT_DEMOS: ChatDemo[] = [
  {
    user: 'Donde esta el contrato con el cliente Acme de enero?',
    toolLabel: 'Buscando en Google Drive...',
    reply: 'Encontre 2 documentos relevantes. El mas reciente es "Contrato_Acme_v3.pdf" modificado el 14 ene, ubicado en Google Drive > Clientes > Acme.',
    sources: [
      { icon: '/datasource_icons/gdrive.png', label: 'Contrato_Acme_v3.pdf' },
      { icon: '/datasource_icons/gdrive.png', label: 'Google Drive' },
    ],
  },
  {
    user: 'Que se hablo sobre el presupuesto del proyecto Alpha?',
    toolLabel: 'Buscando en Gmail...',
    reply: 'Encontre un hilo de email del 3 mar con Paula y un archivo adjunto "budget_alpha_final.xlsx". Tambien hay una nota en Calendar del 5 mar.',
    sources: [
      { icon: '/datasource_icons/gmail.png', label: 'Email - Paula' },
      { icon: '/datasource_icons/gdrive.png', label: 'budget_alpha_final.xlsx' },
    ],
  },
  {
    user: 'Cuando es la proxima reunion con el equipo de diseno?',
    toolLabel: 'Consultando Google Calendar...',
    reply: 'Tenes una reunion "Sync Diseno Q2" manana a las 10:00 AM con Marcos, Sofia y Laura. El doc de agenda esta vinculado al evento.',
    sources: [
      { icon: '/datasource_icons/gcalendar.png', label: 'Google Calendar' },
      { icon: '/datasource_icons/gdrive.png', label: 'Agenda Sync Q2' },
    ],
  },
  {
    user: 'Como proceso una factura de proveedor nuevo?',
    toolLabel: 'Buscando en archivos...',
    reply: 'El proceso tiene 4 pasos. Encontre la guia oficial "Proceso_Facturas_v2.pdf" en el drive de Finanzas, actualizada el mes pasado.',
    sources: [
      { icon: '/datasource_icons/gdrive.png', label: 'Proceso_Facturas_v2.pdf' },
      { icon: '/datasource_icons/gdrive.png', label: 'Drive - Finanzas' },
    ],
  },
  {
    user: 'Resumi el informe trimestral Q1 2024',
    toolLabel: 'Leyendo documento...',
    reply: 'El informe Q1 2024 muestra un crecimiento del 18% en ingresos. Los puntos clave son: expansion LATAM, lanzamiento producto B y reduccion de costos operativos.',
    sources: [
      { icon: '/datasource_icons/gdrive.png', label: 'Informe_Q1_2024.pdf' },
      { icon: '/nexata_logo.png', label: '3 paginas analizadas' },
    ],
  },
];

const NEXY_CHAT_DEMOS_EN: ChatDemo[] = [
  {
    user: 'Where is the Acme client contract from January?',
    toolLabel: 'Searching Google Drive...',
    reply: 'I found 2 relevant documents. The most recent is "Contract_Acme_v3.pdf" modified on Jan 14, located in Google Drive > Clients > Acme.',
    sources: [
      { icon: '/datasource_icons/gdrive.png', label: 'Contract_Acme_v3.pdf' },
      { icon: '/datasource_icons/gdrive.png', label: 'Google Drive' },
    ],
  },
  {
    user: 'What was discussed about the Alpha project budget?',
    toolLabel: 'Searching Gmail...',
    reply: 'I found an email thread from Mar 3 with Paula and an attachment "budget_alpha_final.xlsx". There is also a Calendar note from Mar 5.',
    sources: [
      { icon: '/datasource_icons/gmail.png', label: 'Email - Paula' },
      { icon: '/datasource_icons/gdrive.png', label: 'budget_alpha_final.xlsx' },
    ],
  },
  {
    user: 'When is the next meeting with the design team?',
    toolLabel: 'Checking Google Calendar...',
    reply: 'You have a "Design Sync Q2" meeting tomorrow at 10:00 AM with Marcos, Sofia and Laura. The agenda doc is linked to the event.',
    sources: [
      { icon: '/datasource_icons/gcalendar.png', label: 'Google Calendar' },
      { icon: '/datasource_icons/gdrive.png', label: 'Agenda Sync Q2' },
    ],
  },
  {
    user: 'How do I process a new vendor invoice?',
    toolLabel: 'Searching files...',
    reply: 'The process has 4 steps. I found the official guide "Invoice_Process_v2.pdf" in the Finance drive, updated last month.',
    sources: [
      { icon: '/datasource_icons/gdrive.png', label: 'Invoice_Process_v2.pdf' },
      { icon: '/datasource_icons/gdrive.png', label: 'Drive - Finance' },
    ],
  },
  {
    user: 'Summarize the Q1 2024 quarterly report',
    toolLabel: 'Reading document...',
    reply: 'The Q1 2024 report shows 18% revenue growth. Key highlights: LATAM expansion, product B launch, and operational cost reduction.',
    sources: [
      { icon: '/datasource_icons/gdrive.png', label: 'Report_Q1_2024.pdf' },
      { icon: '/nexata_logo.png', label: '3 pages analyzed' },
    ],
  },
];

function NexyShowcase({
  features,
  language,
}: {
  features: { icon: typeof Search; title: string; desc: string }[];
  language: Language;
}) {
  const [active, setActive] = useState(0);
  const demos = language === 'en' ? NEXY_CHAT_DEMOS_EN : NEXY_CHAT_DEMOS;
  const demo = demos[active];

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
                ${isActive
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
                <p className={`text-sm font-semibold transition-colors duration-200 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {feat.title}
                </p>
                <p className={`text-xs mt-0.5 leading-relaxed transition-colors duration-200 ${isActive ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
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
            style={{ height: 420 }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
              <img src="/nexata_logo.png" alt="Nexy" className="w-6 h-6 object-contain" />
              <span className="text-sm font-semibold text-foreground">Nexy</span>
              <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                {language === 'es' ? 'En linea' : 'Online'}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-hidden px-4 py-4 flex flex-col gap-3">

              {/* Mensaje usuario */}
              <div className="flex justify-end">
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="relative break-words rounded-lg p-3 text-sm max-w-[85%] bg-muted text-foreground"
                >
                  {demo.user}
                </motion.div>
              </div>

              {/* Tool call — réplica exacta de ToolRenderer */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.1, ease: 'easeOut' }}
                className="w-full rounded-lg border bg-muted/40 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={demo.sources[0]?.icon ?? '/nexata_logo.png'}
                      alt="tool"
                      className="h-5 w-5 shrink-0 object-contain"
                    />
                    <span className="text-sm font-medium truncate text-foreground">
                      {demo.toolLabel}
                    </span>
                  </div>
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                </div>
              </motion.div>

              {/* Respuesta Nexy */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.2, ease: 'easeOut' }}
                className="relative break-words rounded-lg p-3 text-sm max-w-[85%] bg-transparent text-foreground"
              >
                {demo.reply}
              </motion.div>

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
                  {language === 'es' ? 'Preguntale algo a Nexy...' : 'Ask Nexy something...'}
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
