/**
 * SubscriptionExport Component
 *
 * Exports subscription certificate as W3C Verifiable Credential with QR code.
 */

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@lama/ui';
import { Button } from '@lama/ui';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@lama/ui';
import { Download, Copy, Share2, ExternalLink, Check } from 'lucide-react';
import QRCode from 'qrcode';
import type { Certificate } from '@trust/core/recipes/Certificate';
import { exportCertificate, storeForVerification, downloadVC } from '@/services/vc-export';
import type { CertificateExport } from '@/services/vc-export';

export interface SubscriptionExportProps {
  certificate: Certificate;
}

export function SubscriptionExport({ certificate }: SubscriptionExportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [certificateExport, setCertificateExport] = useState<CertificateExport | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * Generate QR code and export data when dialog opens
   */
  useEffect(() => {
    if (!isOpen) return;

    const generateExport = async () => {
      setIsProcessing(true);
      try {
        // Export certificate as VC
        const exportData = await exportCertificate(certificate);
        setCertificateExport(exportData);

        // Store for verification
        await storeForVerification(exportData.shortCode, exportData);

        // Generate QR code
        const dataUrl = await QRCode.toDataURL(exportData.verificationUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        setQrCodeDataUrl(dataUrl);

      } catch (error) {
        console.error('[SubscriptionExport] Failed to generate export:', error);
      } finally {
        setIsProcessing(false);
      }
    };

    generateExport();
  }, [isOpen, certificate]);

  /**
   * Copy verification URL to clipboard
   */
  const handleCopyUrl = async () => {
    if (!certificateExport) return;

    try {
      await navigator.clipboard.writeText(certificateExport.verificationUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (error) {
      console.error('[SubscriptionExport] Failed to copy URL:', error);
    }
  };

  /**
   * Copy JSON-LD to clipboard
   */
  const handleCopyJson = async () => {
    if (!certificateExport) return;

    try {
      await navigator.clipboard.writeText(certificateExport.jsonLD);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch (error) {
      console.error('[SubscriptionExport] Failed to copy JSON:', error);
    }
  };

  /**
   * Download VC as JSON-LD file
   */
  const handleDownload = () => {
    if (!certificateExport) return;
    const filename = `subscription-${certificateExport.shortCode}.json`;
    downloadVC(certificateExport.jsonLD, filename);
  };

  /**
   * Share via Web Share API (if available)
   */
  const handleShare = async () => {
    if (!certificateExport) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'LAMA Subscription Certificate',
          text: 'Verify my LAMA.one subscription',
          url: certificateExport.verificationUrl
        });
      } catch (error) {
        // User cancelled or error occurred
        console.log('[SubscriptionExport] Share cancelled or failed');
      }
    } else {
      // Fallback to copy URL
      handleCopyUrl();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ExternalLink className="w-4 h-4 mr-2" />
          Export Certificate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Subscription Certificate</DialogTitle>
          <DialogDescription>
            Share your subscription proof as a W3C Verifiable Credential
          </DialogDescription>
        </DialogHeader>

        {isProcessing ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Generating certificate...</p>
            </div>
          </div>
        ) : certificateExport ? (
          <div className="space-y-6">
            {/* QR Code */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">QR Code</CardTitle>
                <CardDescription>
                  Scan to verify subscription status
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                {qrCodeDataUrl && (
                  <img
                    src={qrCodeDataUrl}
                    alt="Verification QR Code"
                    className="w-64 h-64 border rounded-lg"
                  />
                )}
                <p className="text-sm text-muted-foreground mt-4">
                  Short code: <code className="bg-muted px-2 py-1 rounded">{certificateExport.shortCode}</code>
                </p>
              </CardContent>
            </Card>

            {/* Verification URL */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Verification URL</CardTitle>
                <CardDescription>
                  Share this link to verify your subscription
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={certificateExport.verificationUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-muted border rounded-md text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyUrl}
                  >
                    {copiedUrl ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="flex gap-2">
                  {navigator.share && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShare}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Share
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(certificateExport.verificationUrl, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Test
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* JSON-LD Export */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">W3C Verifiable Credential</CardTitle>
                <CardDescription>
                  JSON-LD format (standard compliant)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto max-h-48">
                    {certificateExport.jsonLD}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={handleCopyJson}
                  >
                    {copiedJson ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download JSON-LD
                </Button>
              </CardContent>
            </Card>

            {/* Certificate Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Certificate Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-mono">{certificate.certificateType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-mono">{certificate.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valid Until:</span>
                  <span>{new Date(certificate.validUntil).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serial:</span>
                  <span className="font-mono text-xs">{certificate.serialNumber}</span>
                </div>
                {certificate.claims && (
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground">Tier:</span>
                    <span className="ml-2 font-semibold">{certificate.claims.tier}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Note */}
            <div className="text-xs text-muted-foreground p-3 bg-muted rounded-md">
              <p className="font-semibold mb-1">About Verifiable Credentials:</p>
              <p>
                This certificate is exported as a W3C Verifiable Credential (VC), a standard format
                for cryptographically-signed claims. Anyone can verify your subscription status
                using the QR code or verification URL.
              </p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
