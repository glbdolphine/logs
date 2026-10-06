import { LogEntry, LogFieldKey, FieldSuggestionsMap } from '../types';

export const INITIAL_SUGGESTIONS: FieldSuggestionsMap = {
  resellerName: ['Shabul- Balaganj','Rahman- Sylhet Sadar','Kabir- Beanibazar','Alam- Golapganj','Faruk- Biswanath'],
  callerPhone: ['+880 1680-945894','+880 1711-234567','+880 1912-345678'],
  requestType: ['New User ID','Form Submission','Bandwidth Upgrade','Router Relocation','Profile Modification','MAC Binding Reset','IP Address Re-assignment'],
  customerName: ['Hasampur Govt. Primary School','Radhakona Govt. Primary School','Sreemangal Model High School','Balaganj Technical Institute'],
  nmsId: [],
  issueFound: ['Same router at two institute','MAC address collision in NMS','Incorrect package assigned','Port link down on OLT','VLAN mismatch at reseller switch'],
  missingWrongDetails: ['They previously used the same router in Radhakona Govt. Primary School','National ID card copy missing from form','Phone number mismatch on application form','Previous billing clearance pending'],
  actionTaken: ['Provided the id/form as requested but kept nms entry on hold','Created user ID in NMS and notified reseller via WhatsApp','Updated MAC binding in authentication server','Forwarded ticket to Core NOC team for IP remapping'],
  reasonForAction: ["I did not entry this school in nms because nms doesn't allow two school with same router.",'Awaiting confirmation of router decommissioning from previous site.','Verified payment voucher with accounts before activating profile.'],
  resellerInformed: ['Yes - phone','Yes - WhatsApp','Yes - email','Yes - in-person','No - unanswered phone call','No - SMS sent'],
  followUpNeeded: ['Yes','No','Pending reseller callback','Pending supervisor review'],
  status: ['Pending - waiting for reseller','In Progress','Resolved','Escalated to Core Team','On Hold','Closed'],
  supervisorInformed: ['I informed my superiors','Approved by Team Lead','Informed Operations Manager','Escalated to Duty Manager','No approval needed (standard request)'],
  remarks: ['Reseller said Radhakona Govt. Primary School is not using the network or the router anymore. So they decided to use it for another school.','Reseller promised to submit the formal decommissioning request by tomorrow.','Client requested urgent activation before morning classes.'],
  mac: ['20:23:51:78:49:F4','44:D9:E7:2B:1A:08','E4:5F:01:8C:3D:A2'],
};

export interface AppBackupData {
  version: number;
  appName: string;
  exportedAt: string;
  logs: LogEntry[];
  suggestions: FieldSuggestionsMap;
}

export function exportAppBackup(logs: LogEntry[], suggestions: FieldSuggestionsMap): void {
  const backupData: AppBackupData = {
    version: 2,
    appName: 'Pace IT',
    exportedAt: new Date().toISOString(),
    logs,
    suggestions,
  };
  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `PaceIT_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function parseAppBackup(jsonString: string): { logs: LogEntry[]; suggestions: FieldSuggestionsMap } {
  const parsed = JSON.parse(jsonString);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid backup file format.');
  return {
    logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    suggestions: parsed.suggestions && typeof parsed.suggestions === 'object' ? parsed.suggestions : INITIAL_SUGGESTIONS,
  };
}
