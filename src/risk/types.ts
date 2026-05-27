export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskFlag {
  code: string;       // напр. 'UNLIMITED_APPROVAL', 'HONEYPOT'
  level: RiskLevel;
  description: string;       // людський текст
  source: 'rules' | 'goplus';
}

export interface RiskReport {
  address: string;
  level: RiskLevel;       // найвищий серед усіх flags
  flags: RiskFlag[];
  summary: string;          // одне речення для `veil explain`
}
