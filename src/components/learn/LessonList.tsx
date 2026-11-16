import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LESSONS, readLessonsRead, writeLessonsRead } from "@/data/learn/lessons";
import { getGlossaryEntry } from "@/lib/glossary";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

interface Props {
  /** Lesson ids currently open */
  open: string[];
  onToggle: (id: string) => void;
}

/** The six "Start here" lessons. Each opens in place; read state is kept on this device. */
export const LessonList = ({ open, onToggle }: Props) => {
  const { t } = useT();
  const [read, setRead] = useState<string[]>(readLessonsRead);

  const toggleRead = useCallback((id: string) => {
    setRead((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      writeLessonsRead(next);
      return next;
    });
  }, []);

  const readCount = LESSONS.filter((l) => read.includes(l.id)).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("learn.progress", { read: readCount, total: LESSONS.length })}
      </p>
      <ol className="surface divide-y divide-border">
        {LESSONS.map((lesson, i) => {
          const isOpen = open.includes(lesson.id);
          const isRead = read.includes(lesson.id);
          const panelId = `lesson-panel-${lesson.id}`;
          return (
            <li key={lesson.id} id={`lesson-${lesson.id}`} className="scroll-mt-20">
              <button
                type="button"
                onClick={() => onToggle(lesson.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex min-h-[44px] w-full items-start gap-3 px-4 py-3 text-left"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs",
                    isRead ? "border-success/50 bg-success/10 text-success" : "border-border bg-muted"
                  )}
                  aria-hidden="true"
                >
                  {isRead ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">
                    {t("learn.lessonNumber", { n: i + 1 })}
                    {isRead && <span>, {t("learn.read")}</span>}
                  </span>
                  <span className="block font-semibold leading-relaxed">{t(`learn.${lesson.id}_title`)}</span>
                </span>
                <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground", isOpen && "rotate-180")} aria-hidden="true" />
              </button>
              {isOpen && (
                <div id={panelId} className="space-y-3 px-4 pb-5 text-[15px] leading-relaxed sm:pl-[3.25rem]">
                  {Array.from({ length: lesson.paragraphs }, (_, k) => (
                    <p key={k}>{t(`learn.${lesson.id}_p${k + 1}`)}</p>
                  ))}
                  <div className="rounded-md border border-border bg-muted/40 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">{t("learn.workedExample")}</p>
                    <p className="mt-1">{t(`learn.${lesson.id}_example`)}</p>
                  </div>
                  <p>
                    <span className="font-semibold">{t("learn.remember")}: </span>
                    {t(`learn.${lesson.id}_remember`)}
                  </p>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">{t("learn.relatedTerms")}</p>
                    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      {lesson.terms.map((term) => (
                        <li key={term}>
                          <Link to={`/learn#term-${term}`} className="inline-flex min-h-[44px] items-center text-sm text-primary hover:underline">
                            {getGlossaryEntry(term).title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button variant="outline" className="min-h-[44px]" onClick={() => toggleRead(lesson.id)} aria-pressed={isRead}>
                    {isRead && <Check className="mr-1.5 h-4 w-4" aria-hidden="true" />}
                    {isRead ? t("learn.markUnread") : t("learn.markRead")}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
