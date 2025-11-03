/**
 * Chat Rendering Flow Diagnostic Script
 *
 * Run this in the browser console to diagnose chat rendering issues.
 *
 * Usage:
 * 1. Open browser console (F12)
 * 2. Copy/paste this entire script
 * 3. Review the output for issues
 */

(async function debugChatFlow() {
  console.log('========================================');
  console.log('CHAT RENDERING FLOW DIAGNOSTIC');
  console.log('========================================\n');

  // Step 1: Check if model is available
  console.log('[1/7] Checking Model availability...');
  const model = window.__model;
  if (!model) {
    console.error('❌ Model not found on window.__model');
    console.log('💡 Add this to main.tsx: window.__model = model');
    return;
  }
  console.log('✅ Model found');

  // Step 2: Check if model is initialized
  console.log('\n[2/7] Checking Model initialization...');
  if (!model.initialized) {
    console.error('❌ Model not initialized (model.initialized = false)');
    console.log('💡 User needs to log in first');
    return;
  }
  console.log('✅ Model initialized');
  console.log('   Owner ID:', model.ownerId);

  // Step 3: Check topics
  console.log('\n[3/7] Checking topics...');
  try {
    const topics = await model.topicModel.topics.all();
    console.log(`✅ Found ${topics.length} topics`);

    if (topics.length === 0) {
      console.warn('⚠️  No topics found - user needs to create a conversation');
    } else {
      console.log('   Topics:', topics.map(t => ({
        id: t.id,
        name: t.name,
        created: new Date(t.creationTime || Date.now()).toLocaleString()
      })));
    }
  } catch (error) {
    console.error('❌ Failed to fetch topics:', error);
  }

  // Step 4: Check ChatHandler.getConversations
  console.log('\n[4/7] Checking ChatHandler.getConversations()...');
  try {
    const response = await model.chatHandler.getConversations({ limit: 100, offset: 0 });

    if (!response.success) {
      console.error('❌ ChatHandler.getConversations() failed:', response.error);
    } else {
      console.log(`✅ ChatHandler.getConversations() returned ${response.data?.length || 0} conversations`);

      if (response.data && response.data.length > 0) {
        console.log('   Conversations:', response.data.map(c => ({
          id: c.id,
          name: c.name,
          participants: c.participants?.length || 0,
          lastMessage: c.lastMessage?.substring(0, 50) || 'No messages'
        })));
      }
    }
  } catch (error) {
    console.error('❌ ChatHandler.getConversations() threw error:', error);
  }

  // Step 5: Check messages for first topic
  console.log('\n[5/7] Checking messages for first topic...');
  try {
    const topics = await model.topicModel.topics.all();

    if (topics.length === 0) {
      console.warn('⚠️  No topics to check messages for');
    } else {
      const firstTopic = topics[0];
      console.log(`   Checking topic: ${firstTopic.id} (${firstTopic.name})`);

      // Method 1: Direct TopicRoom query
      console.log('   Method 1: Direct TopicRoom.retrieveAllMessages()');
      try {
        const room = await model.topicModel.enterTopicRoom(firstTopic.id);
        const messages = await room.retrieveAllMessages();
        console.log(`   ✅ TopicRoom.retrieveAllMessages() returned ${messages.length} messages`);

        if (messages.length > 0) {
          console.log('      Sample message:', {
            id: messages[0].id,
            text: messages[0].data?.text || messages[0].text || 'NO TEXT',
            author: String(messages[0].author).substring(0, 8),
            creationTime: messages[0].creationTime
          });
        }
      } catch (error) {
        console.error('   ❌ TopicRoom query failed:', error);
      }

      // Method 2: ChatHandler.getMessages
      console.log('   Method 2: ChatHandler.getMessages()');
      try {
        const response = await model.chatHandler.getMessages({
          conversationId: firstTopic.id,
          limit: 50,
          offset: 0
        });

        if (!response.success) {
          console.error('   ❌ ChatHandler.getMessages() failed:', response.error);
        } else {
          console.log(`   ✅ ChatHandler.getMessages() returned ${response.messages?.length || 0} messages`);

          if (response.messages && response.messages.length > 0) {
            console.log('      Sample formatted message:', {
              id: response.messages[0].id,
              content: response.messages[0].content?.substring(0, 50) || 'NO CONTENT',
              senderName: response.messages[0].senderName,
              timestamp: new Date(response.messages[0].timestamp).toLocaleString()
            });
          }
        }
      } catch (error) {
        console.error('   ❌ ChatHandler.getMessages() threw error:', error);
      }
    }
  } catch (error) {
    console.error('❌ Message check failed:', error);
  }

  // Step 6: Check channel manager
  console.log('\n[6/7] Checking ChannelManager...');
  try {
    const topics = await model.topicModel.topics.all();

    if (topics.length === 0) {
      console.warn('⚠️  No topics to check channels for');
    } else {
      const firstTopic = topics[0];

      // Check for channels matching this topic
      const channels = await model.channelManager.getMatchingChannelInfos(firstTopic.id, null);
      console.log(`✅ Found ${channels.length} channels for topic ${firstTopic.id}`);

      if (channels.length > 0) {
        console.log('   Channels:', channels.map(c => ({
          id: String(c.id).substring(0, 16),
          owner: String(c.owner).substring(0, 8)
        })));
      } else {
        console.warn('⚠️  No channels found - messages won\'t sync');
      }
    }
  } catch (error) {
    console.error('❌ ChannelManager check failed:', error);
  }

  // Step 7: Check React hooks state
  console.log('\n[7/7] Checking React hooks (if available)...');
  console.log('💡 Check React DevTools → Components → ChatLayout/ChatView/useMessages');
  console.log('   Look for:');
  console.log('   - useTopics: topics array, isLoading state');
  console.log('   - useMessages: messages array, isLoading state');
  console.log('   - Channel listener: Check if onUpdated callback fires');

  console.log('\n========================================');
  console.log('DIAGNOSTIC COMPLETE');
  console.log('========================================\n');

  console.log('Next steps:');
  console.log('1. Review the output above for ❌ errors or ⚠️  warnings');
  console.log('2. Check React DevTools for hook states');
  console.log('3. Check IndexedDB (Application → Storage → IndexedDB)');
  console.log('4. Check browser console for errors during:');
  console.log('   - Login/init sequence');
  console.log('   - Topic creation');
  console.log('   - Message sending');
})();
