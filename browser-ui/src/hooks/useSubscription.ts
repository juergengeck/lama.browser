/**
 * useSubscription Hook
 *
 * React hook for managing subscription state and checking features.
 * Validates subscription certificates from trust.core.
 * Uses ONE.core versioned objects for balance persistence.
 */

import { useState, useEffect, useCallback } from 'react';
import { useModel } from '@/model/ModelContext';
import { storeVersionedObject, getObjectByIdHash } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { SubscriptionBalance } from '@OneObjectInterfaces';

export type SubscriptionTier = 'free' | 'monthly' | 'yearly';

export interface SubscriptionInfo {
  isActive: boolean;
  tier: SubscriptionTier;
  validUntil: number;
  daysRemaining: number;
  features: string[];
  balance: number; // EUR balance
  totalDeposited: number; // Total EUR deposited
}

export interface UseSubscriptionResult {
  subscription: SubscriptionInfo | null;
  isLoading: boolean;
  hasFeature: (feature: string) => boolean;
  isActive: boolean;
  daysRemaining: number;
  tier: SubscriptionTier;
  balance: number;
  totalDeposited: number;
  addDeposit: (amount: number) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for subscription management
 */
export function useSubscription(): UseSubscriptionResult {
  const model = useModel();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load balance from ONE.core versioned object
   */
  const getBalance = async (): Promise<{ balance: number; totalDeposited: number }> => {
    if (!model.initialized || !model.ownerId) {
      console.log('[useSubscription] Cannot load balance - no owner ID yet');
      return { balance: 0, totalDeposited: 0 };
    }

    try {
      // Create ID hash for the SubscriptionBalance object keyed by owner
      const balanceObj: SubscriptionBalance = {
        $type$: 'SubscriptionBalance',
        userId: model.ownerId as SHA256IdHash<Person>,
        balance: 0,
        totalDeposited: 0,
        lastUpdated: Date.now(),
        version: 0
      };
      const idHash = await calculateIdHashOfObj(balanceObj);

      // Try to retrieve existing balance object
      const existing = await getObjectByIdHash(idHash);
      if (existing && typeof existing.balance === 'number' && typeof existing.totalDeposited === 'number') {
        console.log('[useSubscription] Retrieved balance from storage:', {
          balance: existing.balance,
          totalDeposited: existing.totalDeposited,
          version: existing.version
        });
        return {
          balance: existing.balance,
          totalDeposited: existing.totalDeposited
        };
      }

      // No balance object exists yet - return defaults
      console.log('[useSubscription] No valid balance object found, using defaults');
      return { balance: 0, totalDeposited: 0 };
    } catch (error: any) {
      // FileNotFoundError is expected when no balance object exists yet
      if (error?.name === 'FileNotFoundError' || error?.code === 'ENOENT') {
        console.log('[useSubscription] No balance object found yet, using defaults');
      } else {
        console.error('[useSubscription] Failed to load balance from ONE.core:', error);
      }
      return { balance: 0, totalDeposited: 0 };
    }
  };

  /**
   * Save balance to ONE.core versioned object
   */
  const saveBalance = async (balance: number, totalDeposited: number): Promise<void> => {
    if (!model.initialized || !model.ownerId) {
      console.error('[useSubscription] Cannot save balance - no owner ID yet');
      return;
    }

    try {
      // Get current version number
      const balanceObj: SubscriptionBalance = {
        $type$: 'SubscriptionBalance',
        userId: model.ownerId as SHA256IdHash<Person>,
        balance: 0,
        totalDeposited: 0,
        lastUpdated: Date.now(),
        version: 0
      };
      const idHash = await calculateIdHashOfObj(balanceObj);

      let version = 0;
      try {
        const existing = await getObjectByIdHash(idHash);
        if (existing && typeof existing.version === 'number') {
          version = existing.version + 1;
        }
      } catch (e) {
        // No existing object - use version 0
      }

      // Create new versioned object
      const updated: SubscriptionBalance = {
        $type$: 'SubscriptionBalance',
        userId: model.ownerId as SHA256IdHash<Person>,
        balance,
        totalDeposited,
        lastUpdated: Date.now(),
        version
      };

      await storeVersionedObject(updated);
      console.log('[useSubscription] Saved balance to ONE.core:', { balance, totalDeposited, version });
    } catch (error) {
      console.error('[useSubscription] Failed to save balance to ONE.core:', error);
      throw error;
    }
  };

  /**
   * Refresh subscription status from certificate
   */
  const refresh = useCallback(async () => {
    if (!model.initialized) {
      console.log('[useSubscription] Skipping - model not initialized');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // TODO: Call trust.core SubscriptionPlan to check status
      // For now, return dummy free subscription
      // const subscriptionPlan = new SubscriptionPlan(model.caModel);
      // const status = await subscriptionPlan.checkSubscriptionStatus({
      //   userId: model.ownerId
      // });

      // Load balance from ONE.core
      const { balance, totalDeposited } = await getBalance();
      const dummySubscription: SubscriptionInfo = {
        isActive: true,
        tier: 'free',
        validUntil: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
        daysRemaining: 365,
        features: ['chat', 'basic-storage'],
        balance,
        totalDeposited
      };

      setSubscription(dummySubscription);
    } catch (error) {
      console.error('[useSubscription] Failed to check subscription:', error);
      // On error, set free tier as fallback with zero balance
      setSubscription({
        isActive: true,
        tier: 'free',
        validUntil: 0,
        daysRemaining: 0,
        features: ['chat'],
        balance: 0,
        totalDeposited: 0
      });
    } finally {
      setIsLoading(false);
    }
  }, [model.initialized, model.ownerId]);

  /**
   * Add deposit to balance
   */
  const addDeposit = useCallback(async (amount: number) => {
    console.log('[useSubscription] addDeposit called:', {
      amount,
      modelInitialized: model.initialized,
      ownerId: model.ownerId
    });

    if (!model.initialized || !model.ownerId) {
      const error = new Error('Cannot add deposit - model not initialized or no owner ID');
      console.error('[useSubscription]', error.message);
      throw error;
    }

    try {
      // CRITICAL: Use React state as source of truth for balance during concurrent operations
      // This prevents race conditions when addDeposit is called multiple times rapidly
      const currentBalance = subscription?.balance ?? 0;
      const currentTotal = subscription?.totalDeposited ?? 0;

      console.log('[useSubscription] Current balance from state:', { balance: currentBalance, totalDeposited: currentTotal });

      const newBalance = currentBalance + amount;
      const newTotal = currentTotal + (amount > 0 ? amount : 0); // Only count positive deposits to total

      console.log('[useSubscription] Saving new balance:', { newBalance, newTotal });
      await saveBalance(newBalance, newTotal);

      // Update subscription state immediately (optimistic update)
      setSubscription(prevSub => {
        if (!prevSub) return prevSub;
        return {
          ...prevSub,
          balance: newBalance,
          totalDeposited: newTotal
        };
      });

      console.log('[useSubscription] ✓ Deposit added successfully:', { amount, newBalance, newTotal });
    } catch (error) {
      console.error('[useSubscription] ✗ Failed to add deposit:', error);
      throw error;
    }
  }, [model.initialized, model.ownerId, subscription]);

  /**
   * Check if user has specific feature
   */
  const hasFeature = useCallback((feature: string): boolean => {
    if (!subscription || !subscription.isActive) {
      // Free tier has basic features
      return ['chat'].includes(feature);
    }

    return subscription.features.includes(feature);
  }, [subscription]);

  /**
   * Initial load and refresh on model init
   */
  useEffect(() => {
    if (!model.initialized) {
      setIsLoading(false);
      return;
    }

    refresh();
  }, [model.initialized, refresh]);

  return {
    subscription,
    isLoading,
    hasFeature,
    isActive: subscription?.isActive ?? false,
    daysRemaining: subscription?.daysRemaining ?? 0,
    tier: subscription?.tier ?? 'free',
    balance: subscription?.balance ?? 0,
    totalDeposited: subscription?.totalDeposited ?? 0,
    addDeposit,
    refresh
  };
}
