/**
 * Node.js Storage Adapter for connection.core
 *
 * Minimal implementation using ONE.core storage
 */

export class NodeStorage {
  constructor(leuteModel) {
    this.leuteModel = leuteModel;
  }

  async getPeer(peerId) {
    try {
      // Get person from ONE.core
      const personHash = peerId; // Assuming peerId is SHA256Hash<Person>
      const person = await this.leuteModel.getPerson(personHash);

      if (!person) {
        return null;
      }

      // Get endpoints for this person
      const endpoints = await this.leuteModel.getEndpoints(personHash);

      // Convert to PeerIdentity format
      return {
        id: peerId,
        address: endpoints[0]?.uri || '',
        capabilities: ['websocket'], // For now, just websocket
        publicKey: null, // Not needed for basic implementation
        verifiableCredential: null
      };
    } catch (error) {
      console.error(`[NodeStorage] Error getting peer ${peerId}:`, error);
      return null;
    }
  }

  async storePeer(peer) {
    // For test environment, peers are stored via ONE.core's LeuteModel
    // This is handled automatically during pairing
    console.log(`[NodeStorage] Peer stored: ${peer.id.substring(0, 8)}`);
  }

  async removePeer(peerId) {
    console.log(`[NodeStorage] Peer removed: ${peerId.substring(0, 8)}`);
  }

  async getAllPeers() {
    try {
      // Get all persons from LeuteModel
      const persons = await this.leuteModel.getPersons();

      return persons.map(person => ({
        id: person.hash,
        address: '', // Would need to query endpoints
        capabilities: ['websocket'],
        publicKey: null,
        verifiableCredential: null
      }));
    } catch (error) {
      console.error('[NodeStorage] Error getting all peers:', error);
      return [];
    }
  }
}
