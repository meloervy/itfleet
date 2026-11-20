import React, { useState, useEffect, useRef } from 'react';
import { Link, usePage } from '@inertiajs/react';
import axios from 'axios';
import HardwareImage from '@/Components/HardwareImage';
import {
    RiSendPlaneFill,
    RiCloseLine,
    RiRefreshLine,
    RiAlertLine,
    RiMoneyDollarCircleLine,
    RiToolsLine,
    RiArrowRightLine,
    RiCheckLine,
    RiSubtractLine,
    RiFullscreenLine,
    RiFullscreenExitLine,
    RiArrowDownLine,
    RiArrowDownSLine,
    RiArrowUpSLine,
    RiPencilLine,
    RiDeleteBinLine,
    RiSparklingLine,
    RiHistoryLine,
    RiAddLine,
    RiDatabase2Line,
    RiKey2Line,
    RiUserLine,
    RiLockLine,
    RiEyeLine,
} from 'react-icons/ri';

/**
 * Format inline bold **text** and code `code`.
 */
function renderFormattedText(text) {
    if (!text) return '';
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return (
                <strong key={i} className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <code
                    key={i}
                    className="px-1.5 py-0.5 rounded-sm bg-zinc-100 dark:bg-zinc-800 text-[11px] font-mono text-[#026eff] dark:text-sky-400"
                >
                    {part.slice(1, -1)}
                </code>
            );
        }
        return part;
    });
}

/**
 * Robust markdown renderer supporting tables, blockquotes, headers, and bullet lists.
 */
function MarkdownRenderer({ content }) {
    if (!content) return null;

    const lines = content.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            i++;
            continue;
        }

        // Table block: line starts and ends with '|'
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            const tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }

            if (tableLines.length >= 2) {
                const headerCols = tableLines[0]
                    .split('|')
                    .slice(1, -1)
                    .map((c) => c.trim());

                const startRow = tableLines[1].includes('---') ? 2 : 1;
                const rowData = [];
                for (let r = startRow; r < tableLines.length; r++) {
                    const cells = tableLines[r]
                        .split('|')
                        .slice(1, -1)
                        .map((c) => c.trim());
                    rowData.push(cells);
                }

                blocks.push({
                    type: 'table',
                    headers: headerCols,
                    rows: rowData,
                });
                continue;
            }
        }

        // Blockquote (> )
        if (trimmed.startsWith('> ') || trimmed === '>') {
            const quoteLines = [];
            while (
                i < lines.length &&
                (lines[i].trim().startsWith('>') ||
                    (quoteLines.length > 0 &&
                        lines[i].trim() !== '' &&
                        !lines[i].trim().startsWith('#') &&
                        !lines[i].trim().startsWith('|')))
            ) {
                quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
                i++;
            }
            blocks.push({
                type: 'blockquote',
                text: quoteLines.join(' '),
            });
            continue;
        }

        if (trimmed.startsWith('### ')) {
            blocks.push({ type: 'h4', text: trimmed.replace(/^###\s+/, '') });
            i++;
            continue;
        }
        if (trimmed.startsWith('## ')) {
            blocks.push({ type: 'h3', text: trimmed.replace(/^##\s+/, '') });
            i++;
            continue;
        }

        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            blocks.push({ type: 'bullet', text: trimmed.substring(2) });
            i++;
            continue;
        }

        if (trimmed === '---') {
            blocks.push({ type: 'hr' });
            i++;
            continue;
        }

        blocks.push({ type: 'p', text: trimmed });
        i++;
    }

    return (
        <div className="space-y-2 text-xs sm:text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
            {blocks.map((block, bIdx) => {
                if (block.type === 'table') {
                    return (
                        <div key={bIdx} className="overflow-x-auto my-2 rounded-sm border border-zinc-200 dark:border-zinc-800">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-200">
                                        {block.headers.map((h, hIdx) => (
                                            <th key={hIdx} className="px-2.5 py-2 font-medium whitespace-nowrap">
                                                {renderFormattedText(h)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                    {block.rows.map((row, rIdx) => (
                                        <tr key={rIdx} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition">
                                            {row.map((cell, cIdx) => (
                                                <td key={cIdx} className="px-2.5 py-2 text-zinc-600 dark:text-zinc-300">
                                                    {renderFormattedText(cell)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                }

                if (block.type === 'blockquote') {
                    return (
                        <div
                            key={bIdx}
                            className="px-3 py-2 my-2 rounded-sm bg-amber-500/10 border border-amber-500/40 text-xs text-amber-900 dark:text-amber-200 leading-normal"
                        >
                            {renderFormattedText(block.text)}
                        </div>
                    );
                }

                if (block.type === 'h4') {
                    return (
                        <h4 key={bIdx} className="font-semibold text-[13px] text-zinc-900 dark:text-zinc-100 pt-1 pb-0.5">
                            {renderFormattedText(block.text)}
                        </h4>
                    );
                }

                if (block.type === 'h3') {
                    return (
                        <h3 key={bIdx} className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 pt-1.5 pb-0.5">
                            {renderFormattedText(block.text)}
                        </h3>
                    );
                }

                if (block.type === 'bullet') {
                    return (
                        <div key={bIdx} className="flex items-start gap-2 pl-1.5">
                            <span className="text-[#026eff] dark:text-sky-400 shrink-0">&bull;</span>
                            <div className="flex-1">{renderFormattedText(block.text)}</div>
                        </div>
                    );
                }

                if (block.type === 'hr') {
                    return <hr key={bIdx} className="border-zinc-200/80 dark:border-zinc-800 my-2" />;
                }

                return <p key={bIdx}>{renderFormattedText(block.text)}</p>;
            })}
        </div>
    );
}

const buildWelcomeMessage = (followups = [], isTechnician = false) => ({
    id: 'welcome_' + Date.now(),
    sender: 'assistant',
    category: 'general_itam',
    source: 'local_db_engine',
    tool_trace: [],
    answer:
        '### ITFleet Analytics Copilot (Read-Only)\n\n' +
        'Ask questions across laptops, desktops, monitors, mobile devices, peripherals, employee custody, software licenses, maintenance, and mismatches in **English or Tagalog**.' +
        (isTechnician ? ' *(Financial valuation is restricted for Technician role.)*' : ''),
    data_cards: [],
    suggested_followups:
        followups.length > 0
            ? followups
            : isTechnician
            ? [
                  'Which devices are currently undergoing repairs and maintenance?',
                  'Which hardware warranties expire in the next 60 days?',
                  'How many idle devices do we currently have in inventory?',
                  'Which software licenses are near capacity or expiring soon?',
              ]
            : [
                  'Which employees are using low end specs?',
                  'How many idle devices do we currently have in inventory?',
                  'Show software license seat utilization and upcoming renewals',
                  'What is our total fleet acquisition cost and current book value?',
              ],
});

export default function GeminiFleetAssistant({ isOpen = false, showFloatingTrigger = true, onClose, onOpen, pageContext = null }) {
    const { auth, demo } = usePage().props;
    const user = auth?.user;
    const isAdminOrManager = ['admin', 'manager'].includes(user?.role);
    const isTechnician = user?.role === 'technician';

    const [isFloatingOpen, setIsFloatingOpen] = useState(isOpen);
    const [isMaximized, setIsMaximized] = useState(false);
    const [showThreadsDrawer, setShowThreadsDrawer] = useState(false);
    const [conversations, setConversations] = useState([]);
    const [conversationId, setConversationId] = useState(null);
    const [starterFollowups, setStarterFollowups] = useState([]);
    const [messages, setMessages] = useState(() => [buildWelcomeMessage([], isTechnician)]);
    const [inputPrompt, setInputPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingThread, setIsLoadingThread] = useState(false);
    const [collapsedMessages, setCollapsedMessages] = useState({});
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [aiStatus, setAiStatus] = useState({
        state: 'offline',
        model: 'gemini-4-hydrogen',
        model_label: 'Gemini 4 Hydrogen',
        label: 'Local DB Engine Active',
        sublabel: 'Offline Mode',
        tooltip: 'Initializing fleet copilot status...',
        is_fallback: true,
        needs_api_key: true,
    });

    const [windowSize, setWindowSize] = useState(() => {
        try {
            const saved = localStorage.getItem('itfleet_fleet_assistant_size');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.width && parsed.height) return parsed;
            }
        } catch (e) {}
        return { width: 560, height: 660 };
    });

    const scrollContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        try {
            localStorage.setItem('itfleet_fleet_assistant_size', JSON.stringify(windowSize));
        } catch (e) {}
    }, [windowSize]);

    useEffect(() => {
        setIsFloatingOpen(isOpen);
    }, [isOpen]);

    const fetchContext = async () => {
        try {
            const res = await axios.get(route('fleet-assistant.context'));
            const followups = res.data?.starter_followups || [];
            setStarterFollowups(followups);
            if (res.data?.ai_status) {
                setAiStatus(res.data.ai_status);
            }
            if (Array.isArray(res.data?.conversations)) {
                setConversations(res.data.conversations);
            }
            return followups;
        } catch (e) {
            return [];
        }
    };

    // Refresh context, RBAC starter followups, and conversation threads whenever user or preset changes
    useEffect(() => {
        let active = true;
        setConversationId(null);
        setShowThreadsDrawer(false);
        setCollapsedMessages({});

        fetchContext().then((followups) => {
            if (active) {
                setMessages([buildWelcomeMessage(followups, isTechnician)]);
            }
        });

        return () => {
            active = false;
        };
    }, [user?.id, user?.role, demo?.active_preset]);

    useEffect(() => {
        if (isFloatingOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 150);

            const handleKeyDown = (e) => {
                if (e.key === 'Escape') {
                    handleClose();
                }
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isFloatingOpen]);

    const handleClose = () => {
        setIsFloatingOpen(false);
        if (onClose) onClose();
    };

    const handleOpen = () => {
        setIsFloatingOpen(true);
        if (onOpen) onOpen();
    };

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 120;
        setShowScrollBottom(!isNearBottom);
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const toggleCollapse = (msgId) => {
        setCollapsedMessages((prev) => ({
            ...prev,
            [msgId]: !prev[msgId],
        }));
    };

    const handleUnsendMessage = (msgId) => {
        setMessages((prev) => {
            const index = prev.findIndex((m) => m.id === msgId);
            if (index === -1) return prev;

            const nextMsg = prev[index + 1];
            if (nextMsg && nextMsg.sender === 'assistant') {
                return [...prev.slice(0, index), ...prev.slice(index + 2)];
            }
            return [...prev.slice(0, index), ...prev.slice(index + 1)];
        });
    };

    const handleEditMessage = (msgId) => {
        const msg = messages.find((m) => m.id === msgId);
        if (!msg) return;

        setInputPrompt(msg.text || '');
        handleUnsendMessage(msgId);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleNewConversation = () => {
        setConversationId(null);
        setShowThreadsDrawer(false);
        setMessages([buildWelcomeMessage(starterFollowups, isTechnician)]);
        setInputPrompt('');
        setIsLoading(false);
        setCollapsedMessages({});
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleLoadConversation = async (targetConvId) => {
        if (isLoadingThread) return;
        setIsLoadingThread(true);
        try {
            const res = await axios.get(route('fleet-assistant.conversations.show', { conversationId: targetConvId }));
            const loadedMessages = res.data?.messages || [];
            setConversationId(targetConvId);
            setMessages(
                loadedMessages.length > 0
                    ? loadedMessages
                    : [buildWelcomeMessage(starterFollowups, isTechnician)]
            );
            setShowThreadsDrawer(false);
            setCollapsedMessages({});
        } catch (e) {
        } finally {
            setIsLoadingThread(false);
        }
    };

    const handleDeleteConversation = async (e, targetConvId) => {
        e.stopPropagation();
        try {
            await axios.delete(route('fleet-assistant.conversations.destroy', { conversationId: targetConvId }));
            setConversations((prev) => prev.filter((c) => c.id !== targetConvId));
            if (conversationId === targetConvId) {
                handleNewConversation();
            }
        } catch (err) {}
    };

    const handleSend = async (queryText) => {
        const textToSend = (queryText || inputPrompt).trim();
        if (!textToSend || isLoading) return;

        const userMsgId = 'user_' + Date.now();
        const userMsg = {
            id: userMsgId,
            sender: 'user',
            text: textToSend,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        const history = messages
            .filter((m) => !String(m.id).startsWith('welcome'))
            .slice(-8)
            .map((m) => ({
                role: m.sender === 'user' ? 'user' : 'assistant',
                content: (m.text || m.answer || '').slice(0, 10000),
            }));

        setMessages((prev) => [...prev, userMsg]);
        setInputPrompt('');
        setShowThreadsDrawer(false);
        setIsLoading(true);

        setTimeout(() => {
            const userEl = document.getElementById(userMsgId);
            if (userEl) {
                userEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 50);

        try {
            const response = await axios.post(route('fleet-assistant.query'), {
                prompt: textToSend,
                conversation_id: conversationId,
                page_context: pageContext,
                history,
            });

            const data = response.data;
            if (data.ai_status) {
                setAiStatus(data.ai_status);
            }
            if (data.conversation_id) {
                setConversationId(data.conversation_id);
                axios
                    .get(route('fleet-assistant.conversations.index'))
                    .then((r) => {
                        if (Array.isArray(r.data?.conversations)) {
                            setConversations(r.data.conversations);
                        }
                    })
                    .catch(() => {});
            }

            const assistantMsg = {
                id: 'assistant_' + Date.now(),
                sender: 'assistant',
                category: data.category || 'general_itam',
                source: data.source || aiStatus.model || 'gemini-4-hydrogen',
                model_label: data.model_label || aiStatus.model_label,
                tool_trace: data.tool_trace || [],
                answer: data.answer || 'No response received from fleet assistant.',
                data_cards: data.data_cards || [],
                suggested_followups: data.suggested_followups || [],
            };

            setMessages((prev) => [...prev, assistantMsg]);
        } catch (error) {
            const status = error.response?.status;
            const isAuth = status === 401 || status === 419;
            const errorMsg = {
                id: 'err_' + Date.now(),
                sender: 'assistant',
                category: 'error',
                source: 'system',
                tool_trace: [],
                isAuth,
                loginUrl: error.response?.data?.login_url || '/login',
                answer: isAuth
                    ? 'Your session has expired. Please log in again to resume.'
                    : 'Unable to process query: ' + (error.response?.data?.message || error.message),
                data_cards: [],
                suggested_followups: isAuth ? [] : starterFollowups.slice(0, 2),
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleResizeStart = (e, direction) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = windowSize.width;
        const startHeight = windowSize.height;

        const onMouseMove = (moveEvent) => {
            const maxW = Math.min(920, window.innerWidth - 32);
            const minW = Math.min(380, maxW);
            const maxH = Math.min(900, window.innerHeight - 32);
            const minH = Math.min(460, maxH);

            let newWidth = startWidth;
            let newHeight = startHeight;

            if (direction === 'left' || direction === 'top-left') {
                const deltaX = startX - moveEvent.clientX;
                newWidth = Math.min(Math.max(startWidth + deltaX, minW), maxW);
            }

            if (direction === 'top' || direction === 'top-left') {
                const deltaY = startY - moveEvent.clientY;
                newHeight = Math.min(Math.max(startHeight + deltaY, minH), maxH);
            }

            setWindowSize({ width: newWidth, height: newHeight });
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };

        document.body.style.userSelect = 'none';
        if (direction === 'top-left') document.body.style.cursor = 'nwse-resize';
        else if (direction === 'top') document.body.style.cursor = 'ns-resize';
        else if (direction === 'left') document.body.style.cursor = 'ew-resize';

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const statusBadgeText =
        aiStatus?.state === 'online'
            ? aiStatus.model_label || 'Gemini 4 Hydrogen'
            : aiStatus?.state === 'quota_exceeded' || aiStatus?.state === 'credit_exhausted'
            ? 'Local DB Mode'
            : aiStatus?.label || 'Local DB Engine';

    const pageContextSummary = pageContext?.entity_label
        ? `Asset: ${pageContext.entity_label}`
        : pageContext?.component
        ? `Page: ${pageContext.component.replace('/Index', '')}`
        : null;

    return (
        <>
            {/* Minimized Floating Launcher Bubble (optional; hidden when navbar trigger is used) */}
            {showFloatingTrigger && !isFloatingOpen && (
                <div className="fixed bottom-5 right-5 z-40">
                    <button
                        type="button"
                        onClick={handleOpen}
                        className="group relative flex items-center gap-2 px-3.5 py-2 rounded-sm border border-zinc-800 dark:border-zinc-200 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 transition-colors duration-150 cursor-pointer"
                        title="Open Fleet Assistant (Ctrl+K)"
                    >
                        <RiSparklingLine className="w-3.5 h-3.5 text-sky-400 dark:text-[#026eff] shrink-0" />
                        <span className="text-xs font-medium tracking-tight">Talk to Fleet</span>
                    </button>
                </div>
            )}

            {/* Floating Chat Window */}
            {isFloatingOpen && (
                <div
                    className={
                        isMaximized
                            ? 'fixed inset-0 z-50 w-screen h-screen max-w-none max-h-none rounded-sm bg-white dark:bg-zinc-900 border-none flex flex-col overflow-hidden font-sans'
                            : 'fixed bottom-4 sm:bottom-5 right-4 sm:right-5 z-50 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 flex flex-col overflow-hidden font-sans'
                    }
                    style={
                        isMaximized
                            ? { width: '100vw', height: '100vh', inset: 0 }
                            : {
                                  width: `${windowSize.width}px`,
                                  height: `${windowSize.height}px`,
                                  maxWidth: 'calc(100vw - 2rem)',
                                  maxHeight: 'calc(100vh - 2rem)',
                              }
                    }
                >
                    {!isMaximized && (
                        <>
                            <div
                                onMouseDown={(e) => handleResizeStart(e, 'top')}
                                className="absolute top-0 left-6 right-6 h-2 cursor-ns-resize z-30"
                                title="Drag to adjust height"
                            />
                            <div
                                onMouseDown={(e) => handleResizeStart(e, 'left')}
                                className="absolute top-6 left-0 bottom-6 w-2 cursor-ew-resize z-30"
                                title="Drag to adjust width"
                            />
                            <div
                                onMouseDown={(e) => handleResizeStart(e, 'top-left')}
                                className="absolute top-0 left-0 w-5 h-5 cursor-nwse-resize z-40 group flex items-center justify-center p-1"
                                title="Drag to adjust width and height"
                            >
                                <div className="w-2 h-2 border-t border-l border-zinc-300 dark:border-zinc-600 group-hover:border-[#026eff] transition-colors rounded-sm" />
                            </div>
                        </>
                    )}

                    {/* Window Header */}
                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                        <div className={`flex items-center justify-between gap-2 ${isMaximized ? 'max-w-4xl mx-auto w-full' : ''}`}>
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-sm border border-[#026eff]/20 bg-[#026eff]/10 text-[#026eff] dark:text-sky-400 flex items-center justify-center shrink-0">
                                    <RiSparklingLine className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm tracking-tight truncate">
                                            Fleet Assistant
                                        </h3>
                                        {aiStatus && (
                                            <div
                                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border text-[10px] font-medium transition-all ${
                                                    aiStatus.state === 'online'
                                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                                                        : aiStatus.state === 'quota_exceeded'
                                                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
                                                        : 'bg-zinc-100 border-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'
                                                }`}
                                                title={aiStatus.tooltip}
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-sm shrink-0 ${
                                                        aiStatus.state === 'online'
                                                            ? 'bg-emerald-500'
                                                            : aiStatus.state === 'quota_exceeded'
                                                            ? 'bg-amber-500'
                                                            : 'bg-zinc-400'
                                                    }`}
                                                />
                                                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                                                    {statusBadgeText}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Header Controls */}
                            <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowThreadsDrawer((prev) => !prev)}
                                    title="Saved conversations"
                                    className={`inline-flex items-center gap-1 px-1.5 py-1 rounded-sm text-[11px] transition cursor-pointer ${
                                        showThreadsDrawer
                                            ? 'bg-zinc-100 dark:bg-zinc-800 text-[#026eff] dark:text-sky-400'
                                            : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                    }`}
                                >
                                    <RiHistoryLine className="w-3.5 h-3.5" />
                                    {conversations.length > 0 && (
                                        <span className="font-mono text-[10px]">{conversations.length}</span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNewConversation}
                                    title="New conversation"
                                    className="p-1.5 rounded-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                                >
                                    <RiAddLine className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsMaximized((prev) => !prev)}
                                    title={isMaximized ? 'Restore window size' : 'Maximize to full page'}
                                    className="p-1.5 rounded-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                                >
                                    {isMaximized ? (
                                        <RiFullscreenExitLine className="w-4 h-4" />
                                    ) : (
                                        <RiFullscreenLine className="w-4 h-4" />
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    title="Minimize to bubble"
                                    className="p-1.5 rounded-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                                >
                                    <RiSubtractLine className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    title="Close assistant"
                                    className="p-1.5 rounded-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                                >
                                    <RiCloseLine className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Live Context & RBAC Strip */}
                        {(pageContextSummary || isTechnician) && (
                            <div className={`mt-2 flex flex-wrap items-center gap-1.5 text-[10px] ${isMaximized ? 'max-w-4xl mx-auto w-full' : ''}`}>
                                {pageContextSummary && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400">
                                        <RiEyeLine className="w-3 h-3 text-[#026eff] dark:text-sky-400 shrink-0" />
                                        <span className="truncate max-w-[260px]">{pageContextSummary}</span>
                                    </span>
                                )}
                                {isTechnician && (
                                    <span
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                        title="Financial metrics are redacted for Hardware Technicians"
                                    >
                                        <RiLockLine className="w-3 h-3 shrink-0" />
                                        <span>Financials Hidden (Technician)</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Persisted Conversation Threads Drawer */}
                    {showThreadsDrawer && (
                        <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/90 max-h-52 overflow-y-auto shrink-0">
                            <div className={`p-2.5 space-y-1 ${isMaximized ? 'max-w-4xl mx-auto w-full' : ''}`}>
                                <div className="flex items-center justify-between px-1 pb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                                    <span>Saved Threads ({conversations.length})</span>
                                    <button
                                        type="button"
                                        onClick={handleNewConversation}
                                        className="text-[#026eff] dark:text-sky-400 hover:underline cursor-pointer"
                                    >
                                        + New Thread
                                    </button>
                                </div>
                                {conversations.length === 0 ? (
                                    <p className="px-2 py-3 text-xs text-zinc-400 text-center">
                                        No saved conversations yet for this user.
                                    </p>
                                ) : (
                                    conversations.map((conv) => (
                                        <div
                                            key={conv.id}
                                            onClick={() => handleLoadConversation(conv.id)}
                                            className={`group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-sm border cursor-pointer transition ${
                                                conversationId === conv.id
                                                    ? 'border-[#026eff] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100'
                                                    : 'border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-medium truncate">{conv.title}</div>
                                                <div className="text-[10px] text-zinc-400">
                                                    {conv.messages_count} messages · {conv.updated_label || 'recent'}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteConversation(e, conv.id)}
                                                title="Delete thread"
                                                className="p-1 text-zinc-400 hover:text-rose-500 opacity-70 group-hover:opacity-100 cursor-pointer"
                                            >
                                                <RiDeleteBinLine className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Chat Messages Stream */}
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 relative bg-zinc-50/40 dark:bg-zinc-950/30"
                    >
                        <div className={`space-y-3.5 ${isMaximized ? 'max-w-4xl mx-auto w-full' : ''}`}>
                            {messages.map((msg) => {
                                const usedRemoteModel =
                                    msg.source &&
                                    msg.source !== 'local_db_engine' &&
                                    msg.source !== 'system' &&
                                    !String(msg.source).includes('local');

                                return (
                                    <div key={msg.id} id={msg.id} className="space-y-2">
                                        {msg.sender === 'user' ? (
                                            <div className="group flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-zinc-400 dark:text-zinc-500 mr-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditMessage(msg.id)}
                                                        className="hover:text-[#026eff] dark:hover:text-sky-400 flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                                                        title="Edit question"
                                                    >
                                                        <RiPencilLine className="w-3 h-3" />
                                                        <span>Edit</span>
                                                    </button>
                                                    <span>&bull;</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUnsendMessage(msg.id)}
                                                        className="hover:text-rose-500 flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                                                        title="Remove question"
                                                    >
                                                        <RiDeleteBinLine className="w-3 h-3" />
                                                        <span>Unsend</span>
                                                    </button>
                                                </div>
                                                <div className="max-w-[85%] rounded-sm border border-[#026eff] bg-[#026eff] text-white px-3.5 py-2 text-xs sm:text-[13px]">
                                                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                                    {msg.timestamp && (
                                                        <div className="text-[10px] text-blue-100/80 mt-1 text-right tabular-nums">
                                                            {msg.timestamp}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-start gap-2.5">
                                                <div className="w-6 h-6 rounded-sm border border-[#026eff]/20 bg-[#026eff]/10 text-[#026eff] dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
                                                    <RiSparklingLine className="w-3.5 h-3.5" />
                                                </div>

                                                <div className="flex-1 min-w-0 max-w-[94%] space-y-2">
                                                    <div className="rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 transition-all">
                                                        {/* Meta bar */}
                                                        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400 dark:text-zinc-500">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className="capitalize font-medium px-1.5 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                                                    {(msg.category || 'general').replace('_', ' ')}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    {usedRemoteModel ? (
                                                                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                                            <RiCheckLine className="w-3 h-3" />{' '}
                                                                            {msg.model_label || aiStatus.model_label || msg.source}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                                                            <span className="w-1.5 h-1.5 rounded-sm bg-amber-500 inline-block" />
                                                                            Live DB Grounding
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </div>

                                                            {!String(msg.id).startsWith('welcome') && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleCollapse(msg.id)}
                                                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition cursor-pointer shrink-0"
                                                                    title={collapsedMessages[msg.id] ? 'Expand response' : 'Minimize response'}
                                                                >
                                                                    <span>{collapsedMessages[msg.id] ? 'Expand' : 'Minimize'}</span>
                                                                    {collapsedMessages[msg.id] ? (
                                                                        <RiArrowDownSLine className="w-3.5 h-3.5" />
                                                                    ) : (
                                                                        <RiArrowUpSLine className="w-3.5 h-3.5" />
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Tool-Use Trace Pills */}
                                                        {!collapsedMessages[msg.id] &&
                                                            Array.isArray(msg.tool_trace) &&
                                                            msg.tool_trace.length > 0 && (
                                                                <div className="flex flex-wrap gap-1.5 mb-2.5">
                                                                    {msg.tool_trace.map((trace, tIdx) => (
                                                                        <span
                                                                            key={tIdx}
                                                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70 text-[10px] font-mono text-zinc-600 dark:text-zinc-300"
                                                                        >
                                                                            <RiDatabase2Line className="w-3 h-3 text-[#026eff] dark:text-sky-400 shrink-0" />
                                                                            <span>{trace.label || trace.tool}</span>
                                                                            {trace.summary && (
                                                                                <span className="text-zinc-400 dark:text-zinc-500">
                                                                                    · {trace.summary}
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}

                                                        {!collapsedMessages[msg.id] ? (
                                                            <>
                                                                <MarkdownRenderer content={msg.answer} />

                                                                {msg.isAuth && (
                                                                    <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                                                                        <a
                                                                            href={msg.loginUrl || '/login'}
                                                                            className="px-3 py-1.5 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                                                                        >
                                                                            Log In to Resume
                                                                        </a>
                                                                    </div>
                                                                )}

                                                                {msg.data_cards && msg.data_cards.length > 0 && (
                                                                    <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                                                                        <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 flex items-center justify-between">
                                                                            <span>Fleet Records ({msg.data_cards.length})</span>
                                                                        </div>

                                                                        <div className="grid grid-cols-1 gap-1.5">
                                                                            {msg.data_cards.map((card, cIdx) => (
                                                                                <div
                                                                                    key={cIdx}
                                                                                    className="p-2.5 rounded-sm bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                                                                                >
                                                                                    <div className="flex items-start gap-2.5 min-w-0">
                                                                                        {card.type === 'device' ? (
                                                                                            <HardwareImage
                                                                                                src={card.image_url}
                                                                                                alt={card.name}
                                                                                                className="w-9 h-9 rounded-sm object-cover bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-zinc-800"
                                                                                            />
                                                                                        ) : card.type === 'license' ? (
                                                                                            <div className="w-8 h-8 rounded-sm border border-[#026eff]/20 bg-[#026eff]/10 text-[#026eff] dark:text-sky-400 flex items-center justify-center shrink-0">
                                                                                                <RiKey2Line className="w-4 h-4" />
                                                                                            </div>
                                                                                        ) : card.type === 'employee' ? (
                                                                                            <div className="w-8 h-8 rounded-sm border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                                                                <RiUserLine className="w-4 h-4" />
                                                                                            </div>
                                                                                        ) : card.type === 'mismatch' ? (
                                                                                            <div className="w-8 h-8 rounded-sm border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                                                                                                <RiAlertLine className="w-4 h-4" />
                                                                                            </div>
                                                                                        ) : card.type === 'maintenance' ? (
                                                                                            <div className="w-8 h-8 rounded-sm border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                                                                                <RiToolsLine className="w-4 h-4" />
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div className="w-8 h-8 rounded-sm border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                                                                                <RiMoneyDollarCircleLine className="w-4 h-4" />
                                                                                            </div>
                                                                                        )}

                                                                                        <div className="min-w-0">
                                                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                                                <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100 truncate">
                                                                                                    {card.name}
                                                                                                </span>
                                                                                                {card.asset_tag && (
                                                                                                    <span className="px-1.5 py-0.2 rounded-sm border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                                                                                        {card.asset_tag}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>

                                                                                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                                                                                                {card.specs}
                                                                                            </p>

                                                                                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                                                                                                {card.location && <span>{card.location}</span>}
                                                                                                {card.meta && (
                                                                                                    <span className="font-medium text-[#026eff] dark:text-sky-400">
                                                                                                        {card.meta}
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>

                                                                                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                                                                        {isAdminOrManager && card.type === 'device' && card.status === 'available' && card.id ? (
                                                                                            <Link
                                                                                                href={`/match?device_id=${card.id}`}
                                                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-[#026eff] bg-[#026eff] hover:bg-[#0258d1] text-white text-[11px] font-medium transition"
                                                                                            >
                                                                                                <span>Assign</span>
                                                                                                <RiArrowRightLine className="w-3 h-3" />
                                                                                            </Link>
                                                                                        ) : null}

                                                                                        {card.action_url && (
                                                                                            <Link
                                                                                                href={card.action_url}
                                                                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                                                                                            >
                                                                                                <span>View</span>
                                                                                                <RiArrowRightLine className="w-3 h-3" />
                                                                                            </Link>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div
                                                                onClick={() => toggleCollapse(msg.id)}
                                                                className="py-1 text-xs text-zinc-400 dark:text-zinc-500 italic cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 select-none"
                                                            >
                                                                Response minimized. Click to expand...
                                                            </div>
                                                        )}
                                                    </div>

                                                    {!collapsedMessages[msg.id] && msg.suggested_followups && msg.suggested_followups.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                            {msg.suggested_followups.map((chip, chipIdx) => (
                                                                <button
                                                                    key={chipIdx}
                                                                    type="button"
                                                                    onClick={() => handleSend(chip)}
                                                                    className="text-left px-2.5 py-1 rounded-sm text-[11px] font-medium bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:border-[#026eff] dark:hover:border-sky-400 hover:text-[#026eff] dark:hover:text-sky-400 transition cursor-pointer"
                                                                >
                                                                    {chip}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Loading State */}
                            {isLoading && (
                                <div className="flex items-start gap-2.5">
                                    <div className="w-6 h-6 rounded-sm border border-[#026eff]/20 bg-[#026eff]/10 text-[#026eff] dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5 animate-pulse">
                                        <RiSparklingLine className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3.5 py-2.5">
                                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                            <span className="w-1.5 h-1.5 rounded-sm bg-[#026eff] animate-ping" />
                                            <span>Running read-only database analytics...</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    </div>

                    {/* Floating Skip to Bottom Button */}
                    {showScrollBottom && (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={scrollToBottom}
                                className="absolute bottom-3 right-5 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-zinc-800 dark:border-zinc-200 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-medium transition-colors cursor-pointer"
                                title="Skip to bottom"
                            >
                                <span>Scroll to bottom</span>
                                <RiArrowDownLine className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Input Area */}
                    <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                        <div className={`${isMaximized ? 'max-w-4xl mx-auto w-full' : ''}`}>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSend();
                                }}
                                className="relative flex items-center gap-2"
                            >
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputPrompt}
                                    onChange={(e) => setInputPrompt(e.target.value)}
                                    placeholder="Ask about assets, licenses, custody, warranties, or mismatches..."
                                    disabled={isLoading}
                                    className="w-full rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 px-3.5 py-2 text-xs sm:text-[13px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-[#026eff] focus:outline-none pr-10 transition"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputPrompt.trim() || isLoading}
                                    className={`absolute right-1.5 p-1.5 rounded-sm transition cursor-pointer ${
                                        inputPrompt.trim() && !isLoading
                                            ? 'bg-[#026eff] text-white hover:bg-[#0258d1]'
                                            : 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
                                    }`}
                                >
                                    <RiSendPlaneFill className="w-3.5 h-3.5" />
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
