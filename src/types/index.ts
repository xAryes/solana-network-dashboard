export interface ProbabilityStage {
  id: string;
  name: string;
  probability: number;
  description: string;
  factors: string[];
}

export interface SubmissionMethod {
  id: string;
  name: string;
  description: string;
  steps: string[];
  successRate: number;
  pros: string[];
  cons: string[];
  color: string;
}

export interface FailureMode {
  id: string;
  title: string;
  description: string;
  icon: string;
  causes: string[];
  impact: string;
}

export interface TimelineStep {
  id: string;
  time: string;
  label: string;
  description: string;
  status: 'pending' | 'active' | 'complete';
}

export interface Section {
  id: string;
  title: string;
  subtitle: string;
}
