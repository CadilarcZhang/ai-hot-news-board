const request = require('supertest');
const app = require('../app');
const cache = require('../utils/cache');

jest.mock('../utils/cache');
jest.mock('axios');

describe('API Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    
    describe('GET /api/hot-news', () => {
        it('should return hot news data from cache if available', async () => {
            const mockData = { code: 200, result: { list: [] } };
            cache.get.mockReturnValue(mockData);
            
            const response = await request(app).get('/api/hot-news?platform=weibo');
            
            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockData);
            expect(cache.get).toHaveBeenCalledWith('hot-news-weibo');
        });
        
        it('should fetch data from API if not in cache', async () => {
            // 测试代码...
        });
    });
    
    describe('POST /api/generate-content', () => {
        it('should return error if title is missing', async () => {
            const response = await request(app)
                .post('/api/generate-content')
                .send({});
            
            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
        
        it('should return cached content if available', async () => {
            // 测试代码...
        });
    });
}); 