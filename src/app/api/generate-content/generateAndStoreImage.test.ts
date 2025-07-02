import { generateAndStoreImage } from './route';

describe('generateAndStoreImage', () => {
  const mockAi = {
    models: {
      generateImages: jest.fn(),
    },
  };
  const mockDb = { insert: jest.fn().mockReturnThis(), values: jest.fn().mockReturnThis() };
  const mockMedia = {};
  const mockPut = jest.fn();
  const baseParams = {
    ai: mockAi,
    content: { imagePrompt: 'A test prompt' },
    dataBaseID: 1,
    lastImageIndex: [{ index: 0 }],
    db: mockDb,
    media: mockMedia,
    put: mockPut,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should upload and store image successfully', async () => {
    mockAi.models.generateImages.mockResolvedValue({
      generatedImages: [{ image: { imageBytes: Buffer.from('test', 'utf-8') } }],
    });
    mockPut.mockResolvedValue({ url: 'http://image.url' });
    mockDb.insert.mockReturnThis();
    mockDb.values.mockResolvedValue({});

    await generateAndStoreImage(baseParams);
    expect(mockAi.models.generateImages).toHaveBeenCalled();
    expect(mockPut).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('should throw error if imagePrompt is missing', async () => {
    await generateAndStoreImage({ ...baseParams, content: { imagePrompt: '' } });
    expect(mockAi.models.generateImages).not.toHaveBeenCalled();
  });

  it('should throw error if image generation fails', async () => {
    mockAi.models.generateImages.mockResolvedValue({ generatedImages: [{}] });
    await generateAndStoreImage(baseParams);
    expect(mockPut).not.toHaveBeenCalled();
  });
}); 