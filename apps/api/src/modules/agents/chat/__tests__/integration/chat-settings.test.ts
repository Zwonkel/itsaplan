import { describe, it, expect, beforeEach } from 'bun:test';
import { authedApi, createProject, ownWorkspaceId, type Api } from '#tests/helpers/app';
import { signUpTestUser } from '#tests/helpers/auth';
import { resetDb } from '#tests/helpers/db';
import { addProjectMember } from '#tests/helpers/members';
import { createAgent, teamOf } from '#tests/helpers/agents';

// Integration flow: a real session against the real (test) database. See
// apps/api/AGENTS.md "Tests" for the setup.
//
// The chat defaults: the per-agent chat switch, the team default chat agent every
// project without its own inherits, the project's own, and the member's last-used
// agent. The settings routes return the stored values next to the resolved ones the
// panel preselects from; a default that does not serve chat anymore reads as unset,
// and preselection falls to whatever the chain before it holds.

// Registers a user and returns a Treaty client acting as them.
async function signUpClient() {
  const user = await signUpTestUser();
  return { user, api: authedApi(user.cookie) };
}

// One external agent attached to the project. External needs no model credential, so
// the setup stays free of integration fixtures.
async function externalAgent(api: Api, projectKey: string) {
  const created = await createAgent(api, projectKey, {
    name: 'Helper',
    username: 'helper-' + Math.random().toString(36).slice(2, 8),
    kind: 'external',
  });
  expect(created.status).toBe(201);
  return created.data!.agent;
}

// Marks the agent restricted to the member who created it, the standing that a chat
// default must not have.
async function restrictToOwner(api: Api, teamId: number, agentId: number) {
  const patched = await api
    .teams({ teamId })
    ['ai-agents']({ agentId })
    .patch({ runnerScope: 'owner' });
  expect(patched.status).toBe(200);
}

// Shared setup: one project with one attached external agent.
async function setup() {
  const { api } = await signUpClient();
  await createProject(api, { key: 'MKT', name: 'Marketing' });
  const teamId = await teamOf(api, 'MKT');
  const agent = await externalAgent(api, 'MKT');
  return { api, teamId, agentId: agent.id };
}

describe('chat settings', () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe('project chat settings', () => {
    it('reads all null on a project that never set anything', async () => {
      const { api } = await signUpClient();
      await createProject(api, { key: 'MKT', name: 'Marketing' });

      const settings = await api.projects({ projectKey: 'MKT' }).settings.chat.get();
      expect(settings.status).toBe(200);
      expect(settings.data).toEqual({
        defaultAgentId: null,
        resolvedAgentId: null,
        lastUsedAgentId: null,
      });
    });

    it('sets, keeps and clears a project default', async () => {
      const { api, agentId } = await setup();
      const patched = await api
        .projects({ projectKey: 'MKT' })
        .settings.chat.patch({ defaultAgentId: agentId });
      expect(patched.status).toBe(200);
      expect(patched.data).toEqual({
        defaultAgentId: agentId,
        resolvedAgentId: agentId,
        lastUsedAgentId: null,
      });

      const reread = await api.projects({ projectKey: 'MKT' }).settings.chat.get();
      expect(reread.data).toEqual({
        defaultAgentId: agentId,
        resolvedAgentId: agentId,
        lastUsedAgentId: null,
      });

      const cleared = await api
        .projects({ projectKey: 'MKT' })
        .settings.chat.patch({ defaultAgentId: null });
      expect(cleared.status).toBe(200);
      expect(cleared.data).toEqual({
        defaultAgentId: null,
        resolvedAgentId: null,
        lastUsedAgentId: null,
      });
    });

    it('a project default wins over the team default', async () => {
      const { api, teamId, agentId } = await setup();
      const other = await externalAgent(api, 'MKT');
      await api.teams({ teamId })['chat-default'].patch({ defaultAgentId: other.id });

      await api.projects({ projectKey: 'MKT' }).settings.chat.patch({ defaultAgentId: agentId });
      const settings = await api.projects({ projectKey: 'MKT' }).settings.chat.get();
      expect(settings.data).toMatchObject({ defaultAgentId: agentId, resolvedAgentId: agentId });
    });

    it('clearing the project default resolves the team default again', async () => {
      const { api, teamId, agentId } = await setup();
      const teamAgent = await externalAgent(api, 'MKT');
      await api.teams({ teamId })['chat-default'].patch({ defaultAgentId: teamAgent.id });
      await api.projects({ projectKey: 'MKT' }).settings.chat.patch({ defaultAgentId: agentId });

      await api.projects({ projectKey: 'MKT' }).settings.chat.patch({ defaultAgentId: null });

      const settings = await api.projects({ projectKey: 'MKT' }).settings.chat.get();
      expect(settings.data).toMatchObject({ defaultAgentId: null, resolvedAgentId: teamAgent.id });
    });

    it('a project default whose agent left the project resolves to nothing', async () => {
      const { api, teamId, agentId } = await setup();
      await api.projects({ projectKey: 'MKT' }).settings.chat.patch({ defaultAgentId: agentId });
      await api.teams({ teamId })['ai-agents']({ agentId }).patch({ projectIds: [] });

      const settings = await api.projects({ projectKey: 'MKT' }).settings.chat.get();
      expect(settings.data).toEqual({
        defaultAgentId: null,
        resolvedAgentId: null,
        lastUsedAgentId: null,
      });
    });

    it('only the project owner or the team changes the default; a member reads', async () => {
      const { api, agentId } = await setup();
      const member = await addProjectMember(api, 'MKT');

      const refused = await member
        .projects({ projectKey: 'MKT' })
        .settings.chat.patch({ defaultAgentId: agentId });
      expect(refused.status).toBe(403);

      const read = await member.projects({ projectKey: 'MKT' }).settings.chat.get();
      expect(read.status).toBe(200);
      expect(read.data).toEqual({
        defaultAgentId: null,
        resolvedAgentId: null,
        lastUsedAgentId: null,
      });
    });
  });

  describe('team chat default', () => {
    it('applies to every project that sets none, only where the agent works', async () => {
      const { api, teamId, agentId } = await setup();
      await api.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
      await api.teams({ teamId })['chat-default'].patch({ defaultAgentId: agentId });

      const home = await api.projects({ projectKey: 'MKT' }).settings.chat.get();
      expect(home.data).toMatchObject({ defaultAgentId: null, resolvedAgentId: agentId });
      const away = await api.projects({ projectKey: 'OPS' }).settings.chat.get();
      expect(away.data).toMatchObject({ defaultAgentId: null, resolvedAgentId: null });
    });

    it('a plain member may read it but not set it', async () => {
      const { api, teamId, agentId } = await setup();
      const member = await addProjectMember(api, 'MKT');

      const refused = await member
        .teams({ teamId })
        ['chat-default'].patch({ defaultAgentId: agentId });
      expect(refused.status).toBe(403);
      const read = await member.teams({ teamId })['chat-default'].get();
      expect(read.status).toBe(200);
      expect(read.data).toEqual({ defaultAgentId: null });
    });

    it('refuses an agent of another team and a member-restricted one', async () => {
      const { api, teamId } = await setup();
      const workspaceId = await ownWorkspaceId(api);
      const other = (await api.teams.post({ name: 'Other', slug: 'other', workspaceId })).data!;
      const outsider = await api.teams({ teamId: other.id })['ai-agents'].post({
        name: 'Outsider',
        username: 'outsider',
        kind: 'external',
        projectIds: [],
      });

      const wrongTeam = await api
        .teams({ teamId })
        ['chat-default'].patch({ defaultAgentId: outsider.data!.agent.id });
      expect(wrongTeam.status).toBe(400);

      const restricted = await createAgent(api, 'MKT', {
        name: 'Solo',
        username: 'solo-' + Math.random().toString(36).slice(2, 8),
        kind: 'external',
      });
      await restrictToOwner(api, teamId, restricted.data!.agent.id);
      const refused = await api
        .teams({ teamId })
        ['chat-default'].patch({ defaultAgentId: restricted.data!.agent.id });
      expect(refused.status).toBe(400);
    });

    it('dropping chat on the agent clears the team default', async () => {
      const { api, teamId, agentId } = await setup();
      await api.teams({ teamId })['chat-default'].patch({ defaultAgentId: agentId });

      await api.teams({ teamId })['ai-agents']({ agentId }).patch({ chatEnabled: false });

      const read = await api.teams({ teamId })['chat-default'].get();
      expect(read.data).toEqual({ defaultAgentId: null });
      const project = await api.projects({ projectKey: 'MKT' }).settings.chat.get();
      expect(project.data).toMatchObject({ resolvedAgentId: null });
    });

    it('restricting the runner to its owner clears the team default', async () => {
      const { api, teamId, agentId } = await setup();
      await api.teams({ teamId })['chat-default'].patch({ defaultAgentId: agentId });

      await restrictToOwner(api, teamId, agentId);

      const read = await api.teams({ teamId })['chat-default'].get();
      expect(read.data).toEqual({ defaultAgentId: null });
    });

    it('deleting the agent clears the team default', async () => {
      const { api, teamId, agentId } = await setup();
      await api.teams({ teamId })['chat-default'].patch({ defaultAgentId: agentId });

      await api.teams({ teamId })['ai-agents']({ agentId }).delete();

      const read = await api.teams({ teamId })['chat-default'].get();
      expect(read.data).toEqual({ defaultAgentId: null });
    });
  });

  describe('project default validation', () => {
    it('refuses an agent of another team', async () => {
      const { api } = await setup();
      const workspaceId = await ownWorkspaceId(api);
      const other = (await api.teams.post({ name: 'Other', slug: 'other', workspaceId })).data!;
      const outsider = await api.teams({ teamId: other.id })['ai-agents'].post({
        name: 'Outsider',
        username: 'outsider',
        kind: 'external',
        projectIds: [],
      });

      const refused = await api
        .projects({ projectKey: 'MKT' })
        .settings.chat.patch({ defaultAgentId: outsider.data!.agent.id });
      expect(refused.status).toBe(400);
    });

    it('refuses a member-restricted agent', async () => {
      const { api, teamId } = await setup();
      const restricted = await createAgent(api, 'MKT', {
        name: 'Solo',
        username: 'solo-' + Math.random().toString(36).slice(2, 8),
        kind: 'external',
      });
      await restrictToOwner(api, teamId, restricted.data!.agent.id);

      const refused = await api
        .projects({ projectKey: 'MKT' })
        .settings.chat.patch({ defaultAgentId: restricted.data!.agent.id });
      expect(refused.status).toBe(400);
    });

    it('refuses an agent that does not work in the project', async () => {
      const { api, teamId } = await setup();
      await api.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
      const elsewhere = await createAgent(api, 'OPS', {
        name: 'Elsewhere',
        username: 'elsewhere',
        kind: 'external',
      });

      const refused = await api
        .projects({ projectKey: 'MKT' })
        .settings.chat.patch({ defaultAgentId: elsewhere.data!.agent.id });
      expect(refused.status).toBe(400);
    });

    it('refuses an agent chat is switched off for', async () => {
      const { api, teamId, agentId } = await setup();
      await api.teams({ teamId })['ai-agents']({ agentId }).patch({ chatEnabled: false });

      const refused = await api
        .projects({ projectKey: 'MKT' })
        .settings.chat.patch({ defaultAgentId: agentId });
      expect(refused.status).toBe(400);
    });
  });

  describe('last-used agent', () => {
    it('each member remembers their own agent', async () => {
      const { api, agentId } = await setup();
      const member = await addProjectMember(api, 'MKT');
      const memberAgent = await externalAgent(api, 'MKT');

      let response = await api
        .projects({ projectKey: 'MKT' })
        .settings.chat['last-agent'].put({ agentId });
      expect(response.status).toBe(204);
      let settings = await api.projects({ projectKey: 'MKT' }).settings.chat.get();
      expect(settings.data).toMatchObject({ lastUsedAgentId: agentId });

      response = await member
        .projects({ projectKey: 'MKT' })
        .settings.chat['last-agent'].put({ agentId: memberAgent.id });
      expect(response.status).toBe(204);
      settings = await member.projects({ projectKey: 'MKT' }).settings.chat.get();
      expect(settings.data).toMatchObject({ lastUsedAgentId: memberAgent.id });

      settings = await api.projects({ projectKey: 'MKT' }).settings.chat.get();
      expect(settings.data).toMatchObject({ lastUsedAgentId: agentId });
    });

    it('refuses an agent the caller may not trigger', async () => {
      const { api, teamId } = await setup();
      const restricted = await createAgent(api, 'MKT', {
        name: 'Solo',
        username: 'solo-' + Math.random().toString(36).slice(2, 8),
        kind: 'external',
      });
      await restrictToOwner(api, teamId, restricted.data!.agent.id);

      const other = await addProjectMember(api, 'MKT');
      const refused = await other
        .projects({ projectKey: 'MKT' })
        .settings.chat['last-agent'].put({ agentId: restricted.data!.agent.id });
      expect(refused.status).toBe(403);
    });

    it('refuses an agent the project does not have', async () => {
      const { api, teamId } = await setup();
      await api.teams({ teamId }).projects.post({ key: 'OPS', name: 'Operations' });
      const elsewhere = await createAgent(api, 'OPS', {
        name: 'Elsewhere',
        username: 'elsewhere',
        kind: 'external',
      });

      const refused = await api
        .projects({ projectKey: 'MKT' })
        .settings.chat['last-agent'].put({ agentId: elsewhere.data!.agent.id });
      expect(refused.status).toBe(400);
    });

    it('deleting the agent clears it', async () => {
      const { api, teamId, agentId } = await setup();
      const last = await api
        .projects({ projectKey: 'MKT' })
        .settings.chat['last-agent'].put({ agentId });
      expect(last.status).toBe(204);

      await api.teams({ teamId })['ai-agents']({ agentId }).delete();

      const settings = await api.projects({ projectKey: 'MKT' }).settings.chat.get();
      expect(settings.data).toEqual({
        defaultAgentId: null,
        resolvedAgentId: null,
        lastUsedAgentId: null,
      });
    });
  });
});
