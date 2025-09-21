const faker = require('faker');
const { WalletTransaction } = require('../../../src/models');
const mongoose = require('mongoose');

describe('WalletTransaction model', () => {
    describe('WalletTransaction validation', () => {
        let newTransaction;
        let userId;

        beforeEach(() => {
            userId = new mongoose.Types.ObjectId();
            newTransaction = {
                userId,
                type: 'SITE_ENGINEER_PAYMENT',
                amount: 1000,
                description: 'Test payment',
                currency: 'INR',
                isBonus: false
            };
        });

        test('should correctly validate a valid transaction', async () => {
            await expect(new WalletTransaction(newTransaction).validate()).resolves.toBeUndefined();
        });

        test('should correctly validate a bonus transaction', async () => {
            const bonusTransaction = {
                ...newTransaction,
                isBonus: true,
                description: 'Bonus payment for excellent work'
            };
            await expect(new WalletTransaction(bonusTransaction).validate()).resolves.toBeUndefined();
        });

        test('should default isBonus to false when not provided', async () => {
            const { isBonus, ...transactionWithoutBonus } = newTransaction;
            const transaction = new WalletTransaction(transactionWithoutBonus);
            await transaction.validate();
            expect(transaction.isBonus).toBe(false);
        });

        test('should throw a validation error if amount is negative', async () => {
            const invalidTransaction = {
                ...newTransaction,
                amount: -100
            };
            await expect(new WalletTransaction(invalidTransaction).validate()).rejects.toThrow();
        });

        test('should throw a validation error if amount is not a number', async () => {
            const invalidTransaction = {
                ...newTransaction,
                amount: 'invalid'
            };
            await expect(new WalletTransaction(invalidTransaction).validate()).rejects.toThrow();
        });

        test('should throw a validation error if type is invalid', async () => {
            const invalidTransaction = {
                ...newTransaction,
                type: 'INVALID_TYPE'
            };
            await expect(new WalletTransaction(invalidTransaction).validate()).rejects.toThrow();
        });

        test('should throw a validation error if userId is missing', async () => {
            const { userId, ...transactionWithoutUserId } = newTransaction;
            await expect(new WalletTransaction(transactionWithoutUserId).validate()).rejects.toThrow();
        });

        test('should throw a validation error if description is missing', async () => {
            const { description, ...transactionWithoutDescription } = newTransaction;
            await expect(new WalletTransaction(transactionWithoutDescription).validate()).rejects.toThrow();
        });
    });

    describe('WalletTransaction virtuals', () => {
        test('should format amount correctly', () => {
            const transaction = new WalletTransaction({
                userId: new mongoose.Types.ObjectId(),
                type: 'SITE_ENGINEER_PAYMENT',
                amount: 1500,
                description: 'Test payment',
                currency: 'INR'
            });

            expect(transaction.formattedAmount).toBe('₹1,500');
        });
    });
});
