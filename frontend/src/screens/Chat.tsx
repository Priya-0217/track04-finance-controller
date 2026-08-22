import React, { useState, useRef, useEffect } from 'react';
import { marked } from 'marked';
import {
  Sparkles,
  Square,
  Trash2,
  CornerDownLeft,
  Bot,
  Zap,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Plus,
  ChevronUp,
  ChevronDown,
  Mic,
  ArrowRight,
  Paperclip,
  UploadCloud,
  FileSpreadsheet,
  X,
  Loader2,
} from 'lucide-react';
import { useChatStore } from '../store/useChatStore';
import { useChatStream } from '../hooks/useChatStream';
import { useTenantStore } from '../store/useTenantStore';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { ChatActionCard } from '../components/ChatActionCard';

const PROMPT_CATEGORIES = [
  {
    title: 'Settlements & Cash Liquidity',
    icon: TrendingUp,
    color: 'text-blue-600',
    prompts: [
      { label: 'When is my next settlement due?', query: 'when is my next settlement due and what is our liquidity forecast?' },
      { label: 'Project 7-day cash forecast', query: 'project 7 day forward cash forecast with RBI holiday rollovers' },
      { label: 'Simulate MDR on ₹50,000 credit card', query: 'calculate fee for 50000 on credit card' },
    ],
  },
  {
    title: 'Reconciliation & Audit',
    icon: ShieldCheck,
    color: 'text-emerald-600',
    prompts: [
      { label: 'Why was ₹1,45,592 unmatched?', query: 'why are there unmatched transactions in our ledger?' },
      { label: 'Audit contract fee overcharges', query: 'audit our transactions for fee overcharges or MDR leakage' },
      { label: 'Show active disputes & holdbacks', query: 'show active payment disputes and holdback reserves' },
    ],
  },
  {
    title: 'Autonomous 1-Click Actions',
    icon: Zap,
    color: 'text-amber-600',
    prompts: [
      { label: 'Reconcile batch & close books', query: 'reconcile current batch and close today books' },
      { label: 'Export QuickBooks journal entries', query: 'export quickbooks general ledger journal entries with GST' },
      { label: 'Generate executive treasury report', query: 'generate executive treasury sign-off report' },
    ],
  },
];

export const Chat: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [showPromptMenu, setShowPromptMenu] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);
  const [settlementFile, setSettlementFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const ledgerInputRef = useRef<HTMLInputElement>(null);
  const settleInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { messages, addMessage, clearMessages } = useChatStore();
  const { sendMessage, stopStreaming, isStreaming } = useChatStream();
  const { activeMerchantId, activeRole } = useTenantStore();

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
  });

  const { data: metrics } = useQuery({
    queryKey: ['metrics', activeMerchantId],
    queryFn: api.getMetrics,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if (!inputValue.trim() || isStreaming) return;
    const text = inputValue;
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setShowPromptMenu(false);
    sendMessage(text, activeMerchantId, activeRole);
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputValue('');
    setShowPromptMenu(false);
    sendMessage(prompt, activeMerchantId, activeRole);
  };

  const handleUploadAndReconcile = async () => {
    if (!ledgerFile || !settlementFile) {
      setUploadError('Please select both a ledger CSV and a settlement CSV file.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('ledger_file', ledgerFile);
    formData.append('settlement_file', settlementFile);
    formData.append('merchant_id', activeMerchantId);

    // Add user message in chat
    addMessage({
      text: `📎 Uploaded files for live reconciliation:\n- **Ledger:** \`${ledgerFile.name}\` (${(ledgerFile.size / 1024).toFixed(1)} KB)\n- **Settlement:** \`${settlementFile.name}\` (${(settlementFile.size / 1024).toFixed(1)} KB)`,
      sender: 'user',
    });

    setShowUploadModal(false);
    setLedgerFile(null);
    setSettlementFile(null);

    try {
      const response = await fetch('/api/chat/upload-and-reconcile', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || `Upload failed with status ${response.status}`);
      }

      const data = await response.json();

      // Add AI assistant response with action cards
      addMessage({
        text: data.reply,
        sender: 'ai',
        tool_called: 'finance_run_reconciliation',
        action_cards: data.action_cards,
      });

      // Refresh global metrics & reconciliation data across all tabs
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['reconcile-data'] });
      queryClient.invalidateQueries({ queryKey: ['forecast'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    } catch (err: any) {
      addMessage({
        text: `⚠️ **Reconciliation Upload Error:** ${err.message || 'Failed to process files'}. Please verify CSV formatting.`,
        sender: 'ai',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const renderMarkdownSafe = (content: string) => {
    try {
      return { __html: marked.parse(content || '') as string };
    } catch {
      return { __html: content.replace(/\n/g, '<br />') };
    }
  };

  const providerName = config?.llm_provider?.toUpperCase() || 'OLLAMA';

  return (
    <div className="flex flex-col flex-1 h-[calc(100vh-3.5rem)] relative bg-[#fafbfc] text-gray-900">
      {/* Top Floating Utility Header */}
      <div className="w-full max-w-3xl mx-auto px-4 py-2.5 flex justify-between items-center z-10">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-xs text-gray-900 font-mono flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Agentic Finance Copilot</span>
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] bg-gray-100 text-gray-700 border border-gray-200">
            {providerName} · MCP Armed
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={clearMessages}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-[4px] bg-white border border-gray-200 text-gray-600 text-[11px] font-mono hover:bg-gray-50 hover:text-gray-900 transition shadow-sm"
            title="Clear Chat History"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 custom-scrollbar">
        <div className="max-w-3xl mx-auto w-full pt-2 pb-44 space-y-6">
          {/* Razorpay Agentic Command Briefing (when empty) */}
          {messages.length <= 1 && (
            <div className="space-y-4 py-2">
              {/* Proactive Greeting Pill */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-gray-900 via-gray-800 to-black text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-4 h-4 text-emerald-400" />
                    <span className="font-semibold text-xs tracking-tight text-white">
                      Good morning! Live Treasury Copilot is active for {activeMerchantId}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300">
                    Auto-Match precision is <strong>{metrics?.auto_match_rate_pct ?? 99.01}%</strong>. 11 MCP tools armed for instant actions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleQuickPrompt('reconcile current batch and close today books')}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs font-mono transition flex items-center space-x-1.5 shrink-0 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>1-Click Books Close</span>
                </button>
              </div>

              {/* Categorized Razorpay Agent Studio Directives */}
              <div className="space-y-3">
                <div className="text-[11px] font-mono uppercase text-gray-400 font-bold tracking-wider">
                  Agent Studio Action Directives
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {PROMPT_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    return (
                      <div key={cat.title} className="p-3.5 rounded-xl bg-white border border-gray-200/90 shadow-sm space-y-2">
                        <div className="flex items-center space-x-1.5">
                          <Icon className={`w-4 h-4 ${cat.color}`} />
                          <span className="font-semibold text-xs text-gray-900">{cat.title}</span>
                        </div>
                        <div className="space-y-1.5">
                          {cat.prompts.map((p) => (
                            <button
                              key={p.label}
                              type="button"
                              onClick={() => handleQuickPrompt(p.query)}
                              className="w-full text-left p-2 rounded-lg bg-gray-50 hover:bg-gray-100/90 border border-gray-100 text-gray-800 text-[11px] leading-tight transition flex items-center justify-between group"
                            >
                              <span className="group-hover:text-black font-medium truncate pr-1">{p.label}</span>
                              <CornerDownLeft className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Render All Chat Messages */}
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}
              >
                {/* Author Label & Metadata */}
                <div className="flex items-center space-x-2 text-[11px] text-gray-400 font-mono px-1">
                  <span>{isUser ? 'You' : 'Razorpay Agentic Copilot'}</span>
                  {msg.tool_called && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-black text-white font-mono flex items-center space-x-1">
                      <Zap className="w-2.5 h-2.5 text-emerald-400" />
                      <span>mcp::{msg.tool_called}</span>
                    </span>
                  )}
                  {msg.latencySec && (
                    <span>{msg.latencySec}s</span>
                  )}
                </div>

                {/* Message Body */}
                <div
                  className={`text-xs sm:text-sm leading-relaxed transition-all ${
                    isUser
                      ? 'bg-black text-white px-4 py-2.5 rounded-2xl max-w-[85%] font-sans shadow-sm'
                      : 'w-full text-gray-900 bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    <div className="space-y-3">
                      <div
                        className="markdown-content text-gray-900"
                        dangerouslySetInnerHTML={renderMarkdownSafe(msg.text)}
                      />

                      {/* Embedded One-Click Action Cards */}
                      {msg.action_cards && msg.action_cards.length > 0 && (
                        <ChatActionCard cards={msg.action_cards} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Streaming Loading Indicator */}
          {isStreaming && (
            <div className="flex items-center space-x-2 pt-2 text-xs text-gray-500 font-mono animate-pulse">
              <div className="w-4 h-4 text-amber-600 animate-spin flex items-center justify-center font-bold text-sm">
                ✱
              </div>
              <span>Invoking MCP Tool &amp; Computing Mathematical Grounding...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Upload 2 Files Reconcile Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Upload 2 Files to Reconcile</h3>
                  <p className="text-xs text-gray-500">Analyze ledger vs bank settlement with 4-tier matching</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadError && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {uploadError}
              </div>
            )}

            <div className="space-y-3">
              {/* File 1: Ledger CSV */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center justify-between">
                  <span>1. Internal Ledger CSV</span>
                  <span className="text-[10px] text-gray-400 font-mono">txn_id, amount, merchant_id</span>
                </label>
                <div
                  onClick={() => ledgerInputRef.current?.click()}
                  className={`p-3 rounded-xl border-2 border-dashed transition cursor-pointer flex items-center justify-between ${
                    ledgerFile
                      ? 'border-emerald-400 bg-emerald-50/50'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <FileSpreadsheet className={`w-4 h-4 ${ledgerFile ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <span className="text-xs text-gray-800 truncate font-medium">
                      {ledgerFile ? ledgerFile.name : 'Select or drop ledger.csv'}
                    </span>
                  </div>
                  {ledgerFile && (
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      {(ledgerFile.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                  <input
                    ref={ledgerInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setLedgerFile(e.target.files[0]);
                    }}
                  />
                </div>
              </div>

              {/* File 2: Settlement CSV */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700 flex items-center justify-between">
                  <span>2. Bank Settlement CSV</span>
                  <span className="text-[10px] text-gray-400 font-mono">payout_ref, net_amount, fee</span>
                </label>
                <div
                  onClick={() => settleInputRef.current?.click()}
                  className={`p-3 rounded-xl border-2 border-dashed transition cursor-pointer flex items-center justify-between ${
                    settlementFile
                      ? 'border-emerald-400 bg-emerald-50/50'
                      : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                  }`}
                >
                  <div className="flex items-center space-x-2 truncate">
                    <FileSpreadsheet className={`w-4 h-4 ${settlementFile ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <span className="text-xs text-gray-800 truncate font-medium">
                      {settlementFile ? settlementFile.name : 'Select or drop settlement.csv'}
                    </span>
                  </div>
                  {settlementFile && (
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      {(settlementFile.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                  <input
                    ref={settleInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setSettlementFile(e.target.files[0]);
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadAndReconcile}
                disabled={!ledgerFile || !settlementFile || isUploading}
                className="px-4 py-1.5 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-semibold transition flex items-center space-x-1.5 shadow-sm disabled:bg-gray-200 disabled:text-gray-400 cursor-pointer disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Reconciling &amp; Explaining...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Reconcile &amp; Explain with AI</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Input Dock matching Screenshot in Light Fintech Theme */}
      <div className="fixed bottom-4 left-0 right-0 z-30 px-4 pointer-events-none">
        <div className="max-w-3xl mx-auto w-full pointer-events-auto">
          {/* Quick Prompts Flyout Menu */}
          {showPromptMenu && (
            <div className="mb-2 p-2 bg-white rounded-xl border border-gray-200 shadow-xl space-y-1">
              <div className="px-2 py-1 text-[10px] font-mono uppercase text-gray-400 font-semibold tracking-wider flex items-center justify-between">
                <span>Quick Prompts &amp; Actions</span>
                <button
                  type="button"
                  onClick={() => {
                    setShowPromptMenu(false);
                    setShowUploadModal(true);
                  }}
                  className="text-[10px] font-mono text-indigo-600 hover:underline flex items-center space-x-1"
                >
                  <Paperclip className="w-3 h-3" />
                  <span>Upload 2 CSVs</span>
                </button>
              </div>
              {PROMPT_CATEGORIES.flatMap((c) => c.prompts).slice(0, 5).map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleQuickPrompt(p.query)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs text-gray-700 hover:bg-gray-100 hover:text-black transition flex items-center justify-between"
                >
                  <span>{p.label}</span>
                  <CornerDownLeft className="w-3 h-3 text-gray-400" />
                </button>
              ))}
            </div>
          )}

          {/* Floating Card Input Field matching Screenshot */}
          <div className="bg-white rounded-2xl border border-gray-300/90 shadow-2xl p-3 space-y-2 ring-1 ring-black/5 transition-all">
            {/* Top Header Row */}
            <div className="flex items-center justify-between text-xs text-gray-700 px-1 font-medium select-none">
              <span className="flex items-center space-x-1.5 text-gray-800 text-[13px]">
                {isStreaming && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                <span>{isStreaming ? '1 task running' : '11 MCP Tools Armed'}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowPromptMenu(!showPromptMenu)}
                className="text-gray-400 hover:text-gray-900 transition p-0.5"
                title="Toggle Directives"
              >
                {showPromptMenu ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>

            {/* Expanding Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything, @ to mention, / for actions"
              className="w-full max-h-36 resize-none bg-transparent border-0 py-1 px-1 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-0 focus:outline-none custom-scrollbar leading-relaxed"
            />

            {/* Bottom Toolbar Row */}
            <div className="flex items-center justify-between pt-1">
              {/* Left Side: + button, Upload Paperclip, Model Selector, MCP Status */}
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setShowPromptMenu(!showPromptMenu)}
                  className="p-1 text-gray-400 hover:text-black transition rounded-md hover:bg-gray-100"
                  title="Add Context / Actions"
                >
                  <Plus className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="p-1 text-gray-400 hover:text-black transition rounded-md hover:bg-gray-100 flex items-center space-x-1"
                  title="Upload Ledger & Settlement CSVs to Reconcile"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/settings')}
                  className="flex items-center space-x-1 text-xs text-gray-800 hover:text-black px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200/80 transition font-medium"
                  title="Configure LLM in Settings"
                >
                  <span>
                    {config?.model_id ? `${config.model_id}` : 'Gemini 3.7 Flash Medium'}
                  </span>
                  <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                </button>

                <div className="hidden sm:flex items-center space-x-1 text-xs text-emerald-600 font-mono pl-1">
                  <Zap className="w-3 h-3 text-emerald-600" />
                  <span>MCP Ready</span>
                </div>
              </div>

              {/* Right Side: Mic icon & Send Arrow */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  className="p-1.5 text-gray-400 hover:text-black transition rounded-lg hover:bg-gray-100"
                  title="Voice input"
                >
                  <Mic className="w-4 h-4" />
                </button>

                {isStreaming ? (
                  <button
                    type="button"
                    onClick={stopStreaming}
                    className="w-7 h-7 rounded-full bg-black hover:bg-gray-800 text-white flex items-center justify-center transition shadow-sm"
                    title="Stop streaming"
                  >
                    <Square className="w-3 h-3 fill-white" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!inputValue.trim()}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                      inputValue.trim()
                        ? 'bg-black text-white hover:bg-gray-800 shadow-md'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Send message"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
