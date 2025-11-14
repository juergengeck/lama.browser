/**
 * VC Export Service
 *
 * Exports subscription certificates as W3C Verifiable Credentials with verification URLs.
 */

import type { Certificate } from '@trust/core/recipes/Certificate';
import type { VerifiableCredential } from '@trust/core/recipes/VerifiableCredential';

/**
 * Certificate export format
 */
export interface CertificateExport {
  vc: VerifiableCredential;
  jsonLD: string;
  verificationUrl: string;
  shortCode: string;
}

/**
 * Generate short code for certificate
 * Uses last 8 chars of certificate ID hash
 */
export function generateShortCode(certificateId: string): string {
  // Remove any prefixes and get hash portion
  const hashPortion = certificateId.split(':').pop() || certificateId;
  // Take last 8 characters (base62-like short code)
  return hashPortion.slice(-8).toLowerCase();
}

/**
 * Create verification URL for certificate
 * Format: /v/<shortcode>
 * Reddit-style: short, memorable, shareable
 */
export function createVerificationUrl(shortCode: string, baseUrl?: string): string {
  const base = baseUrl || window.location.origin;
  return `${base}/v/${shortCode}`;
}

/**
 * Convert Certificate to W3C Verifiable Credential
 * (Simplified version - full VCBridge conversion in trust.core)
 */
export function certificateToVC(cert: Certificate): VerifiableCredential {
  const issuerDID = `did:one:sha256:${cert.issuer}`;
  const subjectDID = typeof cert.subject === 'string' && cert.subject.startsWith('did:')
    ? cert.subject
    : `did:one:sha256:${cert.subject}`;

  const vc: VerifiableCredential = {
    $type$: 'VerifiableCredential',
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://lama.one/credentials/v1'
    ],
    type: ['VerifiableCredential', 'SubscriptionCredential'],
    issuer: issuerDID,
    issuanceDate: new Date(cert.issuedAt).toISOString(),
    expirationDate: new Date(cert.validUntil).toISOString(),
    credentialSubject: {
      id: subjectDID,
      type: cert.certificateType,
      ...cert.claims
    },
    proof: cert.signature ? {
      type: 'Ed25519Signature2020',
      created: new Date(cert.issuedAt).toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: `${issuerDID}#keys-1`,
      proofValue: cert.signature
    } : undefined,
    // ONE.core metadata for bidirectional conversion
    oneCoreMetadata: {
      certificateId: cert.id,
      certificateType: cert.certificateType,
      serialNumber: cert.serialNumber,
      version: cert.version,
      chainDepth: cert.chainDepth
    }
  };

  return vc;
}

/**
 * Export certificate as VC with verification URL
 */
export async function exportCertificate(
  cert: Certificate,
  baseUrl?: string
): Promise<CertificateExport> {
  // Convert to VC
  const vc = certificateToVC(cert);

  // Generate short code
  const shortCode = generateShortCode(cert.id);

  // Create verification URL
  const verificationUrl = createVerificationUrl(shortCode, baseUrl);

  // Serialize to JSON-LD
  const jsonLD = JSON.stringify(vc, null, 2);

  return {
    vc,
    jsonLD,
    verificationUrl,
    shortCode
  };
}

/**
 * Store certificate export for verification
 * Uses IndexedDB to store certificate data keyed by short code
 */
export async function storeForVerification(
  shortCode: string,
  certificateExport: CertificateExport
): Promise<void> {
  const dbName = 'lama-certificate-store';
  const storeName = 'certificates';

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      const data = {
        shortCode,
        vc: certificateExport.vc,
        jsonLD: certificateExport.jsonLD,
        verificationUrl: certificateExport.verificationUrl,
        storedAt: Date.now()
      };

      const putRequest = store.put(data);

      putRequest.onsuccess = () => {
        db.close();
        resolve();
      };

      putRequest.onerror = () => {
        db.close();
        reject(putRequest.error);
      };
    };

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        const objectStore = db.createObjectStore(storeName, { keyPath: 'shortCode' });
        objectStore.createIndex('storedAt', 'storedAt', { unique: false });
      }
    };
  });
}

/**
 * Retrieve certificate export by short code
 */
export async function retrieveByShortCode(shortCode: string): Promise<CertificateExport | null> {
  const dbName = 'lama-certificate-store';
  const storeName = 'certificates';

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);

      const getRequest = store.get(shortCode);

      getRequest.onsuccess = () => {
        db.close();
        const result = getRequest.result;
        if (result) {
          resolve({
            vc: result.vc,
            jsonLD: result.jsonLD,
            verificationUrl: result.verificationUrl,
            shortCode: result.shortCode
          });
        } else {
          resolve(null);
        }
      };

      getRequest.onerror = () => {
        db.close();
        reject(getRequest.error);
      };
    };

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        const objectStore = db.createObjectStore(storeName, { keyPath: 'shortCode' });
        objectStore.createIndex('storedAt', 'storedAt', { unique: false });
      }
    };
  });
}

/**
 * Download VC as JSON-LD file
 */
export function downloadVC(jsonLD: string, filename: string = 'subscription-credential.json') {
  const blob = new Blob([jsonLD], { type: 'application/ld+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
