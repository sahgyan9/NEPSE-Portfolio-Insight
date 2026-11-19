import { useState, useRef, useEffect } from "react";
import {
    MessageCircle,
    Send,
    X,
    Bot,
    User,
    Loader2,
    Trash2,
    Minimize2,
    Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { StockHolding, PortfolioSummary } from "@/data/portfolioData";
import { STORAGE_KEYS } from "@/lib/constants";
import { useT } from "@/i18n";
import { buildChatPrompt, classifyAiError, AiRequestError, toAiRequestError } from "@/lib/aiPrompt";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

interface AIChatbotProps {
    holdings: StockHolding[];
    summary: PortfolioSummary;
}

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const STARTER_KEYS = ["ai.starter1", "ai.starter2", "ai.starter3", "ai.starter4", "ai.starter5"];

export const AIChatbot = ({ holdings, summary }: AIChatbotProps) => {
    const { t, lang } = useT();
    // Visible height on phones: shrinks when the on-screen keyboard opens so the input stays in view
    const [viewportHeight, setViewportHeight] = useState<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close the panel on a click outside it or on Esc; messages and the typed text stay
    useEffect(() => {
        if (!isOpen) return;
        const onPointerDown = (e: PointerEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [isOpen]);

    // Load chat history from localStorage
    useEffect(() => {
        const savedMessages = localStorage.getItem("chatbot_messages");
        if (savedMessages) {
            try {
                const parsed = JSON.parse(savedMessages);
                setMessages(
                    parsed.map((m: Message) => ({
                        ...m,
                        timestamp: new Date(m.timestamp),
                    }))
                );
            } catch (e) {
                console.error("Failed to parse chat history:", e);
            }
        }
    }, []);

    // Save chat history to localStorage
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem("chatbot_messages", JSON.stringify(messages));
        }
    }, [messages]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector(
                "[data-radix-scroll-area-viewport]"
            );
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

    // Focus input when chat opens
    useEffect(() => {
        if (isOpen && !isMinimized && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen, isMinimized]);

    useEffect(() => {
        if (!isOpen) return;
        const vv = window.visualViewport;
        if (!vv) return;
        const update = () => setViewportHeight(vv.height);
        update();
        vv.addEventListener("resize", update);
        return () => vv.removeEventListener("resize", update);
    }, [isOpen]);

    const addAssistant = (content: string) =>
        setMessages((prev) => [
            ...prev,
            { id: `${Date.now()}-a`, role: "assistant", content, timestamp: new Date() },
        ]);

    const sendMessage = async (override?: string) => {
        const text = (override ?? input).trim();
        if (!text || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: text,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");

        // Key from local storage, falling back to the build-time key
        const configuredKey = localStorage.getItem(STORAGE_KEYS.apiKey) || GEMINI_API_KEY;
        if (!configuredKey) {
            addAssistant(t("ai.noKey"));
            return;
        }

        setIsLoading(true);

        try {
            // Build conversation history for context
            const conversationHistory = messages.slice(-10).map((m) => ({
                role: m.role === "assistant" ? "model" : "user",
                parts: [{ text: m.content }],
            }));

            // Built per message so the reply language follows the app language right now
            const systemPrompt = buildChatPrompt(lang, holdings, summary);

            let response: Response;
            try {
                response = await fetch(
                    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${configuredKey}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            contents: [
                                {
                                    role: "user",
                                    parts: [{ text: systemPrompt }],
                                },
                                ...conversationHistory,
                                {
                                    role: "user",
                                    parts: [{ text: userMessage.content }],
                                },
                            ],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 1024,
                                topP: 0.95,
                                topK: 40,
                            },
                        }),
                    }
                );
            } catch {
                throw new AiRequestError("network");
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const msg: string = errorData?.error?.message || "";
                throw new AiRequestError(classifyAiError(response.status, msg), msg);
            }

            const data = await response.json();
            const assistantText = data.candidates?.[0]?.content?.parts?.[0]?.text;
            addAssistant(assistantText || t("ai.errEmpty"));
        } catch (error) {
            console.error("Chat error:", error);
            const kind = toAiRequestError(error).kind;
            const key =
                kind === "network" ? "ai.errNetwork" : kind === "invalidKey" ? "ai.errInvalidKey" : kind === "quota" ? "ai.errQuota" : "ai.errOther";
            addAssistant(t(key));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([]);
        localStorage.removeItem("chatbot_messages");
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Simple markdown-like formatting
    const formatMessage = (content: string) => {
        return content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .split("\n")
            .map((line, i) => {
                // Bold
                line = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
                // Italic
                line = line.replace(/\*(.*?)\*/g, "<em>$1</em>");
                // Bullet points
                if (line.trim().startsWith("- ") || line.trim().startsWith("• ")) {
                    line = `<span class="ml-2">• ${line.trim().substring(2)}</span>`;
                }
                // Numbered lists
                const numberedMatch = line.match(/^(\d+)\.\s(.*)$/);
                if (numberedMatch) {
                    line = `<span class="ml-2">${numberedMatch[1]}. ${numberedMatch[2]}</span>`;
                }
                return line;
            })
            .join("<br/>");
    };

    if (!isOpen) {
        return (
            <Button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 lg:bottom-6 lg:right-6 h-14 w-14 rounded-full shadow-sm bg-primary hover:bg-primary/90 z-50"
                size="icon"
                aria-label={t("ai.open")}
            >
                <MessageCircle className="h-6 w-6" />
            </Button>
        );
    }

    return (
        <div
            ref={panelRef}
            className={cn(
                "fixed z-50 flex flex-col bg-card border border-border shadow-sm",
                // Phones: full width and height above the bottom tab bar
                "inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] h-[calc(100dvh-4rem-env(safe-area-inset-bottom))]",
                // Desktop: floating panel
                "lg:inset-x-auto lg:top-auto lg:bottom-6 lg:right-6 lg:rounded-xl",
                isMinimized
                    ? "lg:w-80 lg:h-14"
                    : "lg:w-96 lg:h-[600px] lg:max-h-[80dvh]"
            )}
            style={viewportHeight ? { maxHeight: viewportHeight } : undefined}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50 lg:rounded-t-xl">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-full bg-primary hover:bg-primary/90">
                        <Bot className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">{t("ai.title")}</h3>
                        {!isMinimized && (
                            <p className="text-xs text-muted-foreground">
                                {t("ai.subtitle")}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {!isMinimized && messages.length > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 lg:h-8 lg:w-8"
                            onClick={clearChat}
                            title={t("ai.clear")}
                            aria-label={t("ai.clear")}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="hidden lg:inline-flex h-8 w-8"
                        onClick={() => setIsMinimized(!isMinimized)}
                        aria-label={isMinimized ? t("ai.expand") : t("ai.minimize")}
                    >
                        {isMinimized ? (
                            <Maximize2 className="h-4 w-4" />
                        ) : (
                            <Minimize2 className="h-4 w-4" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 lg:h-8 lg:w-8"
                        onClick={() => setIsOpen(false)}
                        aria-label={t("ai.close")}
                        title={t("ai.close")}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Messages */}
                    <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 p-4">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center text-center px-2 py-2">
                                <div className="p-4 rounded-full bg-muted/50 mb-3">
                                    <Bot className="h-8 w-8 text-primary" />
                                </div>
                                <h4 className="font-semibold mb-2 leading-relaxed">{t("ai.welcomeTitle")}</h4>
                                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                                    {t("ai.welcomeBody")}
                                </p>
                                <div className="flex flex-wrap justify-center gap-2 w-full">
                                    {STARTER_KEYS.map((key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            className="min-h-11 rounded-full border border-border bg-background px-4 py-2 text-sm leading-relaxed text-left hover:bg-muted"
                                            onClick={() => sendMessage(t(key))}
                                        >
                                            {t(key)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={cn(
                                            "flex gap-3",
                                            message.role === "user" ? "justify-end" : "justify-start"
                                        )}
                                    >
                                        {message.role === "assistant" && (
                                            <div className="flex-shrink-0 mt-1">
                                                <div className="p-1.5 rounded-full bg-primary hover:bg-primary/90">
                                                    <Bot className="h-3 w-3 text-primary-foreground" />
                                                </div>
                                            </div>
                                        )}
                                        <div
                                            className={cn(
                                                "max-w-[85%] rounded-xl px-3 py-2",
                                                message.role === "user"
                                                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                                                    : "bg-muted"
                                            )}
                                        >
                                            <div
                                                className="text-sm leading-relaxed break-words"
                                                dangerouslySetInnerHTML={{
                                                    __html: formatMessage(message.content),
                                                }}
                                            />
                                            <div
                                                className={cn(
                                                    "text-[10px] mt-1",
                                                    message.role === "user"
                                                        ? "text-primary-foreground/70"
                                                        : "text-muted-foreground"
                                                )}
                                            >
                                                {formatTime(message.timestamp)}
                                            </div>
                                        </div>
                                        {message.role === "user" && (
                                            <div className="flex-shrink-0 mt-1">
                                                <div className="p-1.5 rounded-full bg-primary">
                                                    <User className="h-3 w-3 text-primary-foreground" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 mt-1">
                                            <div className="p-1.5 rounded-full bg-primary hover:bg-primary/90">
                                                <Bot className="h-3 w-3 text-primary-foreground" />
                                            </div>
                                        </div>
                                        <div className="bg-muted rounded-xl px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span className="text-sm text-muted-foreground">
                                                    {t("ai.thinking")}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Input */}
                    <div className="p-3 border-t border-border shrink-0">
                        <div className="flex gap-2">
                            <Input
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder={t("ai.placeholder")}
                                disabled={isLoading}
                                className="flex-1 h-11 text-base lg:text-sm"
                            />
                            <Button
                                onClick={() => sendMessage()}
                                disabled={!input.trim() || isLoading}
                                size="icon"
                                className="h-11 w-11 shrink-0 bg-primary hover:bg-primary/90"
                                aria-label={t("ai.send")}
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground text-center mt-2 leading-relaxed">
                            {t("ai.notice")}
                        </p>
                    </div>
                </>
            )}
        </div>
    );
};
