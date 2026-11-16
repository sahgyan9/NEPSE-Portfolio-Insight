import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Header } from "@/components/Header";
import { LessonList } from "@/components/learn/LessonList";
import { GlossaryList } from "@/components/learn/GlossaryList";
import { LESSONS } from "@/data/learn/lessons";
import { isGlossaryKey, type GlossaryKey } from "@/lib/glossary";
import { useT } from "@/i18n";

const toggleIn = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/**
 * Lessons and glossary. Deep links: /learn#lesson-<id> opens a lesson,
 * /learn#term-<key> opens a glossary word; both scroll it into view.
 */
const LearnPage = () => {
  const { t } = useT();
  const { hash } = useLocation();
  const [openLessons, setOpenLessons] = useState<string[]>([]);
  const [openTerms, setOpenTerms] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const target = decodeURIComponent(hash.replace(/^#/, ""));
    if (!target) return;
    if (target.startsWith("lesson-")) {
      const id = target.slice("lesson-".length);
      if (!LESSONS.some((l) => l.id === id)) return;
      setOpenLessons((prev) => (prev.includes(id) ? prev : [...prev, id]));
    } else if (target.startsWith("term-")) {
      const key = target.slice("term-".length);
      if (!isGlossaryKey(key)) return;
      setQuery("");
      setOpenTerms((prev) => (prev.includes(key) ? prev : [...prev, key]));
    } else {
      return;
    }
    // Wait for the opened item to render before scrolling to it.
    const id = window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: "start" }), 0);
    return () => window.clearTimeout(id);
  }, [hash]);

  const toggleLesson = useCallback((id: string) => setOpenLessons((prev) => toggleIn(prev, id)), []);
  const toggleTerm = useCallback((key: GlossaryKey) => setOpenTerms((prev) => toggleIn(prev, key)), []);

  return (
    <div className="min-h-screen bg-background">
      <Header onRefresh={() => {}} isRefreshing={false} />
      <main className="container max-w-2xl space-y-8 px-4 py-6">
        <div>
          <h1 className="text-2xl font-semibold">{t("learn.pageTitle")}</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("learn.intro")}</p>
        </div>

        <section aria-labelledby="learn-start" className="space-y-2">
          <div>
            <h2 id="learn-start" className="text-lg font-semibold">{t("learn.startHere")}</h2>
            <p className="text-sm text-muted-foreground">{t("learn.startHereHint")}</p>
          </div>
          <LessonList open={openLessons} onToggle={toggleLesson} />
        </section>

        <section aria-labelledby="learn-glossary" className="space-y-2">
          <div>
            <h2 id="learn-glossary" className="text-lg font-semibold">{t("learn.glossaryTitle")}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("learn.glossaryHint")}</p>
          </div>
          <GlossaryList query={query} onQueryChange={setQuery} open={openTerms} onToggle={toggleTerm} />
        </section>

        <p className="text-xs leading-relaxed text-muted-foreground">{t("learn.notAdvice")}</p>
      </main>
    </div>
  );
};

export default LearnPage;
