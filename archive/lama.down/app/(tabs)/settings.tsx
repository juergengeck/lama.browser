/**
 * Settings screen - Demonstrates settings.core integration
 */

import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { useSettings } from '@hooks/useSettings';

export default function SettingsScreen() {
  const { settings, isLoading, updateSetting, reset } = useSettings();

  if (isLoading || !settings) {
    return (
      <View style={styles.container}>
        <Text>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      {/* App Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Theme</Text>
          <Text style={styles.settingValue}>{settings.app.theme}</Text>
        </View>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Notifications</Text>
          <Switch
            value={settings.app.notifications}
            onValueChange={(value) => updateSetting('app', 'notifications', value)}
          />
        </View>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Sound Enabled</Text>
          <Switch
            value={settings.app.soundEnabled}
            onValueChange={(value) => updateSetting('app', 'soundEnabled', value)}
          />
        </View>
      </View>

      {/* Device Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Device Discovery</Text>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Discovery Enabled</Text>
          <Switch
            value={settings.device.discoveryEnabled}
            onValueChange={(value) => updateSetting('device', 'discoveryEnabled', value)}
          />
        </View>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Auto Connect</Text>
          <Switch
            value={settings.device.autoConnect}
            onValueChange={(value) => updateSetting('device', 'autoConnect', value)}
          />
        </View>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Show Offline Devices</Text>
          <Switch
            value={settings.device.showOfflineDevices}
            onValueChange={(value) => updateSetting('device', 'showOfflineDevices', value)}
          />
        </View>
      </View>

      {/* Network Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Network</Text>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>CommServer URL</Text>
          <Text style={styles.settingValue}>{settings.network.commServerUrl}</Text>
        </View>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Auto Reconnect</Text>
          <Switch
            value={settings.network.autoReconnect}
            onValueChange={(value) => updateSetting('network', 'autoReconnect', value)}
          />
        </View>
      </View>

      {/* AI Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Assistant</Text>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>AI Enabled</Text>
          <Switch
            value={settings.ai.enabled}
            onValueChange={(value) => updateSetting('ai', 'enabled', value)}
          />
        </View>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Provider</Text>
          <Text style={styles.settingValue}>{settings.ai.provider}</Text>
        </View>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Stream Responses</Text>
          <Switch
            value={settings.ai.streamResponses}
            onValueChange={(value) => updateSetting('ai', 'streamResponses', value)}
          />
        </View>
      </View>

      {/* Chat Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Chat</Text>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Enter to Send</Text>
          <Switch
            value={settings.chat.enterToSend}
            onValueChange={(value) => updateSetting('chat', 'enterToSend', value)}
          />
        </View>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Show Read Receipts</Text>
          <Switch
            value={settings.chat.showReadReceipts}
            onValueChange={(value) => updateSetting('chat', 'showReadReceipts', value)}
          />
        </View>

        <View style={styles.setting}>
          <Text style={styles.settingLabel}>Auto Download Media</Text>
          <Switch
            value={settings.chat.autoDownloadMedia}
            onValueChange={(value) => updateSetting('chat', 'autoDownloadMedia', value)}
          />
        </View>
      </View>

      {/* Reset Button */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.resetButton} onPress={() => reset()}>
          <Text style={styles.resetButtonText}>Reset All Settings to Defaults</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Settings are stored securely using Expo SecureStore
        </Text>
        <Text style={styles.footerText}>
          Changes are persisted automatically
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    padding: 20,
    backgroundColor: '#fff',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    paddingHorizontal: 20,
    paddingBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  setting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  settingValue: {
    fontSize: 14,
    color: '#666',
  },
  resetButton: {
    backgroundColor: '#d32f2f',
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
  },
});
