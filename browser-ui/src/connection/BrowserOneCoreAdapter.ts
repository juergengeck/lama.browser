/**
 * lama.browser ONE.core Adapter Implementation
 *
 * Browser platform adapter for connection.core
 */

import type {
  OneCoreAdapter,
  OneCoreLeute,
  OneCoreChannels,
  OneCoreConnections,
  OneCoreTopics,
  OneCoreAttestation,
  GroupWithCertificate,
  ChannelInfo,
  TopicMessage,
  CertificateSet
} from '../../../connection.core/src/adapters/OneCoreAdapter.js';
import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks';

/**
 * lama.browser ONE.core adapter
 * Wraps browser Model's ONE.core instances for use with connection.core
 */
export class BrowserOneCoreAdapter implements OneCoreAdapter {
  leute: BrowserLeute;
  channels: BrowserChannels;
  connections: BrowserConnections;
  topics: BrowserTopics;
  attestation: BrowserAttestation;

  constructor(
    private leuteModel: any,
    private channelManager: any,
    private connectionsModel: any,
    private topicModel: any
  ) {
    this.leute = new BrowserLeute(leuteModel);
    this.channels = new BrowserChannels(channelManager);
    this.connections = new BrowserConnections(connectionsModel);
    this.topics = new BrowserTopics(topicModel);
    this.attestation = new BrowserAttestation(channelManager, leuteModel);
  }
}

class BrowserLeute implements OneCoreLeute {
  constructor(private leuteModel: any) {}

  async myMainIdentity(): Promise<SHA256IdHash> {
    return await this.leuteModel.myMainIdentity();
  }

  async getPersonName(personId: SHA256IdHash): Promise<string> {
    return personId.substring(0, 8); // Fallback to truncated ID
  }
}

class BrowserChannels implements OneCoreChannels {
  constructor(private channelManager: any) {}

  async createShared1to1Channel(
    person1: SHA256IdHash,
    person2: SHA256IdHash
  ): Promise<string> {
    const channelId = [person1, person2].sort().join('<->');
    await this.channelManager.createChannel(channelId, null);
    return channelId;
  }

  async postToChannel(channelId: string, objectHash: SHA256Hash): Promise<void> {
    await this.channelManager.postToChannel(channelId, objectHash);
  }

  async getMatchingChannelInfos(): Promise<ChannelInfo[]> {
    return await this.channelManager.getMatchingChannelInfos();
  }
}

class BrowserConnections implements OneCoreConnections {
  constructor(private connectionsModel: any) {}

  async createInvitation(): Promise<string> {
    return await this.connectionsModel.pairing.createInvitation();
  }

  async acceptInvitation(invitation: string): Promise<void> {
    await this.connectionsModel.pairing.connectUsingInvitation(invitation);
  }

  onPairingSuccess(callback: any): void {
    this.connectionsModel.pairing.onPairingSuccess(callback);
  }
}

class BrowserTopics implements OneCoreTopics {
  constructor(private topicModel: any) {}

  async createNewTopic(
    name: string,
    members: SHA256IdHash[],
    groupId?: SHA256IdHash
  ): Promise<string> {
    return await this.topicModel.createNewTopic(name, members, groupId);
  }

  async addMessage(
    topicId: string,
    content: string,
    authorId: SHA256IdHash
  ): Promise<void> {
    await this.topicModel.addMessage(topicId, content, authorId);
  }

  async getMessagesForTopic(topicId: string): Promise<TopicMessage[]> {
    return await this.topicModel.getMessagesForTopic(topicId);
  }
}

class BrowserAttestation implements OneCoreAttestation {
  constructor(
    private channelManager: any,
    private leuteModel: any
  ) {}

  async createGroupWithCertificate(
    name: string,
    members: SHA256IdHash[]
  ): Promise<GroupWithCertificate> {
    // Browser uses same pattern as Cube but with browser-loaded modules
    const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
    const { storeUnversionedObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
    const { sign } = await import('@refinio/one.models/lib/misc/Signature.js');
    const { createAccess } = await import('@refinio/one.core/lib/access.js');
    const { SET_ACCESS_MODE } = await import('@refinio/one.core/lib/storage-base-common.js');

    // Same implementation as Cube
    const hashGroup = {
      $type$: 'HashGroup',
      members
    };
    const hashGroupResult = await storeUnversionedObject(hashGroup);

    const group = {
      $type$: 'Group',
      name,
      hashGroup: hashGroupResult.hash
    };
    const groupResult = await storeVersionedObject(group);

    const license = {
      $type$: 'License',
      name: 'GroupAffirmation',
      description: `Affirms that Group ${groupResult.idHash.substring(0, 8)} exists with specified members`
    };
    const licenseResult = await storeUnversionedObject(license);

    const certificate = {
      $type$: 'AffirmationCertificate',
      data: groupResult.hash,
      license: licenseResult.hash
    };
    const certResult = await storeUnversionedObject(certificate);

    const signatureResult = await sign(certResult.hash, members[0]);
    const signatureHash = signatureResult.hash || signatureResult;

    const otherMembers = members.filter(m => m !== members[0]);
    for (const objectHash of [certResult.hash, signatureHash, licenseResult.hash]) {
      await createAccess([{
        object: objectHash,
        person: otherMembers,
        group: [],
        mode: SET_ACCESS_MODE.REPLACE
      }]);
    }

    return {
      groupId: groupResult.idHash,
      groupHash: groupResult.hash,
      certificateId: certResult.hash,
      signatureId: signatureHash,
      licenseId: licenseResult.hash
    };
  }

  async shareGroupWithMember(
    recipientId: SHA256IdHash,
    groupId: SHA256IdHash,
    certificateIds: CertificateSet
  ): Promise<void> {
    const myId = await this.leuteModel.myMainIdentity();
    const channelId = [myId, recipientId].sort().join('<->');

    await this.channelManager.postToChannel(channelId, certificateIds.certificate);
    await this.channelManager.postToChannel(channelId, certificateIds.signature);
    await this.channelManager.postToChannel(channelId, certificateIds.license);
    await this.channelManager.postToChannel(channelId, groupId);
  }

  async hasGroup(groupId: SHA256IdHash): Promise<boolean> {
    const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
    try {
      const group = await getObjectByIdHash(groupId);
      return group && group.$type$ === 'Group';
    } catch {
      return false;
    }
  }

  async hasCertificates(certificateIds: CertificateSet): Promise<boolean> {
    const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
    try {
      const cert = await getObject(certificateIds.certificate);
      const sig = await getObject(certificateIds.signature);
      const lic = await getObject(certificateIds.license);
      return cert !== null && sig !== null && lic !== null;
    } catch {
      return false;
    }
  }
}
