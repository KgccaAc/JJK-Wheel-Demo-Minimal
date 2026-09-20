import assert from 'node:assert/strict';
import { createWheelContentService } from '../../backend/wheel-content-server.mjs';

const service = createWheelContentService();
const result = await service.handle({ method: 'GET', path: '/api/wheel/config' });
assert.equal(result.status, 200);
assert.equal(result.body.ok, true);
assert.ok(result.body.config.flow.mainFlow.length > 40);
assert.ok(result.body.config.wheels.wheels.length >= 65);
assert.ok(result.body.config.strength.rankScale);
assert.ok(result.body.config.optionEffects.records.length > 0);
assert.equal(await service.handle({ method: 'POST', path: '/api/wheel/config' }), null);
console.log(`WHEEL_CONTENT_ACCEPTANCE PASS flow=${result.body.config.flow.mainFlow.length} wheels=${result.body.config.wheels.wheels.length}`);
