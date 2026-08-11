/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Database, X, Trash2 } from 'lucide-react';
import { ZillowMcpClient } from '../services/ZillowMcpClient';
import { DeploymentMode } from '../config/runtime';

interface McpStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  mcpSource: 'mcp_server' | 'mock_adapter';
  deploymentMode: DeploymentMode;
  onRefreshData: () => void;
}

export const McpStatusModal: React.FC<McpStatusModalProps> = ({
  isOpen,
  onClose,
  mcpSource,
  deploymentMode,
}) => {
  const [testTool, setTestTool] = useState<'zillow_search' | 'zillow_property_details' | 'zillow_comparables' | 'zillow_market_trends'>('zillow_search');
  const [testLocation, setTestLocation] = useState('Kansas City, MO');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  if (!isOpen) return null;

  const isLive = deploymentMode !== 'static' && mcpSource === 'mcp_server';

  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await ZillowMcpClient.executeTool(testTool, {
        location: testLocation,
        zpid: '75482901',
      });
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearCache = () => {
    ZillowMcpClient.clearCache();
    alert('Property data client cache cleared successfully.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-[#f8f7f2] w-full max-w-xl rounded-2xl shadow-2xl border border-[#d6d1c4] overflow-hidden animate-in zoom-in-95 duration-150 text-xs text-[#2d3748]">
        <div className="bg-[#2d3748] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#d69e2e]" />
            <div>
              <h2 className="font-semibold text-sm">{deploymentMode === 'static' ? 'Static Market Explorer' : 'Property Data Source Inspector'}</h2>
              <p className="text-[10px] text-gray-300">{deploymentMode === 'static' ? 'GitHub Pages deployment status' : 'Live provider and compatibility-tool diagnostics'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-white p-3.5 rounded-xl border border-[#e5e2d9] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-700">Active Architecture Status:</span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                isLive ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {deploymentMode === 'static' ? 'Local Dataset Mode' : isLive ? 'Live Provider Backend' : 'Integrated Local Adapter Mode'}
              </span>
            </div>
            <p className="text-[#718096] text-[11px] leading-relaxed">
              {deploymentMode === 'static'
                ? 'This GitHub Pages build has no external API URL configured, so it uses local fixture data and browser-side analysis.'
                : isLive
                  ? 'The browser is connected to the external HTTPS backend. The initial live provider implementation uses RentCast while keeping provider credentials server-side.'
                  : 'The external backend is unavailable or not configured, so the browser has fallen back to the local fixture adapter.'}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold uppercase tracking-wider text-gray-500 text-[10px]">
              Compatibility Tool Contract
            </h3>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {[
                { name: 'zillow_search', desc: 'Search live listings/public-record sales' },
                { name: 'zillow_property_details', desc: 'Fetch a provider property record' },
                { name: 'zillow_comparables', desc: 'Client-side comp scoring' },
                { name: 'zillow_market_trends', desc: 'Fetch ZIP-level market statistics' },
              ].map(t => (
                <div key={t.name} className="bg-white p-2.5 rounded-lg border border-[#e5e2d9]">
                  <div className="font-bold text-[#2b6cb0] font-mono">{t.name}</div>
                  <div className="text-gray-500 text-[10px] mt-0.5">{t.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {deploymentMode !== 'static' && <div className="bg-white p-3.5 rounded-xl border border-[#e5e2d9] space-y-2">
            <h3 className="font-bold uppercase tracking-wider text-gray-500 text-[10px]">
              Interactive Provider Dispatch Tester
            </h3>
            <div className="flex gap-2">
              <select
                value={testTool}
                onChange={(e) => setTestTool(e.target.value as any)}
                className="bg-[#f8f7f2] border border-[#d6d1c4] p-1.5 rounded-lg text-xs font-mono"
              >
                <option value="zillow_search">zillow_search</option>
                <option value="zillow_property_details">zillow_property_details</option>
                <option value="zillow_comparables">zillow_comparables</option>
                <option value="zillow_market_trends">zillow_market_trends</option>
              </select>

              <input
                type="text"
                value={testLocation}
                onChange={(e) => setTestLocation(e.target.value)}
                placeholder="Search Query"
                className="flex-1 bg-[#f8f7f2] border border-[#d6d1c4] p-1.5 rounded-lg text-xs"
              />

              <button
                onClick={handleRunTest}
                disabled={isTesting}
                className="bg-[#2b6cb0] text-white px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors hover:bg-[#2c5282]"
              >
                {isTesting ? 'Testing...' : 'Execute Tool'}
              </button>
            </div>

            {testResult && (
              <pre className="bg-[#1a202c] text-emerald-400 p-2.5 rounded-lg font-mono text-[10px] max-h-36 overflow-y-auto mt-2">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            )}
          </div>}
        </div>

        <div className="p-4 bg-white border-t border-[#d6d1c4] flex items-center justify-between">
          <button
            onClick={handleClearCache}
            className="flex items-center gap-1.5 text-rose-600 hover:text-rose-800 font-semibold text-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Client Cache
          </button>
          <button
            onClick={onClose}
            className="bg-[#2d3748] text-white px-4 py-2 rounded-xl text-xs font-semibold"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
