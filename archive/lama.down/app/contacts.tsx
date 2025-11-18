/**
 * Contacts screen - demonstrates contacts:list plan operation
 */

import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useLamaClient } from '@hooks/useLamaClient';

interface Contact {
  personIdHash: string;
  nickname: string;
  profileId: string;
}

export default function ContactsScreen() {
  const client = useLamaClient();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        // Invoke contacts:list plan operation
        const result = await client.contacts.list();
        setContacts(result.contacts);
      } catch (err) {
        console.error('Failed to load contacts:', err);
        setError((err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    loadContacts();
  }, []);

  const renderContact = ({ item }: { item: Contact }) => (
    <View style={styles.contactCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.nickname.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.nickname}</Text>
        <Text style={styles.contactId} numberOfLines={1}>
          {item.personIdHash}
        </Text>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading contacts...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Failed to load contacts</Text>
        <Text style={styles.errorDetails}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={contacts}
        renderItem={renderContact}
        keyExtractor={item => item.personIdHash}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No contacts yet</Text>
            <Text style={styles.emptySubtext}>
              Add contacts to start messaging
            </Text>
          </View>
        }
      />

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Using plan operation: contacts:list
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
  },
  errorDetails: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  contactCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  contactId: {
    fontSize: 12,
    color: '#999',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
  },
  infoContainer: {
    padding: 8,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 11,
    color: '#1976d2',
  },
});
