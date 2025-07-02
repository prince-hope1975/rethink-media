import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAndStoreAudio } from './route';

// Manual mock function
function createMockFn(): any {
  const fn = (...args: any[]): any => {
    fn.mock.calls.push(args);
    return fn.mock.returnValue;
  };
  fn.mock = { calls: [] as any[][], returnValue: undefined as any };
  fn.mockReturnThis = () => {
    fn.mock.returnValue = fn;
    return fn;
  };
  fn.mockReturnValue = (val: any) => {
    fn.mock.returnValue = val;
    return fn;
  };
  fn.mockResolvedValue = (val: any) => {
    fn.mock.returnValue = Promise.resolve(val);
    return fn;
  };
  fn.mockClear = () => {
    fn.mock.calls = [];
    fn.mock.returnValue = undefined;
  };
  return fn;
}

const mockDb = {
  insert: createMockFn(),
  values: createMockFn(),
  onConflictDoUpdate: createMockFn(),
};
const mockMedia = {};
const mockPut = createMockFn();
const mockGenerateAudioTTS = createMockFn();
const mockConvertToWav = createMockFn();
const mockMime = { getExtension: createMockFn() };
const baseParams = {
  content: { audioPrompt: 'A test audio prompt' },
  dataBaseID: 1,
  lastAudioIndex: [{ index: 0 }],
  db: mockDb,
  media: mockMedia,
  put: mockPut,
  generateAudioTTS: mockGenerateAudioTTS,
  convertToWav: mockConvertToWav,
  mime: mockMime,
};

function clearAllMocks() {
  mockDb.insert.mockClear();
  mockDb.values.mockClear();
  mockDb.onConflictDoUpdate.mockClear();
  mockPut.mockClear();
  mockGenerateAudioTTS.mockClear();
  mockConvertToWav.mockClear();
  mockMime.getExtension.mockClear();
}

test('should upload and store audio successfully', async (t) => {
  clearAllMocks();
  mockGenerateAudioTTS.mockResolvedValue({
    candidates: [
      { content: { parts: [ { inlineData: { data: Buffer.from('test', 'utf-8').toString('base64'), mimeType: 'audio/mpeg' } } ] } }
    ]
  });
  mockMime.getExtension.mockReturnValue('mp3');
  mockPut.mockResolvedValue({ url: 'http://audio.url' });
  mockDb.insert.mockReturnThis();
  mockDb.values.mockReturnThis();
  mockDb.onConflictDoUpdate.mockReturnThis();

  await generateAndStoreAudio(baseParams);
  assert.ok(mockGenerateAudioTTS.mock.calls.length > 0, 'generateAudioTTS should be called');
  assert.ok(mockPut.mock.calls.length > 0, 'put should be called');
  assert.ok(mockDb.insert.mock.calls.length > 0, 'db.insert should be called');
});

test('should handle missing audioPrompt', async (t) => {
  clearAllMocks();
  await generateAndStoreAudio({ ...baseParams, content: { audioPrompt: '' } });
  assert.strictEqual(mockGenerateAudioTTS.mock.calls.length, 0, 'generateAudioTTS should not be called');
});

test('should handle audio generation failure', async (t) => {
  clearAllMocks();
  mockGenerateAudioTTS.mockResolvedValue({ candidates: [ { content: { parts: [ { inlineData: undefined } ] } } ] });
  await generateAndStoreAudio(baseParams);
  assert.strictEqual(mockPut.mock.calls.length, 0, 'put should not be called');
  assert.ok(mockDb.insert.mock.calls.length > 0, 'db.insert should be called'); // Should still insert failed status
}); 