'use client';

import type { AgentAnalyticsScope } from '@/lib/api/endpoints/agentAnalytics';

// Below the panels of an agent dashboard, with the scope and the window it shows. A
// self-hosted instance adds no panels there.
export default function AgentAnalyticsExtras(_props: { scope: AgentAnalyticsScope; days: number }) {
  return null;
}
