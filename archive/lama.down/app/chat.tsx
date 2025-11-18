/**
 * Chat screen - demonstrates plan-based operations
 */

import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useLamaClient, useLamaEvents } from '@hooks/useLamaClient';

interface Message {
  messageId: string;
  content: string;
  author: string;
  timestamp: number;
}

export default function ChatScreen() {
  const client = useLamaClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Load initial messages
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const result = await client.chat.getHistory({
          topicId: 'topic-123',
          limit: 50
        });
        setMessages(result.messages);
      } catch (error) {
        console.error('Failed to load messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, []);

  // Subscribe to real-time updates
  useLamaEvents('topicUpdated', (event) => {
    console.log('Topic updated:', event);
    // Reload messages when topic updates
    client.chat.getHistory({ topicId: 'topic-123' })
      .then(result => setMessages(result.messages));
  });

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    try {
      // Invoke chat:sendMessage plan operation
      const result = await client.chat.sendMessage({
        topicId: 'topic-123',
        content: inputText.trim()
      });

      console.log('Message sent:', result);

      // Add message to local state (optimistic update)
      const newMessage: Message = {
        messageId: result.messageId,
        content: inputText.trim(),
        author: 'You',
        timestamp: result.timestamp
      };
      setMessages(prev => [...prev, newMessage]);
      setInputText('');
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={styles.messageContainer}>
      <View style={styles.messageHeader}>
        <Text style={styles.messageAuthor}>{item.author}</Text>
        <Text style={styles.messageTime}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </Text>
      </View>
      <Text style={styles.messageContent}>{item.content}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.messageId}
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start the conversation!</Text>
          </View>
        }
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, isSending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={isSending || !inputText.trim()}
        >
          <Text style={styles.sendButtonText}>
            {isSending ? '...' : 'Send'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>
          Using plan operation: chat:sendMessage
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
  },
  messageContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  messageAuthor: {
    fontWeight: '600',
    fontSize: 14,
    color: '#2196F3',
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
  },
  messageContent: {
    fontSize: 16,
    color: '#333',
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
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
