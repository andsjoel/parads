import { readFile } from 'node:fs/promises';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import { invoke } from './api-fixture.mjs';

export async function frontendAccessFor(handler, auth, authSdk) {
  const actions = [];
  const context = createContext({ fetch: async (path, options) => {
    if (path !== '/api/access-gateway' || options.method !== 'POST') throw new Error('Unexpected frontend request');
    const body = JSON.parse(options.body);
    actions.push(body.action);
    const response = await invoke(handler, body, { headers: { ...options.headers, authorization: options.headers.Authorization } });
    return { status: response.statusCode, ok: response.statusCode === 200, json: async () => response.body };
  } });
  const modules = new Map();
  const mocks = { '../firebase/firebase': { auth }, 'firebase/auth': authSdk };
  const entry = new SourceTextModule(`export * from './src/services/firstAccessService.js'; export * from './src/services/authServices.js'; export * from './src/services/accessGatewayService.js';`, {
    context, identifier: new URL('../../test-access-entry.js', import.meta.url).href,
  });
  await entry.link(async (specifier, parent) => {
    if (mocks[specifier]) {
      const values = mocks[specifier];
      return new SyntheticModule(Object.keys(values), function () {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value);
      }, { context });
    }
    const url = new URL(specifier.endsWith('.js') ? specifier : `${specifier}.js`, parent.identifier);
    if (!modules.has(url.href)) modules.set(url.href, new SourceTextModule(await readFile(url, 'utf8'), { context, identifier: url.href }));
    return modules.get(url.href);
  });
  await entry.evaluate();
  return { api: entry.namespace, actions };
}
