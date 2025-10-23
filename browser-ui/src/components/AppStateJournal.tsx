import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

/**
 * AppStateJournal - NOT AVAILABLE IN BROWSER
 *
 * appStateModel only exists in Electron version.
 * Browser version always shows "not available" message.
 */
export const AppStateJournal: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          State Journal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">State journaling not available in browser</p>
      </CardContent>
    </Card>
  );
};
