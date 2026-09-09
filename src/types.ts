
export interface DataRow {
  [key: string]: any;
}

export interface Insight {
  title: string;
  description: string;
  type: 'positive' | 'negative' | 'neutral' | 'trend';
}

export interface DashboardConfig {
  summary: string;
  suggestedKPIs: {
    label: string;
    value: string;
    change?: string;
  }[];
}
