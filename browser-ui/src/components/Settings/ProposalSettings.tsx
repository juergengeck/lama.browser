/**
 * ProposalSettings Component
 * Configure proposal matching algorithm
 *
 * Browser platform - uses useProposalConfig hook
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@refinio/lama.ui';
import { Label } from '@refinio/lama.ui';
import { Alert, AlertDescription } from '@refinio/lama.ui';
import { Loader2 } from 'lucide-react';
import { useProposalConfig } from '@/hooks/useProposalConfig';

export const ProposalSettings: React.FC = () => {
  const { config, loading, error, updateConfig } = useProposalConfig();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading proposal settings...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <Alert variant="destructive">
            <AlertDescription>Error loading settings: {error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="p-8">
          <Alert>
            <AlertDescription>No settings available</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const handleSettingChange = async (field: keyof typeof config, value: any) => {
    try {
      await updateConfig({ [field]: value });
    } catch (err) {
      console.error('[ProposalSettings] Failed to update:', err);
    }
  };

  const totalWeight = config.matchWeight + config.recencyWeight;
  const normalizedMatchWeight = totalWeight > 0 ? config.matchWeight / totalWeight : 0.5;
  const normalizedRecencyWeight = totalWeight > 0 ? config.recencyWeight / totalWeight : 0.5;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proposal Settings</CardTitle>
        <CardDescription>
          Configure how LAMA suggests relevant past conversations based on subject and keyword matching.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Match Weight */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="matchWeight" className="text-base font-medium">
              Match Weight
            </Label>
            <span className="text-sm text-muted-foreground">
              {config.matchWeight.toFixed(2)} ({(normalizedMatchWeight * 100).toFixed(0)}%)
            </span>
          </div>
          <input
            id="matchWeight"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.matchWeight}
            onChange={(e) => handleSettingChange('matchWeight', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <p className="text-sm text-muted-foreground">
            How much to prioritize keyword overlap (Jaccard similarity)
          </p>
        </div>

        {/* Recency Weight */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="recencyWeight" className="text-base font-medium">
              Recency Weight
            </Label>
            <span className="text-sm text-muted-foreground">
              {config.recencyWeight.toFixed(2)} ({(normalizedRecencyWeight * 100).toFixed(0)}%)
            </span>
          </div>
          <input
            id="recencyWeight"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.recencyWeight}
            onChange={(e) => handleSettingChange('recencyWeight', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <p className="text-sm text-muted-foreground">
            How much to prioritize recent conversations
          </p>
        </div>

        {/* Recency Window */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="recencyWindow" className="text-base font-medium">
              Recency Window
            </Label>
            <span className="text-sm text-muted-foreground">
              {Math.floor(config.recencyWindow / (24 * 60 * 60 * 1000))} days
            </span>
          </div>
          <input
            id="recencyWindow"
            type="range"
            min={1 * 24 * 60 * 60 * 1000}
            max={90 * 24 * 60 * 60 * 1000}
            step={24 * 60 * 60 * 1000}
            value={config.recencyWindow}
            onChange={(e) => handleSettingChange('recencyWindow', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <p className="text-sm text-muted-foreground">
            Time window for recency boost (1-90 days)
          </p>
        </div>

        {/* Min Jaccard */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="minJaccard" className="text-base font-medium">
              Minimum Similarity
            </Label>
            <span className="text-sm text-muted-foreground">
              {config.minJaccard.toFixed(2)}
            </span>
          </div>
          <input
            id="minJaccard"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.minJaccard}
            onChange={(e) => handleSettingChange('minJaccard', parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <p className="text-sm text-muted-foreground">
            Minimum Jaccard similarity threshold (0.0-1.0)
          </p>
        </div>

        {/* Max Proposals */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="maxProposals" className="text-base font-medium">
              Max Proposals
            </Label>
            <span className="text-sm text-muted-foreground">
              {config.maxProposals}
            </span>
          </div>
          <input
            id="maxProposals"
            type="range"
            min={1}
            max={50}
            step={1}
            value={config.maxProposals}
            onChange={(e) => handleSettingChange('maxProposals', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <p className="text-sm text-muted-foreground">
            Maximum number of proposals to display (1-50)
          </p>
        </div>

        {/* Example Calculation */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
          <h3 className="text-sm font-semibold mb-3">Example Calculation</h3>
          <div className="text-sm font-mono space-y-1.5 text-muted-foreground">
            <div>Jaccard Similarity: 0.40 (40% keywords match)</div>
            <div>Recency Boost: 0.80 (recent conversation)</div>
            <div className="border-t pt-2 mt-2">
              Relevance Score = (0.40 × {normalizedMatchWeight.toFixed(2)}) + (0.80 × {normalizedRecencyWeight.toFixed(2)})
            </div>
            <div className="font-semibold text-foreground">
              = {(0.40 * normalizedMatchWeight + 0.80 * normalizedRecencyWeight).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="pt-4 border-t text-sm text-muted-foreground">
          Settings are automatically synced across all your LAMA instances.
        </div>
      </CardContent>
    </Card>
  );
};
