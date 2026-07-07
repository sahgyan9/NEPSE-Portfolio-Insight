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

const GEMINI_API_KEY = "AIzaSyCXEgV6ChL8LLkENETsJoSVIAKsgqSl8Tg";

export const AIChatbot = ({ holdings, summary }: AIChatbotProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

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

    const getPortfolioContext = () => {
        const holdingsContext = holdings
            .map(
                (h) =>
                    `- ${h.scrip} (${h.fullName}): ${h.quantity} units @ Rs.${h.currentPrice.toFixed(2)}, Cost: Rs.${h.waccRate.toFixed(2)}, Gain/Loss: ${h.gainLossPercent.toFixed(2)}%, P/E: ${h.peRatio || "N/A"}, P/B: ${h.pbRatio || "N/A"}, EPS: ${h.eps || "N/A"}, Dividend Yield: ${h.dividendYield || 0}%, Sector: ${h.sector}`
            )
            .join("\n");

        return `
PORTFOLIO SUMMARY:
- Total Invested: Rs. ${summary.totalInvested.toLocaleString()}
- Current Value: Rs. ${summary.currentValue.toLocaleString()}
- Total Gain/Loss: Rs. ${summary.totalGainLoss.toLocaleString()} (${summary.totalGainLossPercent.toFixed(2)}%)
- Total Holdings: ${summary.totalHoldings} stocks
- Profitable Holdings: ${summary.profitableHoldings}
- Unprofitable Holdings: ${summary.unprofitableHoldings}

INDIVIDUAL HOLDINGS:
${holdingsContext}
`;
    };

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        // Retrieve API key from local storage, falling back to the hardcoded key if not configured
        const configuredKey = localStorage.getItem(STORAGE_KEYS.apiKey) || GEMINI_API_KEY;

        try {
            // Build conversation history for context
            const conversationHistory = messages.slice(-10).map((m) => ({
                role: m.role,
                parts: [{ text: m.content }],
            }));

            const systemPrompt = `You are an intelligent financial assistant for Portfolio Insight, a NEPSE (Nepal Stock Exchange) portfolio tracker application. You can help users with:

1. **Portfolio Analysis**: Answer questions about their specific holdings, performance, gains/losses, sector allocation, etc.
2. **Investment Advice**: Provide insights based on value investing principles (Benjamin Graham style) for long-term investing.
3. **Stock Information**: Explain fundamentals like P/E ratio, P/B ratio, EPS, dividend yields, and what they mean.
4. **General Finance**: Answer any general questions about investing, markets, financial concepts, etc.
5. **NEPSE Specific**: Information about Nepal Stock Exchange, trading rules, sectors, etc.

CURRENT USER'S PORTFOLIO DATA:
${getPortfolioContext()}

GUIDELINES:
- Be helpful, concise, and accurate
- When discussing the user's portfolio, reference their actual holdings and data
- Use Rs. (Nepali Rupees) for currency
- For investment advice, always remind that this is for educational purposes and not financial advice
- Be conversational and friendly
- If asked about stocks not in the portfolio, provide general information
- Format responses with markdown for better readability (use **bold**, *italic*, bullet points, etc.)`;

            const response = await fetch(
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

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || "Failed to get response");
            }

            const data = await response.json();
            const assistantText =
                data.candidates?.[0]?.content?.parts?.[0]?.text ||
                "I apologize, but I couldn't generate a response. Please try again.";

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: assistantText,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.error("Chat error:", error);
            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
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
        return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Simple markdown-like formatting
    const formatMessage = (content: string) => {
        return content
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
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 z-50"
                size="icon"
            >
                <MessageCircle className="h-6 w-6" />
            </Button>
        );
    }

    return (
        <div
            className={cn(
                "fixed bottom-6 right-6 z-50 flex flex-col bg-card border border-border rounded-xl shadow-2xl transition-all duration-300",
                isMinimized ? "w-80 h-14" : "w-96 h-[600px] max-h-[80vh]"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-blue-600/10 to-purple-600/10 rounded-t-xl">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600">
                        <Bot className="h-4 w-4 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm">Portfolio AI Assistant</h3>
                        {!isMinimized && (
                            <p className="text-xs text-muted-foreground">
                                Ask about your portfolio or investing
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {!isMinimized && messages.length > 0 && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={clearChat}
                            title="Clear chat"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setIsMinimized(!isMinimized)}
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
                        className="h-7 w-7"
                        onClick={() => setIsOpen(false)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Messages */}
                    <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center px-4">
                                <div className="p-4 rounded-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 mb-4">
                                    <Bot className="h-8 w-8 text-blue-500" />
                                </div>
                                <h4 className="font-semibold mb-2">Welcome! 👋</h4>
                                <p className="text-sm text-muted-foreground mb-4">
                                    I'm your AI portfolio assistant. Ask me anything about your
                                    investments or general finance questions.
                                </p>
                                <div className="grid gap-2 w-full">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs justify-start"
                                        onClick={() => {
                                            setInput("What's my portfolio performance summary?");
                                            setTimeout(() => sendMessage(), 100);
                                        }}
                                    >
                                        📊 What's my portfolio performance?
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs justify-start"
                                        onClick={() => {
                                            setInput("Which stocks should I consider selling?");
                                            setTimeout(() => sendMessage(), 100);
                                        }}
                                    >
                                        📈 Which stocks should I sell?
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-xs justify-start"
                                        onClick={() => {
                                            setInput("Explain P/E ratio and how to use it");
                                            setTimeout(() => sendMessage(), 100);
                                        }}
                                    >
                                        📚 Explain P/E ratio
                                    </Button>
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
                                                <div className="p-1.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600">
                                                    <Bot className="h-3 w-3 text-white" />
                                                </div>
                                            </div>
                                        )}
                                        <div
                                            className={cn(
                                                "max-w-[85%] rounded-xl px-3 py-2",
                                                message.role === "user"
                                                    ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                                                    : "bg-muted"
                                            )}
                                        >
                                            <div
                                                className="text-sm leading-relaxed"
                                                dangerouslySetInnerHTML={{
                                                    __html: formatMessage(message.content),
                                                }}
                                            />
                                            <div
                                                className={cn(
                                                    "text-[10px] mt-1",
                                                    message.role === "user"
                                                        ? "text-white/70"
                                                        : "text-muted-foreground"
                                                )}
                                            >
                                                {formatTime(message.timestamp)}
                                            </div>
                                        </div>
                                        {message.role === "user" && (
                                            <div className="flex-shrink-0 mt-1">
                                                <div className="p-1.5 rounded-full bg-blue-600">
                                                    <User className="h-3 w-3 text-white" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex gap-3">
                                        <div className="flex-shrink-0 mt-1">
                                            <div className="p-1.5 rounded-full bg-gradient-to-r from-blue-600 to-purple-600">
                                                <Bot className="h-3 w-3 text-white" />
                                            </div>
                                        </div>
                                        <div className="bg-muted rounded-xl px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                <span className="text-sm text-muted-foreground">
                                                    Thinking...
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Input */}
                    <div className="p-3 border-t border-border">
                        <div className="flex gap-2">
                            <Input
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Ask about your portfolio..."
                                disabled={isLoading}
                                className="flex-1"
                            />
                            <Button
                                onClick={sendMessage}
                                disabled={!input.trim() || isLoading}
                                size="icon"
                                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground text-center mt-2">
                            Powered by Gemini 2.5 Flash • Not financial advice
                        </p>
                    </div>
                </>
            )}
        </div>
    );
};
