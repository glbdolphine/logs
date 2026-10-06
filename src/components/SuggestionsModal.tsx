import React, { useState } from 'react';
import { FieldSuggestionsMap, LogFieldKey } from '../types';
import { X, Plus, Search, Trash2 } from 'lucide-react';

interface SuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: FieldSuggestionsMap;
  onUpdateSuggestions: (updated: FieldSuggestionsMap) => void;
}

const FIELD_LABELS: Record<LogFieldKey, string> = {
  resellerName: 'Reseller Name',
  callerPhone: 'Caller Phone',
  requestType: 'Request Type',
  customerName: 'Customer Name',
  nmsId: 'NMS ID / Customer ID',
  issueFound: 'Issue Found',
  missingWrongDetails: 'Missing / Wrong Details',
  actionTaken: 'Action Taken',
  reasonForAction: 'REASON for Action',
  resellerInformed: 'Reseller Informed?',
  followUpNeeded: 'Follow-up Needed?',
  status: 'Status',
  supervisorInformed: 'Supervisor Informed',
  remarks: 'Remarks',
  mac: 'MAC Address',
};

export const SuggestionsModal: React.FC<SuggestionsModalProps> = ({
  isOpen,
  onClose,
  suggestions,
  onUpdateSuggestions,
}) => {
  const [activeField, setActiveField] = useState<LogFieldKey>('resellerName');
  const [newValue, setNewValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const currentList = suggestions[activeField] || [];
  const filteredList = currentList.filter((item) =>
    item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const val = newValue.trim();
    if (!val) return;

    if (currentList.some((s) => s.toLowerCase() === val.toLowerCase())) {
      setNewValue('');
      return;
    }

    const updated = {
      ...suggestions,
      [activeField]: [val, ...currentList],
    };
    onUpdateSuggestions(updated);
    setNewValue('');
  };

  const handleRemove = (itemToRemove: string) => {
    const updated = {
      ...suggestions,
      [activeField]: currentList.filter((item) => item !== itemToRemove),
    };
    onUpdateSuggestions(updated);
  };

  const totalSuggestions = Object.values(suggestions).reduce((acc, list) => acc + (list?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Saved Field Values ({totalSuggestions})
            </h2>
            <p className="text-xs text-slate-500">
              Values retained from past entries for suggestions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Fields List */}
          <div className="w-48 border-r border-slate-200 bg-slate-50 p-2 overflow-y-auto space-y-0.5">
            {(Object.keys(FIELD_LABELS) as LogFieldKey[]).map((key) => {
              const count = suggestions[key]?.length || 0;
              const isActive = activeField === key;
              return (
                <button
                  key={key}
                  onClick={() => {
                    setActiveField(key);
                    setSearchTerm('');
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-white text-slate-900 font-medium border border-slate-200 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span className="truncate">{FIELD_LABELS[key]}</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right: Values */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden bg-white">
            <div className="flex items-center justify-between gap-3 mb-3">
              <span className="text-xs font-semibold text-slate-800">
                {FIELD_LABELS[activeField]}
              </span>

              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter..."
                  className="pl-6 pr-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:border-slate-400 w-36"
                />
              </div>
            </div>

            {/* Quick Add */}
            <form onSubmit={handleAdd} className="flex gap-2 mb-3">
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Add custom value..."
                className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/20"
              />
              <button
                type="submit"
                disabled={!newValue.trim()}
                className="px-2.5 py-1 text-xs font-medium text-white bg-brand-800 hover:bg-brand-900 rounded disabled:opacity-40"
              >
                Add
              </button>
            </form>

            {/* Values list */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No saved values.
                </div>
              ) : (
                filteredList.map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 text-xs transition-colors group"
                  >
                    <span className="text-slate-800 truncate pr-3 select-all">
                      {item}
                    </span>
                    <button
                      onClick={() => handleRemove(item)}
                      className="sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1.5 -m-1 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
