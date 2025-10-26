/**
 * Credential Verification API Contract
 *
 * Defines interfaces for W3C Verifiable Credential verification including
 * signature validation, expiration checking, trust chain verification,
 * and revocation checking via versioned credentials.
 */

import type { VersionedCredential, CredentialSubject, CryptographicProof } from './platform-deps';

/**
 * Credential verifier service
 *
 * Performs comprehensive verification of W3C Verifiable Credentials
 */
export interface CredentialVerifier {
  /**
   * Initialize verifier with trusted issuers
   * @param trustedIssuers List of trusted issuer DIDs
   */
  initialize(trustedIssuers: string[]): void;

  /**
   * Perform full credential verification
   *
   * Checks:
   * 1. Signature validity
   * 2. Expiration
   * 3. Trust chain (issuer is trusted)
   * 4. Revocation (via versioned credentials)
   *
   * @param credential Credential to verify
   * @param storage Storage adapter for revocation checking
   * @returns Verification result with details
   */
  verify(credential: VersionedCredential, storage?: any): Promise<VerificationResult>;

  /**
   * Verify cryptographic signature only
   * @returns true if signature is valid
   */
  verifySignature(credential: VersionedCredential): Promise<boolean>;

  /**
   * Check if credential is expired
   * @returns true if expired
   */
  checkExpiration(credential: VersionedCredential): boolean;

  /**
   * Check if issuer is trusted
   * @returns true if trusted
   */
  checkTrustChain(credential: VersionedCredential): boolean;

  /**
   * Check if credential has been revoked
   * Uses versioned credential logic: newer version with earlier validFrom = revoked
   *
   * @param credential Credential to check
   * @param storage Storage adapter to query credential versions
   * @returns true if revoked
   */
  checkRevocation(credential: VersionedCredential, storage: any): Promise<boolean>;

  /**
   * Add trusted issuer
   */
  addTrustedIssuer(issuerDid: string): void;

  /**
   * Remove trusted issuer
   */
  removeTrustedIssuer(issuerDid: string): void;

  /**
   * Get list of trusted issuers
   */
  getTrustedIssuers(): string[];
}

/**
 * Credential verification result
 */
export interface VerificationResult {
  /** Overall verification status */
  status: VerificationStatus;

  /** Credential being verified */
  credential: VersionedCredential;

  /** Individual check results */
  checks: {
    signature: boolean;
    expiration: boolean;
    trustChain: boolean;
    revocation: boolean;
  };

  /** Verification timestamp */
  verifiedAt: number;

  /** Error details if verification failed */
  error?: VerificationError;
}

export type VerificationStatus =
  | 'valid' // All checks passed
  | 'expired' // Credential expired
  | 'revoked' // Credential revoked via versioning
  | 'untrusted' // Issuer not in trusted list
  | 'invalid_signature' // Signature verification failed
  | 'malformed'; // Credential structure invalid

/**
 * Verification error details
 */
export interface VerificationError {
  code: VerificationErrorCode;
  message: string;
  details?: any;
}

export type VerificationErrorCode =
  | 'SIGNATURE_INVALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'UNTRUSTED_ISSUER'
  | 'MALFORMED_CREDENTIAL'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_DATE_FORMAT'
  | 'VERIFICATION_FAILED';

/**
 * Signature verifier
 *
 * Handles cryptographic signature verification for different signature types
 */
export interface SignatureVerifier {
  /**
   * Verify signature on credential
   *
   * @param credential Credential with proof
   * @param publicKey Public key to verify with
   * @returns true if signature is valid
   */
  verify(credential: VersionedCredential, publicKey: string): Promise<boolean>;

  /**
   * Get supported signature types
   */
  getSupportedTypes(): string[];

  /**
   * Check if signature type is supported
   */
  supportsType(type: string): boolean;
}

/**
 * Revocation checker using versioned credentials
 *
 * Implements revocation via credential versioning:
 * - Newer version with earlier validFrom date invalidates older version
 */
export interface RevocationChecker {
  /**
   * Check if credential is revoked
   *
   * Algorithm:
   * 1. Extract credential ID (without version suffix)
   * 2. Query storage for all versions of same credential
   * 3. For each newer version (higher version number):
   *    - If validFrom < current_credential.issuanceDate: REVOKED
   * 4. If no revoking version found: NOT REVOKED
   *
   * @param credential Credential to check
   * @param storage Storage adapter to query versions
   * @returns Revocation check result
   */
  check(credential: VersionedCredential, storage: any): Promise<RevocationCheckResult>;

  /**
   * Parse credential ID to extract base ID and version
   * Example: "did:example:123#v2" → { baseId: "did:example:123", version: 2 }
   */
  parseCredentialId(credentialId: string): CredentialIdParts;

  /**
   * Check if one credential revokes another via versioning
   */
  isRevokingVersion(newer: VersionedCredential, older: VersionedCredential): boolean;
}

export interface RevocationCheckResult {
  revoked: boolean;
  revokedBy?: VersionedCredential; // Newer credential that revoked this one
  checkedAt: number;
}

export interface CredentialIdParts {
  baseId: string; // e.g., "did:example:123"
  version: number; // e.g., 2
}

/**
 * Credential validation rules
 *
 * Validates credential structure and required fields
 */
export interface CredentialValidator {
  /**
   * Validate credential structure
   * @throws Error if credential is malformed
   */
  validate(credential: VersionedCredential): void;

  /**
   * Check if credential has required fields
   */
  hasRequiredFields(credential: VersionedCredential): boolean;

  /**
   * Validate date formats (ISO 8601)
   */
  validateDates(credential: VersionedCredential): boolean;

  /**
   * Validate proof structure
   */
  validateProof(proof: CryptographicProof): boolean;

  /**
   * Validate credential subject
   */
  validateSubject(subject: CredentialSubject): boolean;
}

/**
 * Required W3C VC context
 */
export const W3C_VC_CONTEXT = 'https://www.w3.org/2018/credentials/v1';

/**
 * Required credential types
 */
export const REQUIRED_CREDENTIAL_TYPES = ['VerifiableCredential'];

/**
 * Supported signature types
 */
export const SUPPORTED_SIGNATURE_TYPES = [
  'Ed25519Signature2020',
  'Ed25519Signature2018',
  'RsaSignature2018',
  'EcdsaSecp256k1Signature2019',
];

/**
 * Credential field validation rules
 */
export const CREDENTIAL_VALIDATION_RULES = {
  requiredFields: [
    '@context',
    'type',
    'id',
    'issuer',
    'issuanceDate',
    'expirationDate',
    'credentialSubject',
    'proof',
    'validFrom',
    'version',
  ],
  contextMustInclude: [W3C_VC_CONTEXT],
  typeMustInclude: REQUIRED_CREDENTIAL_TYPES,
  dateFormat: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/, // ISO 8601
  versionFormat: /^[1-9]\d*$/, // Positive integer
};

/**
 * Credential issuer interface
 *
 * NOTE: This is for reference - connection.core primarily CONSUMES credentials,
 * not issues them. Issuer implementation may be in separate package.
 */
export interface CredentialIssuer {
  /**
   * Issue new credential
   */
  issue(subject: CredentialSubject, validity: ValidityPeriod): Promise<VersionedCredential>;

  /**
   * Revoke credential by issuing new version with backdated validFrom
   */
  revoke(credentialId: string): Promise<VersionedCredential>;

  /**
   * Update credential (issue new version)
   */
  update(credentialId: string, subject: CredentialSubject): Promise<VersionedCredential>;
}

export interface ValidityPeriod {
  from: Date;
  until: Date;
}

/**
 * Trust chain configuration
 */
export interface TrustConfig {
  /** List of trusted issuer DIDs */
  trustedIssuers: string[];

  /** Require trust chain validation (if false, skip trust check) */
  requireTrust: boolean;

  /** Allow self-issued credentials */
  allowSelfIssued: boolean;
}

export const DEFAULT_TRUST_CONFIG: TrustConfig = {
  trustedIssuers: [],
  requireTrust: false, // Initially permissive for development
  allowSelfIssued: true, // Allow self-signed credentials for initial pairing
};
