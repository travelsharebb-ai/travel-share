import { describe, it, expect } from 'vitest';
import { attachFrameUrls } from '../../src/utils/skins.js';

// Simple mocked prisma client
const mockPrisma = {
  purchaseItem: {
    findMany: async ({ where }) => {
      // Return mock purchase items for provided ids
      const ids = where.id.in || [];
      return ids.map((id) => ({ id, metadata: { frameAssetUrl: `/assets/skins/mock/${id}.png` } }));
    }
  }
};

describe('attachFrameUrls', () => {
  it('attaches frameAssetUrl to uploads with skinId', async () => {
    const uploads = [
      { id: 'u1', fileUrl: '/m/u1.jpg', skinId: 's1' },
      { id: 'u2', fileUrl: '/m/u2.jpg' },
      { id: 'u3', fileUrl: '/m/u3.jpg', skinId: 's2' }
    ];

    const result = await attachFrameUrls(uploads, mockPrisma);
    expect(result).toHaveLength(3);
    expect(result[0].frameAssetUrl).toBe('/assets/skins/mock/s1.png');
    expect(result[1].frameAssetUrl).toBeNull();
    expect(result[2].frameAssetUrl).toBe('/assets/skins/mock/s2.png');
  });

  it('returns empty array when no uploads provided', async () => {
    const res = await attachFrameUrls([], mockPrisma);
    expect(res).toEqual([]);
  });
});
