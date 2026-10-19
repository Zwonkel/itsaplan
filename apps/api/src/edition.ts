// The private edition's settings, installed at startup before the port is bound.
// Tests import src/app.ts without this module, so they run the core defaults.
import { setWorkspaceScim } from '@repo/auth';
import { setOwnedWorkspaceLimit } from './shared/limits';

setOwnedWorkspaceLimit(0);
setWorkspaceScim();
