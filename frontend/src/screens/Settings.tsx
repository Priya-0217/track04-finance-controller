import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { toast } from '../store/useToastStore';
import { Activity, CheckCircle2, AlertCircle, RefreshCw, Zap, ShieldAlert } from 'lucide-react';
import type { TestLlmRes } from '../types/api';

export const Settings: React.FC = () => {
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState('ollama');
  const [modelId, setModelId] = useState('ollama/llama3.2:latest');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [merchantId, setMerchantId] = useState('merch_001');
  const [tokenBudget, setTokenBudget] = useState(1024);

  const [testResult, setTestResult] = useState<TestLlmRes | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: api.getConfig,
  });

  useEffect(() => {
    if (config) {
      setProvider(config.llm_provider || 'ollama');
      setModelId(config.model_id || 'ollama/llama3.2:latest');
      setMerchantId(config.default_merchant_id || 'merch_001');
      setTokenBudget(config.token_budget || 1024);
    }
  }, [config]);

  // Provider presets helper
  const handleProviderChange = (newProv: string) => {
    setProvider(newProv);
    if (newProv === 'ollama') {
      setModelId('ollama/llama3.2:latest');
    } else if (newProv === 'gemini') {
      setModelId('gemini/gemini-2.5-flash');
    } else if (newProv === 'openai') {
      setModelId('gpt-4o-mini');
    } else if (newProv === 'anthropic') {
      setModelId('claude-3-5-sonnet');
    } else if (newProv === 'groq') {
      setModelId('llama-3.3-70b-versatile');
    }
    setTestResult(null); // Clear previous test on provider change
  };

  const updateMutation = useMutation({
    mutationFn: api.updateConfig,
    onSuccess: () => {
      toast.success('Settings Saved', 'LLM Provider and token budget configuration updated.');
      setApiKey(''); // Clear secret input
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
    onError: (err: Error) => {
      toast.error('Save Failed', err.message);
    },
  });

  const testMutation = useMutation({
    mutationFn: api.testLlmConfig,
    onSuccess: (data) => {
      setTestResult(data);
      if (data.status === 'connected') {
        toast.success('LLM Online', `${data.provider.toUpperCase()} responded in ${data.latency_ms}ms.`);
      } else {
        toast.error('LLM Test Failed', data.detail);
      }
    },
    onError: (err: Error) => {
      setTestResult({
        status: 'error',
        provider,
        model_id: modelId,
        latency_ms: 0,
        reply: '',
        detail: err.message,
      });
      toast.error('Test Failed', err.message);
    },
  });

  const handleTestConnection = () => {
    testMutation.mutate({
      llm_provider: provider,
      model_id: modelId,
      api_key: apiKey.trim() || undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: {
      llm_provider: string;
      model_id: string;
      default_merchant_id: string;
      token_budget: number;
      api_key?: string;
    } = {
      llm_provider: provider,
      model_id: modelId,
      default_merchant_id: merchantId,
      token_budget: tokenBudget,
    };
    if (apiKey.trim()) {
      payload.api_key = apiKey.trim();
    }
    updateMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight">
            LLM &amp; Provider Settings
          </h1>
          <p className="text-xs text-gray-500">
            Configure multi-model routing (Local Ollama, Gemini, OpenAI, Claude) and token budgets
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Form */}
        <div className="card-box p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-900">LLM Provider Configuration</h2>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testMutation.isPending}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-[4px] bg-white border border-gray-300 hover:border-black text-gray-800 text-xs font-mono font-medium hover:bg-gray-50 transition shadow-sm disabled:opacity-50"
            >
              {testMutation.isPending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-black" />
                  <span>Pinging Model...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span>Test Connection</span>
                </>
              )}
            </button>
          </div>

          {/* Real-Time Test Diagnostic Banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                testResult.status === 'connected'
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50/80 border-rose-200 text-rose-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-bold">
                  {testResult.status === 'connected' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>LLM ONLINE &amp; RESPONDING</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>CONNECTION REJECTED</span>
                    </>
                  )}
                </div>
                {testResult.latency_ms > 0 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/70 border border-current">
                    Latency: {testResult.latency_ms}ms
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">{testResult.detail}</p>
              {testResult.reply && (
                <div className="text-[10px] font-mono bg-white/60 p-1.5 rounded border border-current/20">
                  Probe Output: <span className="font-semibold">{testResult.reply}</span>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="set-provider" className="block text-xs font-medium text-gray-700 mb-1">
                Active AI Provider
              </label>
              <select
                id="set-provider"
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-[4px] font-mono focus:outline-none focus:border-black"
              >
                <option value="ollama">Local Ollama (llama3.2 / qwen2.5 - No API Key Needed)</option>
                <option value="gemini">Google Gemini (gemini-2.5-flash / gemini-1.5-pro)</option>
                <option value="openai">OpenAI (gpt-4o / gpt-4o-mini)</option>
                <option value="anthropic">Anthropic Claude (claude-3-5-sonnet)</option>
                <option value="groq">Groq (llama-3.3-70b-versatile)</option>
              </select>
            </div>

            <div>
              <label htmlFor="set-model-id" className="block text-xs font-medium text-gray-700 mb-1">
                Model Identifier
              </label>
              <input
                type="text"
                id="set-model-id"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                disabled={isLoading}
                className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-[4px] font-mono focus:outline-none focus:border-black"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="set-api-key" className="block text-xs font-medium text-gray-700">
                  API Key {provider === 'ollama' ? '(Optional for Local)' : '(Required for Cloud)'}
                </label>
                <span className="text-[10px] font-mono">
                  {config?.has_api_key ? (
                    <span className="text-emerald-600 font-semibold">●●●●●●●● (Configured)</span>
                  ) : (
                    <span className="text-gray-400">Not set</span>
                  )}
                </span>
              </div>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  id="set-api-key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    provider === 'ollama'
                      ? 'No API key needed for local Ollama'
                      : 'Enter API key to update...'
                  }
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-[4px] font-mono pr-14 focus:outline-none focus:border-black"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-2 px-1.5 py-0.5 text-[10px] font-mono text-gray-500 hover:text-black"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="set-merchant-id" className="block text-xs font-medium text-gray-700 mb-1">
                  Default Merchant ID
                </label>
                <input
                  type="text"
                  id="set-merchant-id"
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-[4px] font-mono focus:outline-none focus:border-black"
                />
              </div>
              <div>
                <label htmlFor="set-token-budget" className="block text-xs font-medium text-gray-700 mb-1">
                  Token Knapsack Budget
                </label>
                <input
                  type="number"
                  id="set-token-budget"
                  value={tokenBudget}
                  onChange={(e) => setTokenBudget(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-[4px] font-mono focus:outline-none focus:border-black"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2.5 pt-2">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex-1 py-2 rounded-[4px] bg-black text-white text-xs font-medium hover:bg-gray-800 transition disabled:opacity-50 shadow-sm"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </button>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testMutation.isPending}
                className="px-4 py-2 rounded-[4px] bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-mono font-medium transition"
              >
                Test
              </button>
            </div>
          </form>
        </div>

        {/* Operational Grounding Notes */}
        <div className="card-box p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Operational Grounding Architecture</h2>
          <div className="space-y-3 text-xs text-gray-600">
            <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-[6px] space-y-1.5">
              <span className="font-semibold text-gray-900 flex items-center space-x-1.5">
                <Activity className="w-4 h-4 text-emerald-600" />
                <span>Deterministic Fallback Layer</span>
              </span>
              <p className="leading-relaxed">
                If an external LLM endpoint encounters network rate limits, missing credentials, or cold starts, the controller kernel automatically synthesizes answers directly from verified SQLite records with zero mathematical hallucination.
              </p>
            </div>

            <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-[6px] space-y-1.5">
              <span className="font-semibold text-gray-900 flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-indigo-600" />
                <span>Local Privacy &amp; Offline Air-Gap (Ollama)</span>
              </span>
              <p className="leading-relaxed">
                Local Ollama queries stream directly via localhost:11434 with persistent background RAM keep-alive, guaranteeing financial ledger records and customer PII never leave your local infrastructure.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
