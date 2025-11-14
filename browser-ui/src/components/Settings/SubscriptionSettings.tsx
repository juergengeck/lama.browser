/**
 * SubscriptionSettings Component
 *
 * Displays subscription balance, history, and links to purchase view
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Badge } from '@lama/ui';
import { CreditCard, ExternalLink, TrendingUp, Wallet } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

interface SubscriptionSettingsProps {
  onNavigateToPurchase?: () => void;
}

export function SubscriptionSettings({ onNavigateToPurchase }: SubscriptionSettingsProps) {
  const { balance, totalDeposited, tier, isActive, daysRemaining } = useSubscription();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Subscription & Balance
            </CardTitle>
            <CardDescription>
              Manage your identity subscription and account balance
            </CardDescription>
          </div>
          <Button onClick={onNavigateToPurchase} variant="outline">
            <CreditCard className="w-4 h-4 mr-2" />
            Add Funds
            <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
                <p className="text-3xl font-bold text-primary">{balance.toFixed(2)}€</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Total Deposited</p>
                <p className="text-2xl font-semibold flex items-center justify-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  {totalDeposited.toFixed(2)}€
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Subscription Tier</p>
                <div className="mt-2">
                  <Badge variant={tier === 'free' ? 'outline' : 'default'}>
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </Badge>
                  {tier !== 'free' && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {daysRemaining} days remaining
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
          <div>
            <p className="font-medium">Account Status</p>
            <p className="text-sm text-muted-foreground">
              {isActive ? 'Your subscription is active' : 'No active subscription'}
            </p>
          </div>
          <Badge variant={isActive ? 'default' : 'outline'}>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Info */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>About Identity Subscriptions:</strong> You're purchasing time-bound cryptographic proof
            that you own a specific identity (e.g., elon@glue.one).
          </p>
          <p>
            This service provides a root of trust for unknown 3rd parties. LAMA software remains free -
            you manage your own identities locally.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
