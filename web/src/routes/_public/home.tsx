"use client";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { IoMoon, IoSunny } from "react-icons/io5";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { LANGUAGE_OPTIONS } from '@/hooks/use-sync-language';
import type { Language } from "@/lib/user";
import { LogIn, Rocket } from "lucide-react";
import { DINAMIC_DATA_SOURCES, STORAGE_DATA_SOURCES } from "@/lib/available-sources";

export const Route = createFileRoute('/_public/home')({
  component: Home,
});

export default function Home() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [language, setLanguage] = useState(LANGUAGE_OPTIONS[0].value);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col relative">

      {/* ---------- Navbar Moderno Theme-Safe ---------- */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-8 py-5 bg-background/30 backdrop-blur-md border-b border-foreground/10">
        {/* Left: logo + secciones */}
        <div className="flex items-center gap-8">
          {/* Logo */}
          <img
            src="/nexata_logo.png"
            alt="Nexata"
            className="w-10 h-10 object-contain cursor-pointer"
            onClick={() => scrollToSection("hero")}
          />

          {/* Secciones */}
          {["hero", "intro", "usecases", "about", "contact"].map((sec) => (
            <button
              key={sec}
              onClick={() => scrollToSection(sec)}
              className="
                relative cursor-pointer
                text-base font-semibold
                text-foreground/90
                px-3 py-2
                rounded-md
                transition-all duration-300
                hover:text-foreground
                hover:bg-foreground/10
                after:absolute after:-bottom-1 after:left-0 after:w-0 after:h-0.5 after:bg-primary after:transition-all
                hover:after:w-full
              "
            >
              {sec.charAt(0).toUpperCase() + sec.slice(1)}
            </button>
          ))}
        </div>

        {/* Right: idioma y tema */}
        <div className="flex items-center gap-6">
          {/* Language Selector */}
          <LanguageSelector value={language} onChange={setLanguage} />

          {/* Theme Toggle */}
          <Tooltip>
            <TooltipTrigger>
              <span
                className="text-foreground/90 hover:text-foreground cursor-pointer transition-colors text-lg"
                onClick={toggleTheme}
              >
                {theme === "dark" ? <IoSunny /> : <IoMoon />}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Cambiar tema
            </TooltipContent>
          </Tooltip>
        </div>
      </nav>

      {/* ---------- Contenido Principal ---------- */}
      <div className="flex flex-col">
        {/* Hero / Presentación */}
        <section id="hero" className="flex flex-col items-center justify-center text-center py-32 w-full bg-linear-to-b from-primary/20 to-background relative">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center gap-6 max-w-xl"
          >
            <img
              src="/nexata_logo.png"
              alt="Nexata"
              width={120}
              height={120}
              className="object-contain"
            />
            <h1 className="text-5xl font-bold text-foreground">Nexata</h1>
            <p className="text-lg text-muted-foreground">
              Conecta. Busca. Encuentra. Un único punto de acceso para todo el conocimiento de tu empresa, potenciado por inteligencia artificial.
            </p>

            <div className="flex gap-4 mt-4">
              <div className="flex flex-col sm:flex-row gap-4 mt-6 justify-center">
                {/* Botón Iniciar Sesión */}
                <button
                  onClick={() => navigate({ to: '/login' })}
                  className="
                    flex items-center gap-2 cursor-pointer
                    px-5 py-3
                    rounded-lg
                    text-base font-semibold
                    bg-foreground text-background
                    hover:bg-foreground/80
                    transition-all duration-300
                    shadow-md
                  "
                >
                  <LogIn className="w-4 h-4" />
                  Iniciar Sesión
                </button>

                {/* Botón Empezar Gratis */}
                <button
                  onClick={() => alert("Empezar gratis ahora!")}
                  className="
                    flex items-center gap-2 cursor-pointer
                    px-5 py-3
                    rounded-lg
                    text-base font-semibold
                    bg-orange-500 text-white
                    hover:bg-orange-600
                    transition-all duration-300
                    shadow-md
                  "
                >
                  <Rocket className="w-4 h-4" />
                  Empezar Gratis Ahora
                </button>
              </div>
            </div>
          </motion.div>
        </section>

        <Separator className="my-12" />

        {/* ---------- Introducción / ¿Qué es Nexata? ---------- */}
        <Separator className="my-12" />

        <section id="intro" className="px-6 max-w-5xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">¿Qué es Nexata?</h2>
            <p className="text-lg sm:text-xl text-muted-foreground mt-4">
              <span className="font-semibold">El nexo de tu conocimiento empresarial.</span>
              Nexata es una plataforma de conocimiento empresarial diseñada para resolver la fragmentación de información que sufren las empresas modernas.
            </p>
            <p className="text-muted-foreground mt-2">
              En lugar de saltar entre Google Drive, Gmail, Dropbox, calendarios y otros sistemas, Nexata unifica todos estos servicios en un único buscador inteligente que entiende el contexto y devuelve respuestas precisas, no solo resultados.
            </p>
          </motion.div>

          {/* Cómo Funciona */}
          <motion.div
            className="mt-8 grid sm:grid-cols-2 gap-6 text-left"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {[
              { title: "Conecta", desc: "Vincula tus fuentes de trabajo (Google Workspace, Microsoft 365, Dropbox, etc.) en minutos." },
              { title: "Indexa", desc: "La IA procesa y organiza automáticamente tus documentos, emails y eventos." },
              { title: "Busca con inteligencia", desc: "Haz preguntas naturales como '¿Cuándo enviamos el presupuesto al cliente X?' o 'Encuéntrame los contratos del Q3 2024.'" },
              { title: "Obtén respuestas", desc: "Resultados instantáneos con contexto completo, citas exactas y enlaces directos a los archivos originales." },
            ].map((item) => (
              <Card key={item.title} className="p-6 hover:shadow-lg transition-shadow bg-background">
                <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </Card>
            ))}
          </motion.div>
        </section>

        {/* ---------- Carousel de Fuentes de Datos ---------- */}
        <Separator className="my-12" />
        <section id="sources" className="px-6 max-w-6xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-4"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Fuentes de Datos Conectables</h2>
            <p className="text-muted-foreground text-lg">
              Conecta tus herramientas favoritas y empieza a unificar tu conocimiento empresarial en segundos.
            </p>

            <div className="overflow-x-auto py-4">
              <motion.div
                className="flex gap-6 w-max"
                initial={{ x: 0 }}
                animate={{ x: [0, -50, 0] }}
                transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
              >
                {[
                  ...DINAMIC_DATA_SOURCES,
                  ...STORAGE_DATA_SOURCES
                ].map((source) => (
                  <div key={source.id} className="flex flex-col items-center min-w-25">
                    <img
                      src={source.icon}
                      alt={source.name}
                      className="w-16 h-16 object-contain rounded-md shadow-md"
                    />
                    <span className="text-xs text-muted-foreground mt-2">{source.name}</span>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </section>
        <Separator className="my-12" />

        {/* ---------- Casos de Uso ---------- */}
        <Separator className="my-12" />
        <section id="usecases" className="px-6 max-w-6xl mx-auto space-y-12">
          <motion.h2
            className="text-3xl sm:text-4xl font-bold text-foreground text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Casos de Uso
          </motion.h2>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: "Búsqueda Inteligente de Documentos",
                problem: "Un equipo de ventas necesita encontrar rápidamente el último contrato modificado con un cliente específico entre miles de archivos.",
                solution: "Busca: 'contrato cliente XYZ modificado en enero'. Obtén: El documento exacto con historial de versiones, quién lo modificó y cuándo. Ahorro: De 20 minutos de búsqueda manual a 10 segundos."
              },
              {
                title: "Recuperación de Contexto de Emails",
                problem: "Un gerente de proyecto necesita recordar qué se acordó en un email de hace 3 meses sobre un cambio de alcance.",
                solution: "Busca: 'cambio alcance proyecto dashboard febrero deusto'. Obtén: El email específico con el hilo de conversación completo y attachments. Valor: No hace falta molestar al equipo."
              },
              {
                title: "Gestión de Conocimiento Onboarding",
                problem: "Un nuevo empleado necesita aprender procesos y documentación sin molestar al equipo.",
                solution: "Pregunta: '¿Cómo proceso facturas de proveedores?'. Obtén: Guías, procedimientos documentados y referencias a emails. Valor: Autonomía desde el día 1."
              },
              {
                title: "Integración de Calendario y Documentos",
                problem: "Prepararse para una reunión requiere buscar manualmente emails, documentos y notas.",
                solution: "Busca: 'preparación reunión cliente ABC de mañana'. Obtén: Documentos relevantes, emails mencionando el tema y notas previas."
              },
              {
                title: "Compliance y Auditoría",
                problem: "Se necesita encontrar documentación de auditoría o cumplimiento rápidamente.",
                solution: "Busca: 'todos los documentos fiscales 2024 o contratos con cláusula NDA'. Obtén: Listado completo con filtros avanzados y exportación."
              }
            ].map((usecase) => (
              <Card key={usecase.title} className="p-6 hover:shadow-lg transition-shadow bg-background">
                <h3 className="text-xl font-semibold text-foreground mb-2">{usecase.title}</h3>
                <p className="text-sm text-muted-foreground font-semibold mb-1">Problema:</p>
                <p className="text-muted-foreground mb-1">{usecase.problem}</p>
                <p className="text-sm text-muted-foreground font-semibold mb-1">Solución con Nexata:</p>
                <p className="text-muted-foreground">{usecase.solution}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ---------- Características Principales ---------- */}
        <Separator className="my-12" />
        <section id="features" className="px-6 max-w-6xl mx-auto text-center space-y-12">
          <motion.h2
            className="text-3xl sm:text-4xl font-bold text-foreground"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Características Principales
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: "🔍", title: "Búsqueda Semántica", desc: "Entiende consultas en lenguaje natural, no solo palabras clave exactas" },
              { icon: "🔗", title: "Conectores Múltiples", desc: "Google Drive, Gmail, Google Calendar, Dropbox, Microsoft 365" },
              { icon: "⚡", title: "Respuestas Instantáneas", desc: "Resultados en segundos, no minutos de navegación por carpetas" },
              { icon: "📋", title: "Contexto Completo", desc: "Cada resultado incluye metadatos, fechas, participantes y enlaces directos" },
              { icon: "🔐", title: "Seguridad Empresarial", desc: "Acceso controlado por permisos y scopes específicos por usuario" },
              { icon: "💬", title: "Asistente IA Integrado", desc: "Nexy, tu asistente que conversa con tu conocimiento empresarial" },
            ].map((feature) => (
              <Card key={feature.title} className="p-6 hover:shadow-lg transition-shadow bg-background flex flex-col items-center">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-center">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ---------- ¿Por qué elegir Nexata? ---------- */}
        <Separator className="my-12" />
        <section id="why" className="px-6 max-w-6xl mx-auto text-center space-y-12">
          <motion.h2
            className="text-3xl sm:text-4xl font-bold text-foreground"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            ¿Por qué elegir Nexata?
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8 text-left">
            {[
              {
                role: "CEOs y Directores",
                quote: "Reduce el tiempo perdido en buscar información en un 70%. Tus empleados enfocados en lo que realmente importa."
              },
              {
                role: "Managers de TI",
                quote: "Implementación en minutos, no meses. Conectores nativos sin configuración compleja. Control total de permisos y seguridad."
              },
              {
                role: "Equipos de Operaciones",
                quote: "Encuentra cualquier documento, email o evento con una simple pregunta. El conocimiento empresarial al alcance de todos."
              }
            ].map((item) => (
              <Card key={item.role} className="p-6 hover:shadow-lg transition-shadow bg-background">
                <h3 className="text-xl font-semibold text-foreground mb-2">{item.role}</h3>
                <p className="text-muted-foreground italic">"{item.quote}"</p>
              </Card>
            ))}
          </div>
        </section>

        {/* ---------- Call to Action Final ---------- */}
        <Separator className="my-12" />
        <section id="cta" className="px-6 max-w-5xl mx-auto text-center py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Tu conocimiento empresarial, unificado</h2>
            <p className="text-muted-foreground text-lg">
              Descubre lo que tu empresa ya sabe. Conecta tu primera fuente gratis y empieza a encontrar la información que importa.
            </p>
            <div className="flex justify-center gap-4 mt-6">
              <Button
                size="lg"
                className="bg-green-500 text-white hover:bg-green-600 shadow-lg transition-all duration-300"
                onClick={() => alert("Empezar gratis ahora!")}
              >
                Empezar Gratis
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => alert("Solicitar Demo")}
              >
                Solicitar Demo
              </Button>
            </div>
          </motion.div>
        </section>
      </div>
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
          bg-background/10
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
              <span className="text-sm uppercase text-foreground">{lang.value}</span>
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
