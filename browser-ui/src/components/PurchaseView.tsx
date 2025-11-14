/**
 * PurchaseView Component
 *
 * Identity subscription service - NOT software licensing.
 * LAMA software is free. You're buying identity attestation.
 *
 * Service: Time-bound proof of identity ownership (e.g., claude@glue.one)
 * Pricing: 1€/month or 10€/year
 * Purpose: Root of trust for unknown 3rd parties
 * Format: W3C Verifiable Credential with QR code
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@lama/ui';
import { Button } from '@lama/ui';
import { Badge } from '@lama/ui';
import { Check, CreditCard, Shield } from 'lucide-react';
import { useModel } from '@/model/ModelContext';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionExport } from '@/components/SubscriptionExport';
import type { Certificate } from '@trust/core/recipes/Certificate';

export interface PurchaseViewProps {
  onPurchaseComplete?: () => void;
}

export function PurchaseView({ onPurchaseComplete }: PurchaseViewProps) {
  const model = useModel();
  const { subscription, isLoading: subscriptionLoading, balance, totalDeposited, addDeposit } = useSubscription();
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'monthly' | 'yearly' | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [mockCertificate, setMockCertificate] = useState<Certificate | null>(null);

  // Auto-fill deposit amount when tier is selected
  const handleTierSelect = (tierId: 'monthly' | 'yearly') => {
    setSelectedTier(tierId);
    const tier = tiers.find(t => t.id === tierId);
    if (tier) {
      setDepositAmount(tier.price.toFixed(2));
    }
    setError(null);
  };

  const tiers = [
    {
      id: 'monthly' as const,
      name: 'Monthly',
      price: 1.00,
      priceLabel: '1€/month',
      features: [
        'Cryptographically signed attestation',
        'W3C Verifiable Credential',
        'QR code for instant verification',
        'Shareable verification URL',
        'Valid for 30 days'
      ]
    },
    {
      id: 'yearly' as const,
      name: 'Yearly',
      price: 10.00,
      priceLabel: '10€/year',
      badge: 'Save 17%',
      features: [
        'All monthly features',
        'Valid for 365 days',
        'Priority support',
        'Best value - 2 months free'
      ]
    }
  ];

  const handlePurchase = async (tier: 'monthly' | 'yearly') => {
    setError(null);
    setIsProcessing(true);

    try {
      const tierConfig = tiers.find(t => t.id === tier);
      if (!tierConfig) throw new Error('Invalid tier');

      // Validate deposit amount
      const deposit = parseFloat(depositAmount);
      if (isNaN(deposit) || deposit < tierConfig.price) {
        throw new Error(`Minimum deposit is ${tierConfig.price}€`);
      }

      // TODO: Call trust.core SubscriptionPlan to issue certificate
      // For now, this is a dummy implementation that just validates the input
      console.log('[PurchaseView] Processing payment:', {
        tier,
        price: tierConfig.price,
        deposit,
        userId: model.ownerId
      });

      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // TODO: Actually issue subscription certificate here
      // const subscriptionPlan = new SubscriptionPlan(model.caModel);
      // const result = await subscriptionPlan.issueSubscription({
      //   userId: model.ownerId,
      //   userPublicKey: model.publicKey,
      //   tier,
      //   priceEur: tierConfig.price,
      //   paymentId: `dummy-${Date.now()}`,
      //   depositAmount: deposit,
      //   autoRenew: false
      // });

      // For demo purposes, create a mock certificate
      const now = Date.now();
      const validityDays = tier === 'yearly' ? 365 : 30;

      // Generate example identity (user@domain.tld)
      const exampleIdentity = `demo-user@glue.one`;

      const mockCert: Certificate = {
        $type$: 'Certificate',
        id: `cert:identity:${exampleIdentity}:${now}`,
        certificateType: 'identity',  // Identity attestation, not service
        status: 'valid',
        subject: model.ownerId || exampleIdentity,
        subjectPublicKey: 'demo-public-key',
        issuer: 'did:one:lama.one' as any,
        issuerPublicKey: 'lama-issuer-key',
        validFrom: now,
        validUntil: now + (validityDays * 24 * 60 * 60 * 1000),
        chainDepth: 0,
        claims: {
          // Identity claims
          identity: exampleIdentity,
          domain: 'glue.one',
          localPart: 'demo-user',

          // Subscription details
          tier,
          priceEur: tierConfig.price,
          subscriptionStatus: 'active',
          paymentId: `dummy-${Date.now()}`,
          depositAmount: deposit,
          autoRenew: false,

          // Service description
          service: 'Identity attestation and verification',
          purpose: 'Root of trust for 3rd party verification'
        },
        issuedAt: now,
        serialNumber: `SN${Date.now()}`,
        version: 1,
        signature: 'mock-signature-' + Date.now()
      };

      setMockCertificate(mockCert);

      console.log('[PurchaseView] Adding deposit:', deposit);
      // Add deposit to balance, then subtract subscription cost
      // Example: Deposit 20€, subscription costs 10€ → balance increases by 10€
      await addDeposit(deposit);

      console.log('[PurchaseView] Deducting subscription cost:', tierConfig.price);
      // Deduct subscription cost from balance
      await addDeposit(-tierConfig.price);

      console.log('[PurchaseView] Purchase completed successfully');

      // Success!
      setSelectedTier(null);
      setDepositAmount('');
      onPurchaseComplete?.();

    } catch (err) {
      console.error('[PurchaseView] Purchase failed:', err);
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto ios-scroll" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Identity Subscription Service</h1>
            <p className="text-muted-foreground mb-2">
              Subscribe to an identity (e.g., <code className="bg-muted px-2 py-1 rounded">elon@glue.one</code>)
            </p>
          </div>
          <Card className="bg-primary/10 border-primary">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
                <p className="text-3xl font-bold text-primary">{balance.toFixed(2)}€</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Total Deposited: {totalDeposited.toFixed(2)}€
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <p className="text-sm text-muted-foreground">
          ✓ LAMA software is free  •  ✓ You manage your own identities  •  ✓ This is your root of trust
        </p>
      </div>

      {/* Current Subscription Certificate */}
      {mockCertificate && (
        <Card className="mb-6 border-green-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-green-500" />
                <div>
                  <CardTitle>Identity Certificate Active</CardTitle>
                  <CardDescription>
                    <code className="bg-muted px-2 py-1 rounded">{mockCertificate.claims?.identity}</code>
                  </CardDescription>
                </div>
              </div>
              <SubscriptionExport certificate={mockCertificate} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Identity:</span>
              <span className="font-mono">{mockCertificate.claims?.identity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tier:</span>
              <Badge variant="outline">{mockCertificate.claims?.tier}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valid Until:</span>
              <span>{new Date(mockCertificate.validUntil).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Certificate ID:</span>
              <span className="font-mono text-xs">{mockCertificate.serialNumber}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {tiers.map((tier) => (
          <Card
            key={tier.id}
            className={selectedTier === tier.id ? 'border-primary' : ''}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{tier.name}</CardTitle>
                {tier.badge && (
                  <Badge variant="secondary">{tier.badge}</Badge>
                )}
              </div>
              <CardDescription>
                <span className="text-3xl font-bold">{tier.priceLabel}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {tier.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={selectedTier === tier.id ? 'default' : 'outline'}
                onClick={() => handleTierSelect(tier.id)}
                disabled={isProcessing}
              >
                {selectedTier === tier.id ? 'Selected' : 'Select Plan'}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {selectedTier && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Complete Purchase
            </CardTitle>
            <CardDescription>
              {tiers.find(t => t.id === selectedTier)?.name} Plan - {tiers.find(t => t.id === selectedTier)?.priceLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Purchase Summary */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Selected Plan:</span>
                <span className="font-medium">{tiers.find(t => t.id === selectedTier)?.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subscription Price:</span>
                <span className="font-medium">{tiers.find(t => t.id === selectedTier)?.priceLabel}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Identity:</span>
                <code className="text-xs bg-background px-2 py-1 rounded">demo-user@glue.one</code>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Deposit Amount (EUR) *
              </label>
              <input
                type="number"
                step="0.01"
                min={tiers.find(t => t.id === selectedTier)?.price}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full px-4 py-3 border border-input bg-background rounded-md text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder={`Minimum ${tiers.find(t => t.id === selectedTier)?.price}€`}
                disabled={isProcessing}
                autoFocus
              />
              <p className="text-xs text-muted-foreground mt-1">
                Minimum deposit: {tiers.find(t => t.id === selectedTier)?.price}€
              </p>
            </div>

            <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded-md">
              <p className="font-medium mb-1">📝 Development Mode:</p>
              <p>• This is a dummy payment for development purposes</p>
              <p>• No real payment will be processed</p>
              <p>• A subscription certificate will be issued via trust.core</p>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedTier(null);
                setDepositAmount('');
                setError(null);
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => handlePurchase(selectedTier)}
              disabled={isProcessing || !depositAmount}
            >
              {isProcessing ? 'Processing...' : 'Complete Purchase'}
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="mt-8 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
        <p className="font-semibold mb-2">Development Note:</p>
        <p>
          This is a dummy payment interface for development. In production, this would integrate
          with a real payment processor (Stripe, PayPal, etc.) and issue proper subscription
          certificates via trust.core's SubscriptionPlan.
        </p>
      </div>
      </div>
    </div>
  );
}
