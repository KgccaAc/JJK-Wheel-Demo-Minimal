import assert from 'node:assert/strict';
import { SaveService } from '../web-runtime/save-service.mjs';

const calls = [];
const http = {
  async get(path) { calls.push(['GET', path]); return { save: { revision: 4, snapshot: { currentNodeId: 'remote' } } }; },
  async post(path, body) {
    calls.push(['POST', path, body]);
    if (calls.filter((item) => item[0] === 'POST').length === 1) {
      const error = new Error('conflict'); error.status = 409; error.payload = { revision: 4 }; throw error;
    }
    return { revision: 5, saveId: 'save' };
  },
};
const previousStorage = globalThis.localStorage;
globalThis.localStorage = { setItem() {}, getItem() { return null; } };
try {
  const service = new SaveService(http, 'save');
  const result = await service.commit({ currentNodeId: 'local' }, [{ type: 'choice_selected' }]);
  assert.equal(result.revision, 5);
  assert.equal(service.revision, 5);
  assert.equal(calls.filter((item) => item[0] === 'POST').length, 2);
  assert.equal(calls[1][0], 'GET');
  console.log('WEB_SAVE_SERVICE PASS conflict_retry=true');
} finally { globalThis.localStorage = previousStorage; }
