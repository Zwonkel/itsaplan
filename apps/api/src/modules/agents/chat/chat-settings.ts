import { db, aiAgent, agentChatLastAgent, project, team } from '@repo/db';
import { and, eq, sql } from 'drizzle-orm';
import { HttpError } from '#shared/lib';
import { agentWorksInProject, inProject, isTriggerableBy } from '../core/service';

// The chat defaults of a project and the team whose projects it belongs to, and the
// agent each member last chatted with in the project. Reads resolve a stored id
// through the checks below, so a chat default that no longer serves chat reads as
// unset; writes refuse to store one the defaults may not name.

const chatAgentColumns = {
  id: aiAgent.id,
  kind: aiAgent.kind,
  runnerScope: aiAgent.runnerScope,
  ownerUserId: aiAgent.ownerUserId,
  chatEnabled: aiAgent.chatEnabled,
};

// A default must serve every member it is a default for: chat on, and a runner not
// restricted to its owner.
function isDefaultable(agent: {
  chatEnabled: boolean;
  kind: string;
  runnerScope: string;
}): boolean {
  return agent.chatEnabled && (agent.kind === 'internal' || agent.runnerScope === 'team');
}

async function requireDefaultAgent(teamId: number, agentId: number) {
  const [agent] = await db
    .select(chatAgentColumns)
    .from(aiAgent)
    .where(and(eq(aiAgent.id, agentId), eq(aiAgent.teamId, teamId)));
  if (!agent) throw new HttpError(400, 'The default chat agent must belong to the team');
  if (!agent.chatEnabled) throw new HttpError(400, 'Chat is switched off for this agent');
  if (!isDefaultable(agent))
    throw new HttpError(400, 'A member-restricted agent cannot be the default chat agent');
  return agent;
}

export async function getTeamChatDefault(
  teamId: number,
): Promise<{ defaultAgentId: number | null }> {
  const [row] = await db
    .select({ defaultAgentId: team.defaultChatAgentId })
    .from(team)
    .where(eq(team.id, teamId));
  return { defaultAgentId: row?.defaultAgentId ?? null };
}

export async function setTeamChatDefault(
  teamId: number,
  defaultAgentId: number | null,
): Promise<{ defaultAgentId: number | null }> {
  if (defaultAgentId != null) await requireDefaultAgent(teamId, defaultAgentId);
  await db.update(team).set({ defaultChatAgentId: defaultAgentId }).where(eq(team.id, teamId));
  return { defaultAgentId };
}

export interface ChatSettings {
  // What the project itself holds. Null inherits the team's default.
  defaultAgentId: number | null;
  // The project's agent, else the team's: the agent a fresh chat preselects.
  resolvedAgentId: number | null;
  // The agent of the member's last chat in this project.
  lastUsedAgentId: number | null;
}

// The stored agent as one this member may start a chat with: it still belongs to the
// team, still works in the project, chat is on for it, and its runner serves them.
async function usableChatAgent(
  agentId: number,
  teamId: number,
  projectId: number,
  userId: string,
): Promise<number | null> {
  const [agent] = await db
    .select(chatAgentColumns)
    .from(aiAgent)
    .where(and(eq(aiAgent.id, agentId), eq(aiAgent.teamId, teamId), inProject(projectId)));
  if (!agent || !agent.chatEnabled || !isTriggerableBy(agent, userId)) return null;
  return agentId;
}

export async function getChatSettings(
  projectId: number,
  teamId: number,
  userId: string,
): Promise<ChatSettings> {
  const [row] = await db
    .select({
      defaultAgentId: project.defaultChatAgentId,
      teamDefaultAgentId: team.defaultChatAgentId,
    })
    .from(project)
    .innerJoin(team, eq(team.id, project.teamId))
    .where(eq(project.id, projectId));
  // The project's own setting wins; an unset one inherits the team's. A default whose
  // agent fails the checks does not fall back to the other level: the agents module
  // clears the stored one at the same change that made it stale.
  const candidate = row?.defaultAgentId ?? row?.teamDefaultAgentId ?? null;
  const [savedLast] = await db
    .select({ agentId: agentChatLastAgent.agentId })
    .from(agentChatLastAgent)
    .where(and(eq(agentChatLastAgent.projectId, projectId), eq(agentChatLastAgent.userId, userId)));
  const remembered = savedLast?.agentId ?? null;
  return {
    defaultAgentId: row?.defaultAgentId ?? null,
    resolvedAgentId:
      candidate == null ? null : await usableChatAgent(candidate, teamId, projectId, userId),
    lastUsedAgentId:
      remembered == null ? null : await usableChatAgent(remembered, teamId, projectId, userId),
  };
}

export async function setProjectChatDefault(
  projectId: number,
  teamId: number,
  defaultAgentId: number | null,
): Promise<void> {
  if (defaultAgentId != null) {
    await requireDefaultAgent(teamId, defaultAgentId);
    if (!(await agentWorksInProject(defaultAgentId, projectId)))
      throw new HttpError(400, 'The default chat agent must work in this project');
  }
  await db
    .update(project)
    .set({ defaultChatAgentId: defaultAgentId })
    .where(eq(project.id, projectId));
}

export async function setLastUsedChatAgent(
  projectId: number,
  teamId: number,
  userId: string,
  agentId: number,
): Promise<void> {
  const [agent] = await db
    .select(chatAgentColumns)
    .from(aiAgent)
    .where(and(eq(aiAgent.id, agentId), eq(aiAgent.teamId, teamId)));
  if (!agent) throw new HttpError(400, 'The agent must belong to the team');
  if (!agent.chatEnabled) throw new HttpError(400, 'Chat is switched off for this agent');
  if (!isTriggerableBy(agent, userId))
    throw new HttpError(403, 'This agent only takes tasks from its owner');
  if (!(await agentWorksInProject(agentId, projectId)))
    throw new HttpError(400, 'The agent must work in this project');
  await db
    .insert(agentChatLastAgent)
    .values({ projectId, userId, agentId })
    .onConflictDoUpdate({
      target: [agentChatLastAgent.projectId, agentChatLastAgent.userId],
      set: { agentId, updatedAt: sql`now()` },
    });
}
