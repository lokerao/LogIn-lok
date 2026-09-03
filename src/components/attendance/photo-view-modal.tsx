import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { colors, radius, spacing, typography } from '@/constants/design-system';
import { getSignedPhotoUrl } from '@/features/attendance/attendance-service';

type Props = {
  visible: boolean;
  photoPath: string | null;
  title?: string;
  onClose: () => void;
};

export function PhotoViewModal({
  visible,
  photoPath,
  title = 'Attendance Photo',
  onClose,
}: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!visible || !photoPath) {
      return;
    }

    let active = true;

    async function loadPhoto() {
      setIsLoading(true);
      setHasError(false);
      setErrorMessage('');

      try {
        console.log('[PhotoViewModal] Fetching signed URL for photoPath:', photoPath);
        const url = await getSignedPhotoUrl(photoPath!);
        console.log('[PhotoViewModal] Signed URL returned:', Boolean(url));
        if (!active) return;

        if (url) {
          // Probe the signed URL to inspect exact HTTP status from Supabase Storage
          try {
            const probe = await fetch(url);
            console.log(
              '[PhotoViewModal] Probe HTTP status:',
              probe.status,
              probe.statusText,
              'content-type:',
              probe.headers.get('content-type'),
              'content-length:',
              probe.headers.get('content-length'),
            );

            if (!probe.ok) {
              const bodyText = await probe.text().catch(() => '');
              console.error('[PhotoViewModal] Probe non-OK body:', bodyText);
              if (active) {
                setHasError(true);
                setErrorMessage(
                  `Storage returned HTTP ${probe.status}: ${bodyText || probe.statusText}`,
                );
                setIsLoading(false);
              }
              return;
            }
          } catch (probeErr) {
            console.warn('[PhotoViewModal] Probe fetch network error:', probeErr);
          }

          if (active) {
            setSignedUrl(url);
          }
        } else {
          if (active) {
            setHasError(true);
            setErrorMessage('Could not generate secure view token.');
          }
        }
      } catch (err: unknown) {
        if (!active) return;
        setHasError(true);
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to retrieve photo.',
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadPhoto();

    return () => {
      active = false;
      setSignedUrl(null);
      setIsLoading(false);
      setHasError(false);
    };
  }, [visible, photoPath, retryCount]);

  function handleRetry() {
    setRetryCount((prev) => prev + 1);
  }

  return (
    <Modal animationType="fade" transparent visible={visible}>
      <SafeAreaView style={styles.overlay}>
        <View style={styles.container}>
          {/* Modal Header */}
          <View style={styles.header}>
            <Text numberOfLines={1} style={styles.title}>
              {title}
            </Text>
            <Pressable
              accessibilityLabel="Close photo viewer"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          {/* Photo Content Area */}
          <View style={styles.imageBox}>
            {isLoading ? (
              <View style={styles.centerBox}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.loadingText}>Loading private photo…</Text>
              </View>
            ) : hasError || !signedUrl ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>Unable to display photo</Text>
                <Text style={styles.errorSubtext}>
                  {errorMessage || 'Access token expired or permission denied.'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleRetry}
                  style={styles.retryBtn}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <Image
                contentFit="cover"
                onError={(e) => {
                  console.error('[PhotoViewModal] expo-image onError:', e.error);
                  setHasError(true);
                  setErrorMessage('Failed to load image from storage.');
                }}
                onLoad={() => {
                  console.log('[PhotoViewModal] expo-image onLoad SUCCESS');
                }}
                source={{ uri: signedUrl }}
                style={styles.photo}
                transition={200}
              />
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  container: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    alignItems: 'center',
    borderBottomColor: '#EEF1F6',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    marginRight: spacing.sm,
  },
  closeButton: {
    padding: spacing.xs,
  },
  closeText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  imageBox: {
    alignItems: 'center',
    aspectRatio: 3 / 4,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    width: '100%',
  },
  photo: {
    height: '100%',
    width: '100%',
  },
  centerBox: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBox: {
    alignItems: 'center',
    backgroundColor: colors.white,
    gap: spacing.xs,
    padding: spacing.xl,
    width: '100%',
  },
  errorText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  errorSubtext: {
    color: colors.muted,
    ...typography.body,
    fontSize: 13,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  retryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
