/**
 * VerificationView Component
 *
 * Public verification page for subscription certificates.
 * Accessed via /v/<shortcode> route.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@refinio/lama.ui';
import { Badge } from '@refinio/lama.ui';
import { Button } from '@refinio/lama.ui';
import { CheckCircle, XCircle, Clock, Shield, ExternalLink, Download } from 'lucide-react';
import { retrieveByShortCode, downloadVC } from '@/services/vc-export';
import type { CertificateExport } from '@/services/vc-export';

export interface VerificationViewProps {
  shortCode: string;
}

export function VerificationView({ shortCode }: VerificationViewProps) {
  const [certificateExport, setCertificateExport] = useState<CertificateExport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCertificate = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await retrieveByShortCode(shortCode);
        if (!data) {
          setError('Certificate not found');
        } else {
          setCertificateExport(data);
        }
      } catch (err) {
        console.error('[VerificationView] Failed to load certificate:', err);
        setError('Failed to load certificate');
      } finally {
        setIsLoading(false);
      }
    };

    loadCertificate();
  }, [shortCode]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Verifying Certificate</h2>
          <p className="text-muted-foreground">Loading certificate data...</p>
        </div>
      </div>
    );
  }

  if (error || !certificateExport) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="w-8 h-8 text-destructive" />
              <CardTitle>Certificate Not Found</CardTitle>
            </div>
            <CardDescription>
              The certificate with code <code className="bg-muted px-2 py-1 rounded">{shortCode}</code> could not be found.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              This could happen if:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>The certificate was not exported yet</li>
              <li>The verification link is incorrect</li>
              <li>The certificate data is not available on this device</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { vc } = certificateExport;
  const now = Date.now();
  const expirationDate = new Date(vc.expirationDate).getTime();
  const isExpired = expirationDate < now;
  const daysRemaining = Math.floor((expirationDate - now) / (24 * 60 * 60 * 1000));

  // Determine status
  const isValid = !isExpired && vc.credentialSubject;
  const tier = (vc.credentialSubject?.tier || 'unknown') as string;
  const identity = (vc.credentialSubject?.identity || 'unknown') as string;
  const domain = (vc.credentialSubject?.domain || '') as string;
  const service = (vc.credentialSubject?.service || 'Identity attestation') as string;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Certificate Verification</h1>
          <p className="text-muted-foreground">
            LAMA.one Subscription Certificate
          </p>
        </div>

        {/* Status Card */}
        <Card className={isValid ? 'border-green-500' : 'border-destructive'}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isValid ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                  <XCircle className="w-8 h-8 text-destructive" />
                )}
                <div>
                  <CardTitle>
                    {isValid ? 'Valid Identity Certificate' : 'Expired Identity Certificate'}
                  </CardTitle>
                  <CardDescription>
                    <code className="bg-muted px-2 py-1 rounded">{identity}</code>
                  </CardDescription>
                </div>
              </div>
              <Badge variant={isValid ? 'default' : 'destructive'}>
                {tier.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Identity Info */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="font-semibold">Attested Identity</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                This certificate proves that the holder controls the identity{' '}
                <code className="bg-muted px-2 py-1 rounded font-semibold">{identity}</code>{' '}
                on the <strong>{domain}</strong> domain.
              </p>
            </div>

            {/* Expiration Info */}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {isExpired ? (
                  <>Expired on {new Date(vc.expirationDate).toLocaleDateString()}</>
                ) : (
                  <>Valid until {new Date(vc.expirationDate).toLocaleDateString()} ({daysRemaining} days remaining)</>
                )}
              </span>
            </div>

            {/* Service Description */}
            <div className="pt-2 border-t">
              <p className="text-sm">
                <strong>Service:</strong> {service}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Root of trust for 3rd party verification
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Certificate Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Certificate Details</CardTitle>
            <CardDescription>
              W3C Verifiable Credential Information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-muted-foreground">Type:</span>
                <div className="font-mono text-xs">{vc.type.join(', ')}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Issued:</span>
                <div>{new Date(vc.issuanceDate).toLocaleDateString()}</div>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Subject DID:</span>
                <div className="font-mono text-xs break-all">{vc.credentialSubject?.id}</div>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Issuer DID:</span>
                <div className="font-mono text-xs break-all">{vc.issuer}</div>
              </div>
              {vc.oneCoreMetadata && (
                <>
                  <div>
                    <span className="text-muted-foreground">Serial Number:</span>
                    <div className="font-mono text-xs">{vc.oneCoreMetadata.serialNumber}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Version:</span>
                    <div className="font-mono text-xs">{vc.oneCoreMetadata.version}</div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cryptographic Proof */}
        {vc.proof && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Cryptographic Proof</CardTitle>
              </div>
              <CardDescription>
                This certificate is cryptographically signed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <div className="font-mono text-xs">{vc.proof.type}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Purpose:</span>
                  <div className="font-mono text-xs">{vc.proof.proofPurpose}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Verification Method:</span>
                  <div className="font-mono text-xs break-all">{vc.proof.verificationMethod}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Signature:</span>
                  <div className="font-mono text-xs break-all bg-muted p-2 rounded">
                    {vc.proof.proofValue?.slice(0, 64)}...
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => downloadVC(certificateExport.jsonLD, `certificate-${shortCode}.json`)}
          >
            <Download className="w-4 h-4 mr-2" />
            Download JSON-LD
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open('https://lama.one', '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Learn More
          </Button>
        </div>

        {/* Footer Info */}
        <div className="text-xs text-muted-foreground p-4 bg-muted rounded-md">
          <p className="font-semibold mb-2">About This Verification</p>
          <p>
            This is a W3C Verifiable Credential issued by LAMA.one. The certificate is stored locally
            and cryptographically signed using Ed25519 signatures. The signature proves the certificate
            was issued by the stated authority and has not been tampered with.
          </p>
          <p className="mt-2">
            Verification Code: <code className="bg-background px-2 py-1 rounded">{shortCode}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
