import { realityExtractor } from '../app/book/_core/reality/RealityExtractor';

const sampleEntities = [
  { kind: 'TIME', value: '夜里', evidence: '夜里 11 点', confidence: 0.92 },
  { kind: 'OBJECT', value: '钥匙', evidence: '拿着车钥匙', confidence: 0.95 },
  { kind: 'LOCATION', value: '便利店', evidence: '便利店门口', confidence: 0.9 },
  { kind: 'ACTION', value: '拿', evidence: '拿着车钥匙', confidence: 0.88 },
];

const invalidEntities = [
  { kind: 'OBJECT', value: '钥匙', emotion: '焦虑', confidence: 0.95 },
];

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function runSmokeTest() {
  const valid = realityExtractor.validate(sampleEntities);
  assert(valid.ok, valid.ok ? '' : valid.reason);
  if (!valid.ok) return;
  assert(valid.entities.length === 4, `expected 4 entities, got ${valid.entities.length}`);

  const invalid = realityExtractor.validate(invalidEntities);
  assert(!invalid.ok, 'invalid non-entity payload should be rejected');

  console.log('Reality Validator smoke test passed.');
}

runSmokeTest();