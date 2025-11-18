import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme, IconButton, Button, Card, FAB, Chip } from 'react-native-paper';
import { useInstance } from '@src/providers/app';
import { useTranslation } from 'react-i18next';
import { useRouter, Stack } from 'expo-router';
import { useTheme as useAppTheme } from '@src/providers/app/AppTheme';
import type { JournalEntry } from '@src/recipes/JournalRecipes';
import ErrorView from '@src/components/ErrorView';
import CalendarScreen from '../(screens)/calendar';
import { LoadingSpinner } from '@src/components/LoadingSpinner';
import { Namespaces } from '@src/i18n/namespaces';
import { routes } from '@src/config/routes';
import { getJournalEntries } from '@src/utils/appJournal';
import { DeviceModel } from '@src/models/device/DeviceModel';
import { DeviceLEDService, type LEDDevice } from '@src/services/DeviceLEDService';
import { getInstanceOwnerIdHash } from '@refinio/one.core/lib/instance.js';
import { DeviceType } from '@src/models/network/deviceTypes';

export default function JournalScreen() {
    const { instance, isAuthenticated } = useInstance();
    const { t: tJournal } = useTranslation(Namespaces.JOURNAL);
    const { t: tNav } = useTranslation(Namespaces.NAVIGATION);
    const theme = useTheme();
    const { styles: themedStyles } = useAppTheme();
    const router = useRouter();

    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [error, setError] = useState<Error | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
    const [modelState, setModelState] = useState<'initializing' | 'ready' | 'error'>('initializing');
    const [isLoadingEntries, setIsLoadingEntries] = useState(false);
    const [showScrollToTop, setShowScrollToTop] = useState(false);
    const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
    const [ownedDevices, setOwnedDevices] = useState<LEDDevice[]>([]);
    const [pendingLEDCommands, setPendingLEDCommands] = useState<Set<string>>(new Set());
    const flatListRef = useRef<FlatList>(null);

    // Define available filter types
    const filterTypes = [
        { key: 'device', label: tJournal('filters.device', { defaultValue: 'Device Logs' }), icon: 'devices' },
        { key: 'screen', label: tJournal('filters.screen', { defaultValue: 'Screen Views' }), icon: 'monitor' },
        { key: 'app', label: tJournal('filters.app', { defaultValue: 'App Events' }), icon: 'application' },
    ];

    // Handle errors
    const handleError = useCallback((error: Error) => {
        console.error('[JournalScreen] Error:', error);
        setError(error);
        setModelState('error');
    }, []);

    // Single function to load journal data
    const loadJournalData = useCallback(async () => {
        try {
            console.log('[JournalScreen] Loading journal data from app journal channel');
            setIsLoadingEntries(true);

            // Fetch journal entries from the app journal channel
            const journalEntries = await getJournalEntries(100); // Limit to 100 most recent entries
            console.log('[JournalScreen] Retrieved journal entries:', journalEntries?.length || 0);

            // Handle empty case gracefully
            if (!journalEntries || journalEntries.length === 0) {
                console.log('[JournalScreen] No journal entries found');
                setEntries([]);
                setIsLoadingEntries(false);
                return;
            }

            setEntries(journalEntries);
        } catch (error) {
            console.error('[JournalScreen] Error loading journal data:', error);
            handleError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsLoadingEntries(false);
        }
    }, [handleError]);

    // Set up event handlers when model is available
    useEffect(() => {
        if (!instance?.journalModel) {
            console.log('[JournalScreen] No journalModel available');
            return;
        }

        console.log('[JournalScreen] Setting up journal subscriptions');
        
        // Track event listener for cleanup
        let unsubscribeFunction: any = null;
        
        // Check if journal model is already initialized
        const modelStateValue = instance.journalModel.state?.currentState;
        
        if (modelStateValue === 'Initialised') {
            // Model already initialized - set up listener and load data
            console.log('[JournalScreen] Journal model already initialized');
            setModelState('ready');
            
            try {
                // Set up event listener for updates
                unsubscribeFunction = instance.journalModel.onUpdated.listen(function() {
                    console.log('[JournalScreen] Journal update event received');
                    loadJournalData();
                });
                
                // Load initial data
                loadJournalData();
            } catch (error) {
                console.error('[JournalScreen] Error setting up initialized model:', error);
                handleError(error instanceof Error ? error : new Error(String(error)));
            }
        } else {
            // Wait for model to be initialized
            console.log('[JournalScreen] Waiting for journal model to be initialized');
            
            // Check for state changes
            const checkIntervalId = setInterval(() => {
                try {
                    const currentState = instance.journalModel.state?.currentState;
                    if (currentState === 'Initialised') {
                        console.log('[JournalScreen] Journal model became ready');
                        clearInterval(checkIntervalId);
                        setModelState('ready');
                        
                        // Set up event listener
                        try {
                            unsubscribeFunction = instance.journalModel.onUpdated.listen(function() {
                                console.log('[JournalScreen] Journal update event received');
                                loadJournalData();
                            });
                        } catch (listenerError) {
                            console.error('[JournalScreen] Error setting up event listener:', listenerError);
                        }
                        
                        // Load initial data
                        loadJournalData();
                    }
                } catch (checkError) {
                    console.error('[JournalScreen] Error checking model state:', checkError);
                    clearInterval(checkIntervalId);
                    handleError(checkError instanceof Error ? checkError : new Error(String(checkError)));
                }
            }, 500);
            
            // Clean up interval on unmount
            return () => {
                clearInterval(checkIntervalId);
                // Also clean up event listener if it exists
                if (unsubscribeFunction && typeof unsubscribeFunction === 'function') {
                    try {
                        unsubscribeFunction();
                    } catch (error) {
                        console.error('[JournalScreen] Error unsubscribing:', error);
                    }
                }
            };
        }
        
        // Clean up event listener on unmount
        return () => {
            console.log('[JournalScreen] Cleaning up subscriptions');
            if (unsubscribeFunction && typeof unsubscribeFunction === 'function') {
                try {
                    unsubscribeFunction();
                } catch (error) {
                    console.error('[JournalScreen] Error unsubscribing:', error);
                }
            }
        };
    }, [instance?.journalModel, loadJournalData, handleError]);

    const renderItem = useCallback(({ item }: { item: JournalEntry }) => {
        // Extract text or create a summary from the data object
        let titleText = 'Journal Entry';
        let subtitleText = '';
        let dataObj = item.data;

        // Handle different event types with better formatting
        const eventType = item.type;

        // Check if data is a string or object
        if (typeof dataObj === 'string') {
            titleText = dataObj;
        } else if (typeof dataObj === 'object' && dataObj !== null) {
            // Handle device events specifically
            if (eventType === 'DEVICE_DISCOVERED') {
                titleText = `Device Discovered: ${dataObj.name || dataObj.deviceId || 'Unknown'}`;
                subtitleText = `Type: ${dataObj.deviceType || 'Unknown'} • ${dataObj.address || ''}`;
            } else if (eventType === 'DEVICE_OWNERSHIP_CLAIMED') {
                titleText = `Device Claimed: ${dataObj.name || dataObj.deviceId || 'Unknown'}`;
                subtitleText = `Type: ${dataObj.deviceType || 'Unknown'}`;
            } else if (eventType === 'DEVICE_OWNERSHIP_RELEASED') {
                titleText = `Device Released: ${dataObj.name || dataObj.deviceId || 'Unknown'}`;
                subtitleText = `Type: ${dataObj.deviceType || 'Unknown'}`;
            } else if (eventType === 'DEVICE_LED_ON') {
                titleText = `LED Turned On: ${dataObj.name || dataObj.deviceId || 'Unknown'}`;
                subtitleText = `Device: ${dataObj.deviceType || 'Unknown'}`;
            } else if (eventType === 'DEVICE_LED_OFF') {
                titleText = `LED Turned Off: ${dataObj.name || dataObj.deviceId || 'Unknown'}`;
                subtitleText = `Device: ${dataObj.deviceType || 'Unknown'}`;
            } else if (eventType === 'APP_STARTED') {
                titleText = 'App Started';
                subtitleText = dataObj.startupTimeMs ? `Startup time: ${dataObj.startupTimeMs}ms` : '';
            } else if (eventType === 'SCREEN_VIEWED') {
                titleText = `Screen: ${dataObj.screenName || 'Unknown'}`;
                subtitleText = 'Screen Viewed';
            } else if ('text' in dataObj && typeof dataObj.text === 'string') {
                titleText = dataObj.text;
            } else if ('title' in dataObj && typeof dataObj.title === 'string') {
                titleText = dataObj.title;
            } else if ('summary' in dataObj && typeof dataObj.summary === 'string') {
                titleText = dataObj.summary;
            } else {
                // Fallback to event type
                titleText = eventType || 'Journal Entry';
                subtitleText = `Entry ID: ${item.id.substring(0, 12)}...`;
            }
        } else {
            // Fallback for other types (null, undefined, etc.)
            titleText = eventType || 'Unknown Event';
        }

        // Ensure titleText is never empty
        if (!titleText) {
          titleText = `Entry ID: ${item.id.substring(0, 8)}...`;
        }

        const timeText = new Date(item.timestamp).toLocaleString();
        const fullSubtitle = subtitleText ? `${timeText} • ${subtitleText}` : timeText;

        return (
            <Card style={styles.card}>
                <Card.Title
                    title={titleText}
                    titleNumberOfLines={2}
                    subtitle={fullSubtitle}
                    subtitleNumberOfLines={2}
                />
            </Card>
        );
    }, []);

    const handleAddEntry = useCallback(() => {
        const newEntry = {
            id: `entry-${Date.now()}`,
            timestamp: Date.now(),
            data: { text: `Entry at ${new Date().toLocaleString()}` },
            $type$: 'JournalEntry',
            type: 'note'
        } as JournalEntry;

        setEntries(current => [...current, newEntry].sort((a, b) => b.timestamp - a.timestamp));
    }, []);

    const handleScrollToTop = useCallback(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, []);

    const handleScroll = useCallback((event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        setShowScrollToTop(offsetY > 200);
    }, []);

    const toggleFilter = useCallback((filterKey: string) => {
        setActiveFilters(current => {
            const newFilters = new Set(current);
            if (newFilters.has(filterKey)) {
                newFilters.delete(filterKey);
            } else {
                newFilters.add(filterKey);
            }
            return newFilters;
        });
    }, []);

    // Load owned devices
    const loadOwnedDevices = useCallback(async () => {
        try {
            const deviceModel = DeviceModel.getInstance();
            const currentUserId = getInstanceOwnerIdHash();
            const allDevices = await deviceModel.getRuntimeDevices();

            const owned = allDevices
                .filter(device => device.owner === currentUserId && device.deviceType === DeviceType.ESP32)
                .map(device => ({
                    id: device.deviceId,
                    type: device.deviceType,
                    ownerId: device.owner,
                    blueLedStatus: device.blueLedStatus || 'off'
                } as LEDDevice));

            setOwnedDevices(owned);
        } catch (error) {
            console.error('[JournalScreen] Error loading owned devices:', error);
        }
    }, []);

    // Load owned devices on mount and when device state changes
    useEffect(() => {
        loadOwnedDevices();

        // Set up interval to refresh device list
        const intervalId = setInterval(loadOwnedDevices, 5000);

        return () => clearInterval(intervalId);
    }, [loadOwnedDevices]);

    // Toggle LED for a device
    const handleToggleLED = useCallback(async (device: LEDDevice) => {
        if (pendingLEDCommands.has(device.id)) {
            console.log('[JournalScreen] LED command already in progress for device:', device.id);
            return;
        }

        setPendingLEDCommands(prev => new Set(prev).add(device.id));

        try {
            const result = await DeviceLEDService.toggleLED(device);
            if (!result.success) {
                console.error('[JournalScreen] LED toggle failed:', result.error);
            }
            // Refresh devices to get updated LED status
            await loadOwnedDevices();
        } catch (error) {
            console.error('[JournalScreen] Error toggling LED:', error);
        } finally {
            setPendingLEDCommands(prev => {
                const next = new Set(prev);
                next.delete(device.id);
                return next;
            });
        }
    }, [pendingLEDCommands, loadOwnedDevices]);

    // Filter entries based on active filters
    const filteredEntries = React.useMemo(() => {
        if (activeFilters.size === 0) {
            return entries;
        }

        return entries.filter(entry => {
            if (activeFilters.has('device')) {
                if (entry.type.startsWith('DEVICE_')) {
                    return true;
                }
            }
            if (activeFilters.has('screen')) {
                if (entry.type === 'SCREEN_VIEWED') {
                    return true;
                }
            }
            if (activeFilters.has('app')) {
                if (entry.type.startsWith('APP_')) {
                    return true;
                }
            }
            return false;
        });
    }, [entries, activeFilters]);

    // Check if we can access the model
    if (!isAuthenticated || !instance) {
        console.log('[JournalScreen] Not authenticated or no instance available, redirecting to login');
        
        // Use effect to redirect to login
        useEffect(() => {
            router.replace(routes.auth.login);
        }, [router]);
        
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <Stack.Screen options={{ 
                    title: tNav('tabs.journal', { defaultValue: 'Journal' })
                }} />
                <View style={styles.centerContent}>
                    <LoadingSpinner
                        message={tJournal('loading.title', { defaultValue: 'Loading' })}
                        subtitle={tJournal('loading.description', { defaultValue: 'Please wait...' })}
                        size="large"
                    />
                </View>
            </View>
        );
    }

    if (modelState === 'error' && error) {
        return <ErrorView error={error} />;
    }

    if (modelState === 'initializing') {
        return (
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                <Stack.Screen options={{ 
                    title: tNav('tabs.journal', { defaultValue: 'Journal' }),
                }} />
                <View style={styles.centerContent}>
                    <LoadingSpinner
                        message={tJournal('loading.title', { defaultValue: 'Loading Journal' })}
                        subtitle={tJournal('loading.description', { defaultValue: 'Getting your entries...' })}
                        size="large"
                    />
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <Stack.Screen 
              options={{ 
                title: tNav('tabs.journal', { defaultValue: 'Journal' })
              }} 
            />
            
            {viewMode === 'list' ? (
                <>
                    {/* Device LED Control Dots */}
                    {ownedDevices.length > 0 && (
                        <View style={styles.deviceDotsContainer}>
                            {ownedDevices.map(device => {
                                const isOn = device.blueLedStatus === 'on';
                                const isPending = pendingLEDCommands.has(device.id);
                                return (
                                    <TouchableOpacity
                                        key={device.id}
                                        onPress={() => handleToggleLED(device)}
                                        disabled={isPending}
                                        style={styles.deviceDotTouchable}
                                    >
                                        <View
                                            style={[
                                                styles.deviceDot,
                                                {
                                                    backgroundColor: isOn ? '#2196F3' : '#E0E0E0',
                                                    opacity: isPending ? 0.5 : 1,
                                                }
                                            ]}
                                        />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    <View style={styles.headerRow}>
                        <View style={styles.filterChips}>
                            {filterTypes.map(filter => {
                                const isActive = activeFilters.has(filter.key);
                                return (
                                    <Chip
                                        key={filter.key}
                                        selected={isActive}
                                        onPress={() => toggleFilter(filter.key)}
                                        style={styles.filterChip}
                                        mode={isActive ? 'flat' : 'outlined'}
                                        icon={filter.icon}
                                    >
                                        {filter.label}
                                    </Chip>
                                );
                            })}
                        </View>
                        <IconButton
                            icon="plus"
                            size={24}
                            onPress={handleAddEntry}
                            mode="contained"
                        />
                    </View>
                    {isLoadingEntries ? (
                        <View style={styles.centerContent}>
                            <LoadingSpinner
                                message={tJournal('loading.entries', { defaultValue: 'Loading entries' })}
                                subtitle={tJournal('loading.please_wait', { defaultValue: 'Please wait...' })}
                                size="large"
                            />
                        </View>
                    ) : entries.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text>{tJournal('noEntries', { defaultValue: 'No entries yet' })}</Text>
                        </View>
                    ) : (
                        <>
                            <FlatList
                                ref={flatListRef}
                                data={filteredEntries}
                                keyExtractor={item => item.id}
                                renderItem={renderItem}
                                contentContainerStyle={styles.list}
                                inverted={true}
                                onScroll={handleScroll}
                                scrollEventThrottle={16}
                            />
                            {showScrollToTop && (
                                <FAB
                                    icon="chevron-up"
                                    style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                                    onPress={handleScrollToTop}
                                    size="small"
                                />
                            )}
                        </>
                    )}
                </>
            ) : (
                <CalendarScreen />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: 16,
    },
    list: {
        padding: 16,
    },
    card: {
        marginBottom: 16,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: 8,
    },
    filterChips: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    filterChip: {
        marginRight: 4,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
    deviceDotsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 12,
        alignItems: 'center',
    },
    deviceDotTouchable: {
        padding: 4,
    },
    deviceDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#BDBDBD',
    },
}); 