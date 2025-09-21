const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const { User } = require('../../src/models');
const { userOne, userOneAccessToken } = require('../fixtures/user.fixture');

describe('Wallet Transaction Bonus Payment', () => {
    let testUser;
    let userAccessToken;

    beforeAll(async () => {
        // Create a test user
        testUser = await User.create({
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123',
            role: 'custom'
        });

        // Get access token (you may need to implement this based on your auth system)
        // userAccessToken = await getAccessToken(testUser._id);
    });

    afterAll(async () => {
        // Clean up test data
        await User.deleteMany({ email: 'test@example.com' });
    });

    describe('POST /v1/wallet-transactions', () => {
        test('should create a normal wallet transaction', async () => {
            const transactionData = {
                userId: testUser._id,
                type: 'SITE_ENGINEER_PAYMENT',
                amount: 1000,
                description: 'Regular payment',
                currency: 'INR',
                isBonus: false
            };

            const res = await request(app)
                .post('/v1/wallet-transactions')
                .set('Authorization', `Bearer ${userAccessToken}`)
                .send(transactionData)
                .expect(201);

            expect(res.body).toHaveProperty('_id');
            expect(res.body.amount).toBe(1000);
            expect(res.body.isBonus).toBe(false);
            expect(res.body.description).toBe('Regular payment');
        });

        test('should create a bonus wallet transaction', async () => {
            const transactionData = {
                userId: testUser._id,
                type: 'SITE_ENGINEER_PAYMENT',
                amount: 500,
                description: 'Bonus payment for excellent work',
                currency: 'INR',
                isBonus: true
            };

            const res = await request(app)
                .post('/v1/wallet-transactions')
                .set('Authorization', `Bearer ${userAccessToken}`)
                .send(transactionData)
                .expect(201);

            expect(res.body).toHaveProperty('_id');
            expect(res.body.amount).toBe(500);
            expect(res.body.isBonus).toBe(true);
            expect(res.body.description).toBe('Bonus payment for excellent work');
        });

        test('should default isBonus to false when not provided', async () => {
            const transactionData = {
                userId: testUser._id,
                type: 'SITE_ENGINEER_PAYMENT',
                amount: 750,
                description: 'Payment without bonus flag',
                currency: 'INR'
            };

            const res = await request(app)
                .post('/v1/wallet-transactions')
                .set('Authorization', `Bearer ${userAccessToken}`)
                .send(transactionData)
                .expect(201);

            expect(res.body.isBonus).toBe(false);
        });
    });

    describe('GET /v1/wallet-transactions', () => {
        test('should return transactions with bonus flag', async () => {
            const res = await request(app)
                .get('/v1/wallet-transactions')
                .set('Authorization', `Bearer ${userAccessToken}`)
                .query({ userId: testUser._id })
                .expect(200);

            expect(res.body.results).toBeInstanceOf(Array);

            // Check if any transaction has isBonus field
            const hasBonusField = res.body.results.some(transaction =>
                transaction.hasOwnProperty('isBonus')
            );
            expect(hasBonusField).toBe(true);
        });
    });
});
