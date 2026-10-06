import React, { useState, useEffect, useMemo } from 'react';
import { LogEntry, FieldSuggestionsMap, Reseller } from '../types';
import { SuggestionInput } from './SuggestionInput';
import { ConfirmDialog } from './ConfirmDialog';
import { findDuplicates, describeLog } from '../utils/duplicates';
import { matchReseller } from '../utils/resellers';
import { addDaysIso } from '../utils/followUps';

import { ArrowLeft, AlertTriangle } from 'lucide-react';

function formatEntryDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface LogFormProps {
  initialData?: LogEntry | null;
  nextLogNo: number;
  suggestions: FieldSuggestionsMap;
  logs: LogEntry[];
  resellers: Reseller[];
  onSave: (entry: LogEntry, andCreateAnother?: boolean) => void;
  onCancel: () => void;
}

export const LogForm: React.FC<LogFormProps> = ({
  initialData,
  nextLogNo,
  suggestions,
  logs,
  resellers,
  onSave,
  onCancel,
}) => {
  const isEditing = Boolean(initialData?.id);

  const [formData, setFormData] = useState<Partial<LogEntry>>({
    logNo: initialData ? initialData.logNo : nextLogNo,
    date: initialData ? initialData.date : formatEntryDate(new Date()),
    resellerName: initialData?.resellerName || '',
    resellerId: initialData?.resellerId || '',
    followUpDate: initialData?.followUpDate || '',
    callerPhone: initialData?.callerPhone || '',
    requestType: initialData?.requestType || 'New User ID',
    customerName: initialData?.customerName || '',
    nmsId: initialData?.nmsId || '',
    issueFound: initialData?.issueFound || '',
    missingWrongDetails: initialData?.missingWrongDetails || '',
    actionTaken: initialData?.actionTaken || '',
    reasonForAction: initialData?.reasonForAction || '',
    resellerInformed: initialData?.resellerInformed || 'Yes - phone',
    followUpNeeded: initialData?.followUpNeeded || 'Yes',
    status: initialData?.status || 'Pending - waiting for reseller',
    supervisorInformed: initialData?.supervisorInformed || 'I informed my superiors',
    remarks: initialData?.remarks || '',
    mac: initialData?.mac || '',
    edcNo: initialData?.edcNo || '',
    routerSerial: initialData?.routerSerial || '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData((prev) => ({
        ...prev,
        logNo: nextLogNo,
        date: prev.date || formatEntryDate(new Date()),
      }));
    }
  }, [initialData, nextLogNo]);

  const updateField = (field: keyof LogEntry, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const [pendingSave, setPendingSave] = useState<{ entry: LogEntry; another: boolean } | null>(null);

  // Other logs that already use this MAC / router serial / NMS ID (live, while typing).
  const dups = useMemo(
    () => findDuplicates({ id: initialData?.id, mac: formData.mac, routerSerial: formData.routerSerial, nmsId: formData.nmsId }, logs),
    [initialData?.id, formData.mac, formData.routerSerial, formData.nmsId, logs],
  );

  const activeResellers = useMemo(() => resellers.filter((r) => r.active), [resellers]);
  const currentReseller = useMemo(
    () => matchReseller({ resellerId: formData.resellerId, resellerName: formData.resellerName }, resellers),
    [formData.resellerId, formData.resellerName, resellers],
  );

  const pickReseller = (id: string) => {
    if (id === '__keep__') return;
    const r = resellers.find((x) => x.id === id);
    if (!r) { setFormData((p) => ({ ...p, resellerId: '', resellerName: '' })); return; }
    setFormData((p) => ({
      ...p,
      resellerId: r.id,
      resellerName: r.name,
      callerPhone: p.callerPhone?.trim() ? p.callerPhone : r.phone || p.callerPhone || '',
    }));
  };

  const commit = (entry: LogEntry, andCreateAnother: boolean) => {
    onSave(entry, andCreateAnother);
    if (andCreateAnother) {
      setFormData((prev) => ({
        logNo: Number(prev.logNo || nextLogNo) + 1,
        date: formatEntryDate(new Date()),
        resellerName: prev.resellerName || '',
        resellerId: prev.resellerId || '',
        followUpDate: '',
        callerPhone: prev.callerPhone || '',
        requestType: prev.requestType || 'New User ID',
        customerName: '',
        nmsId: '',
        issueFound: '',
        missingWrongDetails: '',
        actionTaken: '',
        reasonForAction: '',
        resellerInformed: prev.resellerInformed || 'Yes - phone',
        followUpNeeded: 'Yes',
        status: 'Pending - waiting for reseller',
        supervisorInformed: prev.supervisorInformed || 'I informed my superiors',
        remarks: '',
        mac: '',
        edcNo: '',
        routerSerial: '',
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent, andCreateAnother = false) => {
    e.preventDefault();

    const finalizedEntry: LogEntry = {
      id: initialData?.id || crypto.randomUUID(),
      logNo: formData.logNo || nextLogNo,
      date: formData.date?.trim() || formatEntryDate(new Date()),
      resellerName: formData.resellerName?.trim() || '',
      resellerId: currentReseller?.id || '',
      followUpDate: formData.followUpDate || '',
      callerPhone: formData.callerPhone?.trim() || '',
      requestType: formData.requestType?.trim() || 'New User ID',
      customerName: formData.customerName?.trim() || '',
      nmsId: formData.nmsId?.trim() || '',
      issueFound: formData.issueFound?.trim() || '',
      missingWrongDetails: formData.missingWrongDetails?.trim() || '',
      actionTaken: formData.actionTaken?.trim() || '',
      reasonForAction: formData.reasonForAction?.trim() || '',
      resellerInformed: formData.resellerInformed?.trim() || '',
      followUpNeeded: formData.followUpNeeded?.trim() || '',
      status: formData.status?.trim() || 'Pending - waiting for reseller',
      supervisorInformed: formData.supervisorInformed?.trim() || '',
      remarks: formData.remarks?.trim() || '',
      mac: formData.mac?.trim() || '',
      edcNo: formData.edcNo?.trim() || '',
      routerSerial: formData.routerSerial?.trim() || '',
      formReceivedAt: initialData?.formReceivedAt || '',
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: initialData?.createdBy,
      updatedBy: initialData?.updatedBy,
      history: initialData?.history,
    };

    if (dups.length > 0) {
      setPendingSave({ entry: finalizedEntry, another: andCreateAnother });
      return;
    }
    commit(finalizedEntry, andCreateAnother);
  };

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="w-full space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-sm font-semibold text-slate-900">
            {isEditing ? `Edit Log #${formData.logNo}` : 'New Reseller Request Log'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-200 rounded hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>

          {!isEditing && (
            <button
              type="button"
              onClick={(e) => handleSubmit(e, true)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
            >
              Save & Next
            </button>
          )}

          <button
            type="submit"
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-brand-800 hover:bg-brand-900 rounded transition-colors"
          >
            {isEditing ? 'Save Changes' : 'Save'}
          </button>
        </div>
      </div>

      {dups.length > 0 && (
        <div className="flex gap-2 items-start text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-lg px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px text-amber-600" />
          <div className="space-y-1 min-w-0">
            <div className="font-semibold">Already used on another log</div>
            {dups.map((d) => (
              <div key={d.field} className="break-words">
                {d.label} <span className="font-mono font-semibold">{d.value}</span> is on{' '}
                {d.others.slice(0, 3).map(describeLog).join('; ')}
                {d.others.length > 3 ? ` and ${d.others.length - 3} more` : ''}.
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!pendingSave}
        title="Duplicate found"
        message={dups.map((d) => `${d.label} ${d.value} is already on ${describeLog(d.others[0])}.`).join(' ') + ' Save anyway?'}
        confirmLabel="Save anyway"
        isDestructive={false}
        onCancel={() => setPendingSave(null)}
        onConfirm={() => { if (pendingSave) commit(pendingSave.entry, pendingSave.another); setPendingSave(null); }}
      />

      {/* Form Content */}
      <div className="bg-white p-5 sm:p-6 rounded-lg border border-slate-200 shadow-xs space-y-4">
        {/* Row 1: Log No & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Log No. <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              value={formData.logNo ?? ''}
              onChange={(e) => updateField('logNo', parseInt(e.target.value, 10) || 1)}
              required
              className="w-full px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-slate-300 rounded font-mono focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/20"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">
                Date <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => updateField('date', formatEntryDate(new Date()))}
                className="text-[11px] text-slate-500 hover:text-slate-800"
              >
                Today
              </button>
            </div>
            <input
              type="text"
              value={formData.date || ''}
              onChange={(e) => updateField('date', e.target.value)}
              placeholder="e.g. 01 Oct 2026"
              required
              className="w-full px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/20"
            />
          </div>
        </div>

        {/* Row 2: Reseller, Phone, Request Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
          {resellers.length > 0 ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reseller Name <span className="text-rose-500">*</span>
              </label>
              <select
                value={currentReseller?.id || (formData.resellerName ? '__keep__' : '')}
                onChange={(e) => pickReseller(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/20"
              >
                <option value="">Select reseller…</option>
                {!currentReseller && formData.resellerName && (
                  <option value="__keep__">{formData.resellerName} (not in list)</option>
                )}
                {activeResellers.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}{r.area && !r.name.includes(r.area) ? ` · ${r.area}` : ''}</option>
                ))}
                {currentReseller && !currentReseller.active && (
                  <option value={currentReseller.id}>{currentReseller.name} (inactive)</option>
                )}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">Add or edit resellers in the Reseller List tab.</p>
            </div>
          ) : (
            <SuggestionInput
              name="resellerName"
              label="Reseller Name"
              value={formData.resellerName || ''}
              onChange={(val) => updateField('resellerName', val)}
              suggestions={suggestions.resellerName}
              placeholder="e.g. Shabul- Balaganj"
              required
            />
          )}

          <SuggestionInput
            name="callerPhone"
            label="Caller Phone"
            type="tel"
            value={formData.callerPhone || ''}
            onChange={(val) => updateField('callerPhone', val)}
            suggestions={suggestions.callerPhone}
            placeholder="e.g. +880 1680-945894"
          />

          <SuggestionInput
            name="requestType"
            label="Request Type"
            value={formData.requestType || ''}
            onChange={(val) => updateField('requestType', val)}
            suggestions={suggestions.requestType}
            placeholder="e.g. New User ID"
            required
          />
        </div>

        {/* Row 3: Customer, Issue, Missing Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-100">
          <SuggestionInput
            name="customerName"
            label="Customer Name"
            value={formData.customerName || ''}
            onChange={(val) => updateField('customerName', val)}
            suggestions={suggestions.customerName}
            placeholder="e.g. Hasampur Govt. Primary School"
            required
          />

          <SuggestionInput
            name="nmsId"
            label="NMS ID / Customer ID"
            value={formData.nmsId || ''}
            onChange={(val) => updateField('nmsId', val)}
            suggestions={suggestions.nmsId}
            placeholder="e.g. 100245"
          />

          <SuggestionInput
            name="issueFound"
            label="Issue Found"
            value={formData.issueFound || ''}
            onChange={(val) => updateField('issueFound', val)}
            suggestions={suggestions.issueFound}
            placeholder="e.g. Same router at two institute"
            isTextarea
            rows={2}
          />

          <SuggestionInput
            name="missingWrongDetails"
            label="Missing / Wrong Details"
            value={formData.missingWrongDetails || ''}
            onChange={(val) => updateField('missingWrongDetails', val)}
            suggestions={suggestions.missingWrongDetails}
            placeholder="e.g. They previously used the same router in Radhakona Govt. Primary School"
            isTextarea
            rows={2}
          />
        </div>

        {/* Row 4: Action Taken & Reason */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-100">
          <SuggestionInput
            name="actionTaken"
            label="Action Taken"
            value={formData.actionTaken || ''}
            onChange={(val) => updateField('actionTaken', val)}
            suggestions={suggestions.actionTaken}
            placeholder="e.g. Provided the id/form as requested but kept nms entry on hold"
            isTextarea
            rows={3}
          />

          <SuggestionInput
            name="reasonForAction"
            label="REASON for Action (why I did it)"
            value={formData.reasonForAction || ''}
            onChange={(val) => updateField('reasonForAction', val)}
            suggestions={suggestions.reasonForAction}
            placeholder="e.g. I did not entry this school in nms because nms doesn't allow two school with same router."
            isTextarea
            rows={3}
          />
        </div>

        {/* Row 5: Informed, Follow-up, Follow-up date, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b border-slate-100">
          <SuggestionInput
            name="resellerInformed"
            label="Reseller Informed?"
            value={formData.resellerInformed || ''}
            onChange={(val) => updateField('resellerInformed', val)}
            suggestions={suggestions.resellerInformed}
            placeholder="e.g. Yes - phone"
          />

          <SuggestionInput
            name="followUpNeeded"
            label="Follow-up Needed?"
            value={formData.followUpNeeded || ''}
            onChange={(val) => updateField('followUpNeeded', val)}
            suggestions={suggestions.followUpNeeded}
            placeholder="e.g. Yes"
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-700">Follow-up Date</label>
              {formData.followUpDate && (
                <button type="button" onClick={() => updateField('followUpDate', '')} className="text-[11px] text-slate-500 hover:text-slate-800">Clear</button>
              )}
            </div>
            <input
              type="date"
              value={formData.followUpDate || ''}
              onChange={(e) => updateField('followUpDate', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-slate-300 rounded focus:outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600/20"
            />
            <div className="flex gap-1 mt-1.5">
              {([['Tomorrow', 1], ['3 days', 3], ['1 week', 7]] as const).map(([label, n]) => (
                <button key={label} type="button" onClick={() => updateField('followUpDate', addDaysIso(n))}
                  className="px-2 py-0.5 text-[11px] text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full">{label}</button>
              ))}
            </div>
          </div>

          <SuggestionInput
            name="status"
            label="Status"
            value={formData.status || ''}
            onChange={(val) => updateField('status', val)}
            suggestions={suggestions.status}
            placeholder="e.g. Pending - waiting for reseller"
            required
          />
        </div>

        {/* Row 6: Supervisor, MAC, Remarks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SuggestionInput
            name="supervisorInformed"
            label="Supervisor Informed / Approved By"
            value={formData.supervisorInformed || ''}
            onChange={(val) => updateField('supervisorInformed', val)}
            suggestions={suggestions.supervisorInformed}
            placeholder="e.g. I informed my superiors"
          />

          <SuggestionInput
            name="mac"
            label="MAC Address"
            value={formData.mac || ''}
            onChange={(val) => updateField('mac', val)}
            suggestions={suggestions.mac}
            placeholder="e.g. 20:23:51:78:49:F4"
            autoFormatMac
          />

          <SuggestionInput
            name="edcNo"
            label="EDC Book No."
            value={formData.edcNo || ''}
            onChange={(val) => updateField('edcNo', val)}
            suggestions={[]}
            placeholder="e.g. 1042"
          />

          <SuggestionInput
            name="routerSerial"
            label="Router Serial No."
            value={formData.routerSerial || ''}
            onChange={(val) => updateField('routerSerial', val)}
            suggestions={[]}
            placeholder="Router serial number"
          />

          <div className="sm:col-span-2">
            <SuggestionInput
              name="remarks"
              label="Remarks"
              value={formData.remarks || ''}
              onChange={(val) => updateField('remarks', val)}
              suggestions={suggestions.remarks}
              placeholder="e.g. Reseller said Radhakona Govt. Primary School is not using the network or the router anymore..."
              isTextarea
              rows={2}
            />
          </div>
        </div>
      </div>
    </form>
  );
};
