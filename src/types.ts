export interface LogEntry {
  id: string;
  logNo: number | string;
  date: string;
  resellerName: string;
  callerPhone: string;
  requestType: string;
  customerName: string;
  nmsId: string;
  issueFound: string;
  missingWrongDetails: string;
  actionTaken: string;
  reasonForAction: string;
  resellerInformed: string;
  followUpNeeded: string;
  status: string;
  supervisorInformed: string;
  remarks: string;
  mac: string;
  edcNo?: string;
  routerSerial?: string;
  /** ISO time the signed form came back. Empty/undefined = still awaiting. */
  formReceivedAt?: string;
  /** Reseller from the Resellers list (resellerName is still stored so old logs/exports keep working). */
  resellerId?: string;
  /** yyyy-mm-dd. When set (and the log isn't resolved/closed) the log shows up in Due today / Overdue. */
  followUpDate?: string;
  /** Only present on logs loaded from the admin bin. */
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  history?: LogChange[];
}

export interface LogChange {
  at: string;
  by: string;
  action: 'created' | 'edited';
  changes?: { field: string; from: string; to: string }[];
}

export interface ActivityEvent {
  id: string;
  at: string;
  by: string;
  action: 'created' | 'edited' | 'deleted' | 'cleared' | 'restored' | 'user_created' | 'user_disabled' | 'user_enabled' | 'purged' | 'password_reset';
  logNo?: number | string;
  customer?: string;
  detail?: string;
}

export type LogFieldKey = 
  | 'resellerName'
  | 'callerPhone'
  | 'requestType'
  | 'customerName'
  | 'nmsId'
  | 'issueFound'
  | 'missingWrongDetails'
  | 'actionTaken'
  | 'reasonForAction'
  | 'resellerInformed'
  | 'followUpNeeded'
  | 'status'
  | 'supervisorInformed'
  | 'remarks'
  | 'mac';

export interface FieldDefinition {
  key: LogFieldKey;
  label: string;
  placeholder: string;
  isTextarea?: boolean;
  rows?: number;
  type?: 'text' | 'tel' | 'date';
  helperText?: string;
}

export type FieldSuggestionsMap = Record<LogFieldKey, string[]>;

export const STANDARD_STATUSES = [
  'Pending - waiting for reseller',
  'In Progress',
  'Resolved',
  'Cancelled',
  'On Hold',
  'Escalated to Core Team',
] as const;


export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
}

export interface Reseller {
  id: string;
  name: string;
  area: string;
  phone: string;
  active: boolean;
  createdAt: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface AdminUserSummary {
  id: string;
  /** Stored initial/reset password. Undefined when unknown (older account, or the user changed it themselves). */
  password?: string;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  createdAt: string;
  disabled: boolean;
}
